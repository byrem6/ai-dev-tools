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

export class ArchRuleAddCommand extends Command {
  public getDescription(): string {
    return 'Add architecture rule';
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

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('arch rule add', args, async () => {
      if (!options.rule) {
        throw createError('ENOENT', 'Rule pattern is required. Example: "src/controllers/* must not import src/repositories/*"');
      }

      const data = this.loadRules();
      const ruleId = `RULE-${data.lastId + 1}`;

      const rule = this.parseRule(options.rule);
      rule.id = ruleId;
      rule.createdAt = new Date().toISOString();

      data.rules.push(rule);
      data.lastId++;

      this.saveRules(data);

      if (this.formatManager.getFormat() === 'slim') {
        const output = `ok true  ${ruleId}  "${rule.description}"  added`;
        return {
          ok: true,
          command: 'arch',
          action: 'rule-add',
          tokenEstimate: this.estimateTokens(output),
          content: output,
          ruleId,
        };
      }

      const output = `ok: true
rule: ${ruleId}  added
---
type: ${rule.type}
description: ${rule.description}
pattern: ${rule.pattern}`;

      return {
        ok: true,
        command: 'arch',
        action: 'rule-add',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        ruleId,
      };
    });
  }

  private parseRule(ruleStr: string): ArchRule {
    // Parse rule patterns:
    // "<source> must not import <target>"
    // "<source> can only import <target>"
    // "<source> must have test file"

    let type: ArchRule['type'] = 'must-not-import';
    let description = ruleStr;
    let pattern = ruleStr;

    if (ruleStr.includes('must not import')) {
      type = 'must-not-import';
      description = ruleStr.replace('must not import', 'MUST NOT IMPORT');
      pattern = ruleStr;
    } else if (ruleStr.includes('can only import')) {
      type = 'can-only-import';
      description = ruleStr.replace('can only import', 'CAN ONLY IMPORT');
      pattern = ruleStr;
    } else if (ruleStr.includes('must have test')) {
      type = 'must-have-test';
      description = ruleStr.replace('must have test', 'MUST HAVE TEST');
      pattern = ruleStr;
    } else {
      // Default to must-not-import
      description = `${ruleStr} MUST NOT IMPORT restricted modules`;
    }

    return {
      id: '',
      description,
      pattern,
      type,
      createdAt: '',
    };
  }

  private saveRules(data: ArchRulesData): void {
    fs.writeFileSync(this.rulesFile, JSON.stringify(data, null, 2), 'utf-8');
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

  private parseArgs(args: string[]): { rule?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.rule = arg;
      }
    }

    return options;
  }
}
