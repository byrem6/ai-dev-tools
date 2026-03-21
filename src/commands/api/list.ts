import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface APIEndpoint {
  method: string;
  route: string;
  controller: string;
  file: string;
  line: number;
  auth?: string;
  validation?: string;
}

export class ApiListCommand extends Command {
  public getDescription(): string {
    return 'List all HTTP API endpoints';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt api-list [path]',
      description: 'List all HTTP API endpoints in the project',
      examples: [
        'adt api-list src/',
        'adt api-list --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('api list', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const endpoints = await this.extractAPIEndpoints(targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(endpoints);
      }

      return this.formatNormal(endpoints);
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

    // Express-style route patterns: app.get('/path', ...), router.post('/path', ...)
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
        // Reset regex state for each line
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const method = match[2] || match[1];
          const route = match[3] || match[2];

          // Filter out non-HTTP methods
          if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
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
    }

    return endpoints;
  }

  private extractControllerName(file: string): string {
    // Extract filename with proper path handling
    const normalizedPath = file.replace(/\\/g, '/');
    const basename = normalizedPath.split('/').pop()?.replace('.ts', '') || '';
    const basenameWithoutController = basename.replace(/controller/i, '');

    if (!basenameWithoutController) {
      return basename.charAt(0).toUpperCase() + basename.slice(1) + 'Controller';
    }

    return basenameWithoutController.charAt(0).toUpperCase() + basenameWithoutController.slice(1) + 'Controller';
  }

  private formatSlim(endpoints: APIEndpoint[]): CommandResult {
    const lines = endpoints.map(ep =>
      `${ep.method.padEnd(6)} ${ep.route.padEnd(30)} ${ep.controller}.${ep.method.toLowerCase()} :${ep.file}:${ep.line}`
    );

    const output = [
      ...lines,
      '---',
      `${endpoints.length} endpoints  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
    };
  }

  private formatNormal(endpoints: APIEndpoint[]): CommandResult {
    const routesByPath = this.groupByPath(endpoints);
    const sections: string[] = [];

    sections.push(`ok: true`);
    sections.push(`framework: express  endpoints: ${endpoints.length}  controllers: ${new Set(endpoints.map(e => e.controller)).size}  ~tokens: ${this.estimateTokens(sections.join('\n'))}`);
    sections.push(`===`);

    for (const [routePath, routeEndpoints] of Object.entries(routesByPath)) {
      sections.push(routePath);
      for (const ep of routeEndpoints) {
        const auth = ep.auth ? `  [auth: ${ep.auth}]` : '';
        const validation = ep.validation ? `  [validate: ${ep.validation}]` : '';
        sections.push(`  ${ep.method.padEnd(6)} → ${ep.controller.padEnd(30)} :${ep.line}${auth}${validation}`);
      }
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: endpoints.length,
    };
  }

  private groupByPath(endpoints: APIEndpoint[]): Record<string, APIEndpoint[]> {
    const grouped: Record<string, APIEndpoint[]> = {};

    for (const ep of endpoints) {
      const basePath = ep.route.split('/').slice(0, 3).join('/');
      if (!grouped[basePath]) {
        grouped[basePath] = [];
      }
      grouped[basePath].push(ep);
    }

    return grouped;
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
