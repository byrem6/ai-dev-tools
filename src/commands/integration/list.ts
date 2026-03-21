import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface HTTPEndpoint {
  type: 'HTTP';
  file: string;
  line: number;
  method: string;
  url: string;
}

export class IntegrationListCommand extends Command {
  public getDescription(): string {
    return 'List external integrations';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt integration-list [path]',
      description: 'List all external HTTP API integrations',
      examples: [
        'adt integration-list src/',
        'adt integration-list --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('integration list', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const endpoints = await this.extractHTTPEndpoints(targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(endpoints);
      }

      return this.formatNormal(endpoints);
    });
  }

  private async extractHTTPEndpoints(targetPath: string): Promise<HTTPEndpoint[]> {
    const endpoints: HTTPEndpoint[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match HTTP calls: fetch, axios, http.get, etc.
        const httpPatterns = [
          /fetch\s*\(\s*['"`]([^'"`]+)['"`]/,
          /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
          /http\.(get|post|put|delete|request)\s*\(\s*['"`]([^'"`]+)['"`]/,
          /https?\.(get|post|put|delete|request)\s*\(\s*['"`]([^'"`]+)['"`]/,
          /request\s*\(\s*\{\s*method:\s*['"`](\w+)['"`],\s*uri:\s*['"`]([^'"`]+)['"`]/,
        ];

        for (const pattern of httpPatterns) {
          pattern.lastIndex = 0; // Reset regex state
          const match = pattern.exec(line);
          if (match) {
            const url = match[match.length - 1];
            const method = match[1] || 'GET';

            // Filter out localhost/internal URLs if needed
            if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
              endpoints.push({
                type: 'HTTP',
                file,
                line: i + 1,
                method: method.toUpperCase(),
                url,
              });
            }
          }
        }
      }
    }

    return endpoints;
  }

  private formatSlim(endpoints: HTTPEndpoint[]): CommandResult {
    const lines = endpoints.map(ep =>
      `${ep.type}  ${ep.file}:${ep.line}  ${ep.method} ${ep.url}`
    );

    const output = [
      ...lines,
      '---',
      `${endpoints.length} external HTTP integrations  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'integration',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
    };
  }

  private formatNormal(endpoints: HTTPEndpoint[]): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `integrations: ${endpoints.length}`,
      `===`
    ];

    for (const ep of endpoints) {
      sections.push(`${ep.type}  ${ep.file}:${ep.line}`);
      sections.push(`  ${ep.method}  ${ep.url}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'integration',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
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
