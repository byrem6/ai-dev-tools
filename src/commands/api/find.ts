import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface APIEndpoint {
  method: string;
  route: string;
  controller: string;
  file: string;
  line: number;
}

export class ApiFindCommand extends Command {
  public getDescription(): string {
    return 'Find API endpoints by pattern';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt api-find "<pattern>" [path]',
      description: 'Find API endpoints matching a pattern',
      examples: [
        'adt api-find "user" src/',
        'adt api-find "payment" --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('api find', args, async () => {
      if (!options.pattern) {
        throw createError('ENOENT', 'Pattern is required');
      }

      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const endpoints = await this.extractAPIEndpoints(targetPath);
      const filtered = this.filterByPattern(endpoints, options.pattern);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(filtered);
      }

      return this.formatNormal(filtered);
    });
  }

  private async extractAPIEndpoints(targetPath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      if (file.includes('controller') || file.includes('route')) {
        const content = fs.readFileSync(file, 'utf-8');
        const extracted = this.extractEndpointsFromFile(content, file);
        endpoints.push(...extracted);
      }
    }

    return endpoints;
  }

  private extractEndpointsFromFile(content: string, file: string): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    const lines = content.split('\n');

    const routePatterns = [
      /(\w+)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    let currentController = this.extractControllerName(file);
    let currentLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLine = i + 1;

      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const method = match[2] || match[1];
          const route = match[3] || match[2];

          endpoints.push({
            method: method.toUpperCase(),
            route,
            controller: currentController,
            file,
            line: currentLine,
          });
        }
      }
    }

    return endpoints;
  }

  private extractControllerName(file: string): string {
    const basename = file.split('/').pop()?.replace('.ts', '') || '';
    return basename.replace(/controller/i, '');
  }

  private filterByPattern(endpoints: APIEndpoint[], pattern: string): APIEndpoint[] {
    const lowerPattern = pattern.toLowerCase();

    return endpoints.filter(ep =>
      ep.route.toLowerCase().includes(lowerPattern) ||
      ep.controller.toLowerCase().includes(lowerPattern) ||
      ep.method.toLowerCase().includes(lowerPattern)
    );
  }

  private formatSlim(endpoints: APIEndpoint[]): CommandResult {
    const lines = endpoints.map(ep =>
      `${ep.method.padEnd(6)} ${ep.route.padEnd(30)} ${ep.controller} :${ep.file}:${ep.line}`
    );

    const output = [
      ...lines,
      '---',
      `${endpoints.length} matches  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'find',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
    };
  }

  private formatNormal(endpoints: APIEndpoint[]): CommandResult {
    const sections: string[] = [];

    sections.push(`ok: true`);
    sections.push(`pattern: ${endpoints[0]?.route || 'N/A'}  matches: ${endpoints.length}  ~tokens: ${this.estimateTokens(sections.join('\n'))}`);
    sections.push(`===`);

    for (const ep of endpoints) {
      sections.push(`${ep.method}  ${ep.route}  ${ep.controller}  :${ep.file}:${ep.line}`);
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'find',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
    };
  }

  private parseArgs(args: string[]): { pattern?: string; path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (!arg.startsWith('--')) {
        options.pattern = arg;
      }
    }

    return options;
  }
}
