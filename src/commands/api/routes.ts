import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface RouteInfo {
  route: string;
  method: string;
  handlers: Array<{
    file: string;
    line: number;
    functionName?: string;
  }>;
}

export class ApiRoutesCommand extends Command {
  public getDescription(): string {
    return 'Show detailed routing information';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt api-routes [path]',
      description: 'Show detailed routing information with handlers',
      examples: [
        'adt api-routes src/',
        'adt api-routes --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('api routes', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const routes = await this.extractAllRoutes(targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(routes);
      }

      return this.formatNormal(routes);
    });
  }

  private async extractAllRoutes(targetPath: string): Promise<RouteInfo[]> {
    const routes: Map<string, RouteInfo> = new Map();
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      if (file.includes('route') || file.includes('controller')) {
        const content = fs.readFileSync(file, 'utf-8');
        this.extractRoutesFromFile(content, file, routes);
      }
    }

    return Array.from(routes.values());
  }

  private extractRoutesFromFile(content: string, file: string, routes: Map<string, RouteInfo>): void {
    const lines = content.split('\n');

    // Match route definitions: app.get('/path', handler), router.post('/path', handler1, handler2)
    const routePatterns = [
      /(\w+)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const app = match[1];
          const method = match[2].toUpperCase();
          const routePath = match[3];
          const handlers = match[4];

          const routeKey = `${method}:${routePath}`;

          if (!routes.has(routeKey)) {
            routes.set(routeKey, {
              route: routePath,
              method,
              handlers: [],
            });
          }

          const routeInfo = routes.get(routeKey)!;

          // Parse handler names
          const handlerNames = handlers
            .split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0);

          for (const handler of handlerNames) {
            routeInfo.handlers.push({
              file,
              line: lineNum,
              functionName: handler,
            });
          }
        }
      }
    }
  }

  private formatSlim(routes: RouteInfo[]): CommandResult {
    const lines = routes.map(r =>
      `${r.method.padEnd(6)} ${r.route.padEnd(30)} ${r.handlers.length} handlers`
    );

    const output = [
      ...lines,
      '---',
      `${routes.length} routes  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'routes',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: routes.length,
    };
  }

  private formatNormal(routes: RouteInfo[]): CommandResult {
    const sections: string[] = [];

    sections.push(`ok: true`);
    sections.push(`routes: ${routes.length}  ~tokens: ${this.estimateTokens(sections.join('\n'))}`);
    sections.push(`===`);

    for (const route of routes) {
      sections.push(`${route.method}  ${route.route}`);
      for (const handler of route.handlers) {
        const fnName = handler.functionName ? `  ${handler.functionName}` : '  (anonymous)';
        sections.push(`  ${fnName}  → ${handler.file}:${handler.line}`);
      }
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'api',
      action: 'routes',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: routes.length,
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
