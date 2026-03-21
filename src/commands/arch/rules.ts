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

export class ArchRulesCommand extends Command {
  public getDescription(): string {
    return 'Manage architecture rules';
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

    return this.runWithLogging('arch rules', args, async () => {
      const data = this.loadRules();

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(data);
      }

      return this.formatNormal(data);
    });
  }

  private formatSlim(data: ArchRulesData): CommandResult {
    const lines = data.rules.map(rule => {
      const typeCode = this.getTypeCode(rule.type);
      return `${rule.id}  ${typeCode}  ${rule.description}`;
    });

    const output = [
      ...lines,
      '---',
      `${data.rules.length} rules  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'arch',
      action: 'rules',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: data.rules.length,
    };
  }

  private formatNormal(data: ArchRulesData): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `rules: ${data.rules.length}`,
      `===`
    ];

    for (const rule of data.rules) {
      sections.push(`${rule.id}  ${rule.type}: ${rule.description}`);
      sections.push(`  pattern: ${rule.pattern}`);
      sections.push(`  created: ${rule.createdAt.split('T')[0]}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'arch',
      action: 'rules',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: data.rules.length,
    };
  }

  private getTypeCode(type: string): string {
    const codes: Record<string, string> = {
      'must-not-import': 'MNI',
      'can-only-import': 'COI',
      'must-have-test': 'MHT',
    };
    return codes[type] || '???';
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

  private parseArgs(args: string[]): { fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
