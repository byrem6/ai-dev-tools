import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface FeatureFlag {
  name: string;
  file: string;
  line: number;
  defaultValue: any;
}

export class ConfigFlagsCommand extends Command {
  public getDescription(): string {
    return 'List feature flags';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt config-flags [path]',
      description: 'List all feature flags in the codebase',
      examples: [
        'adt config-flags src/',
        'adt config-flags --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('config flags', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const flags = await this.extractFeatureFlags(targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(flags);
      }

      return this.formatNormal(flags);
    });
  }

  private async extractFeatureFlags(targetPath: string): Promise<FeatureFlag[]> {
    const flags: FeatureFlag[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match common feature flag patterns
        const patterns = [
          /(?:const|let|var)\s+(FF_\w+|FEATURE_\w+|FLAG_\w+)\s*=\s*(true|false|null)/,
          /(\w+Enabled)\s*=\s*(true|false)/,
          /isEnabled\s*\(\s*['"`](\w+)['"`]\s*\)/,
        ];

        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            const flagName = match[1];
            const defaultValue = match[2];

            // Only include if it looks like a feature flag
            if (this.isFeatureFlag(flagName)) {
              flags.push({
                name: flagName,
                file,
                line: i + 1,
                defaultValue: defaultValue === 'true' ? true : defaultValue === 'false' ? false : null,
              });
            }
          }
        }
      }
    }

    return flags;
  }

  private isFeatureFlag(name: string): boolean {
    const upperName = name.toUpperCase();
    return (
      upperName.startsWith('FF_') ||
      upperName.startsWith('FEATURE_') ||
      upperName.startsWith('FLAG_') ||
      upperName.includes('ENABLED') ||
      upperName.includes('DISABLED')
    );
  }

  private formatSlim(flags: FeatureFlag[]): CommandResult {
    const lines = flags.map(flag =>
      `${flag.name.padEnd(25)} ${path.basename(flag.file)}:${flag.line}  default:${flag.defaultValue}`
    );

    const output = [
      ...lines,
      '---',
      `${flags.length} feature flags  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'config',
      action: 'flags',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: flags.length,
    };
  }

  private formatNormal(flags: FeatureFlag[]): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `feature-flags: ${flags.length}`,
      `===`
    ];

    for (const flag of flags) {
      sections.push(`${flag.name}  ${path.basename(flag.file)}:${flag.line}`);
      sections.push(`  default: ${flag.defaultValue}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'config',
      action: 'flags',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: flags.length,
    };
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
