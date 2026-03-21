import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface DeprecatedUsage {
  file: string;
  line: number;
  deprecated: string;
  replacement?: string;
}

export class MigrateScanCommand extends Command {
  public getDescription(): string {
    return 'Scan for deprecated APIs';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt migrate-scan <package> [path]',
      description: 'Scan for deprecated API usage in a package',
      examples: [
        'adt migrate-scan express src/',
        'adt migrate-scan lodash --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('migrate scan', args, async () => {
      if (!options.package) {
        throw createError('ENOENT', 'Package name is required');
      }

      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const usages = await this.scanDeprecatedAPI(options.package, targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(options.package, usages);
      }

      return this.formatNormal(options.package, usages);
    });
  }

  private async scanDeprecatedAPI(packageName: string, targetPath: string): Promise<DeprecatedUsage[]> {
    const usages: DeprecatedUsage[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    // Common deprecated APIs by package
    const deprecatedAPIs = this.getDeprecatedAPIs(packageName);

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const api of deprecatedAPIs) {
          if (line.includes(api.pattern)) {
            usages.push({
              file,
              line: i + 1,
              deprecated: api.pattern,
              replacement: api.replacement,
            });
          }
        }
      }
    }

    return usages;
  }

  private getDeprecatedAPIs(packageName: string): Array<{ pattern: string; replacement: string }> {
    const commonDeprecated: Record<string, Array<{ pattern: string; replacement: string }>> = {
      express: [
        { pattern: 'app.del(', replacement: 'app.delete(' },
        { pattern: 'res.send(status,', replacement: 'res.status(status).send(' },
        { pattern: 'bodyParser', replacement: 'express.json()' },
      ],
      lodash: [
        { pattern: '_.assign', replacement: 'Object.assign' },
        { pattern: '_.flattenDeep', replacement: '_.flatten' },
      ],
      react: [
        { pattern: 'ReactDOM.render', replacement: 'ReactDOM.createRoot' },
        { pattern: 'componentWillMount', replacement: 'componentDidMount or useEffect' },
      ],
    };

    return commonDeprecated[packageName.toLowerCase()] || [];
  }

  private formatSlim(packageName: string, usages: DeprecatedUsage[]): CommandResult {
    if (usages.length === 0) {
      const output = `ok true  ${packageName}  no deprecated API usage found`;
      return {
        ok: true,
        command: 'migrate',
        action: 'scan',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        package: packageName,
        usages,
      };
    }

    const lines = usages.map(u =>
      `${u.file}:${u.line}  ${u.deprecated}  → ${u.replacement || 'N/A'}`
    );

    const output = [
      `ok false  ${packageName}  ${usages.length} deprecated usages`,
      ...lines,
      '---',
      `Run: adt migrate-plan ${packageName} for migration guide`
    ].join('\n');

    return {
      ok: false,
      command: 'migrate',
      action: 'scan',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      package: packageName,
      usages,
    };
  }

  private formatNormal(packageName: string, usages: DeprecatedUsage[]): CommandResult {
    const sections: string[] = [];

    if (usages.length === 0) {
      const output = `ok: true\npackage: ${packageName}\ndeprecated-usages: 0\n===\nNo deprecated API usage found.`;
      return {
        ok: true,
        command: 'migrate',
        action: 'scan',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        package: packageName,
        usages,
      };
    }

    sections.push(`ok: false`);
    sections.push(`package: ${packageName}`);
    sections.push(`deprecated-usages: ${usages.length}`);
    sections.push(`===`);

    for (const u of usages) {
      sections.push(`${u.file}:${u.line}`);
      sections.push(`  deprecated: ${u.deprecated}`);
      sections.push(`  replacement: ${u.replacement || 'Check migration guide'}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: false,
      command: 'migrate',
      action: 'scan',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      package: packageName,
      usages,
    };
  }

  private parseArgs(args: string[]): { package?: string; path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.package = arg;
      }
    }

    return options;
  }
}
