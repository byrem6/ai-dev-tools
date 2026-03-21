import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface ArchRule {
  id: string;
  description: string;
  pattern: string;
  type: 'must-not-import' | 'can-only-import' | 'must-have-test';
  createdAt: string;
}

interface ArchRulesData {
  rules: ArchRule[];
  lastId: number;
}

interface Violation {
  ruleId: string;
  rule: ArchRule;
  file: string;
  line: number;
  importPath: string;
}

export class ArchCheckCommand extends Command {
  public getDescription(): string {
    return 'Check architecture rule compliance';
  }

  private rulesFile: string;

  constructor(
    formatManager: any,
    configManager: any,
    sessionManager: any
  ) {
    super(formatManager, configManager, sessionManager);
    this.rulesFile = path.join(process.cwd(), '.adt-arch.json');
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt arch-check [path]',
      description: 'Check code for architecture rule violations',
      examples: [
        'adt arch-check src/',
        'adt arch-check --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('arch check', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const data = this.loadRules();

      if (data.rules.length === 0) {
        const output = 'ok true  No architecture rules defined. Use "adt arch-rule-add" to add rules.';

        return {
          ok: true,
          command: 'arch',
          action: 'check',
          tokenEstimate: this.estimateTokens(output),
          content: output,
          violations: [],
        };
      }

      const violations = await this.checkViolations(targetPath, data.rules);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(violations, data.rules.length);
      }

      return this.formatNormal(violations, data.rules.length);
    });
  }

  private async checkViolations(targetPath: string, rules: ArchRule[]): Promise<Violation[]> {
    const violations: Violation[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const rule of rules) {
        const fileViolations = this.checkFileAgainstRule(file, lines, rule);
        violations.push(...fileViolations);
      }
    }

    return violations;
  }

  private checkFileAgainstRule(file: string, lines: string[], rule: ArchRule): Violation[] {
    const violations: Violation[] = [];

    if (rule.type === 'must-not-import') {
      const pattern = rule.pattern.split('must not import ')[1];
      if (!pattern) return violations;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const importMatch = line.match(/import.*from\s+['"]([^'"]+)['"]/);

        if (importMatch) {
          const importPath = importMatch[1];
          if (this.matchesPattern(importPath, pattern)) {
            violations.push({
              ruleId: rule.id,
              rule,
              file,
              line: i + 1,
              importPath,
            });
          }
        }
      }
    }

    return violations;
  }

  private matchesPattern(importPath: string, pattern: string): boolean {
    // Simple glob-like matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern);
    return regex.test(importPath);
  }

  private formatSlim(violations: Violation[], totalRules: number): CommandResult {
    if (violations.length === 0) {
      const output = `ok true  0 violations  ${totalRules} rules checked`;
      return {
        ok: true,
        command: 'arch',
        action: 'check',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        violations: [],
      };
    }

    const lines = violations.map(v =>
      `${v.file}:${v.line}  ${v.importPath}  [${v.ruleId}]`
    );

    const output = [
      `ok false`,
      ...lines,
      '---',
      `${violations.length} violations`
    ].join('\n');

    return {
      ok: false,
      command: 'arch',
      action: 'check',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      violations,
    };
  }

  private formatNormal(violations: Violation[], totalRules: number): CommandResult {
    const sections: string[] = [];

    if (violations.length === 0) {
      const output = `ok: true\nrules: ${totalRules}\nviolations: 0\n===\nNo architecture violations found.`;

      return {
        ok: true,
        command: 'arch',
        action: 'check',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        violations: [],
      };
    }

    sections.push(`ok: false`);
    sections.push(`rules: ${totalRules}  violations: ${violations.length}`);
    sections.push(`===`);

    for (const v of violations) {
      sections.push(`VIOLATION [${v.ruleId}]: ${v.rule.description}`);
      sections.push(`  ${v.file}:${v.line}`);
      sections.push(`  imports: ${v.importPath}`);
      sections.push(`  fix: See rule ${v.ruleId} for guidance`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: false,
      command: 'arch',
      action: 'check',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      violations,
    };
  }

  private loadRules(): ArchRulesData {
    if (!fs.existsSync(this.rulesFile)) {
      return { rules: [], lastId: 0 };
    }

    try {
      const content = fs.readFileSync(this.rulesFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return { rules: [], lastId: 0 };
    }
  }

  private parseArgs(args: string[]): { path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.path = arg;
      }
    }

    return options;
  }
}
