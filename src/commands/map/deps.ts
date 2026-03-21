import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface ImportInfo {
  source: string;
  isExternal: boolean;
  resolvedPath?: string;
  specifiers: string[];
  line: number;
  type: 'import' | 'require' | 'dynamic';
}

interface ExportInfo {
  name: string;
  type: 'class' | 'function' | 'interface' | 'type' | 'const' | 'enum';
  line: number;
  exported: boolean;
}

interface FileDeps {
  file: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export class DepsCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('deps', args, async () => {
      const targetPath = options.path || options.file || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.analyzeDeps(targetPath, options);
    });
  }

  private async analyzeDeps(targetPath: string, options: any): Promise<CommandResult> {
    const stats = fs.statSync(targetPath);
    const isFile = stats.isFile();

    let results: FileDeps[] = [];

    if (isFile) {
      const fileDeps = await this.analyzeFileDeps(targetPath);
      results = [fileDeps];
    } else {
      const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
        cwd: targetPath,
        onlyFiles: true,
        absolute: true,
        ignore: this.configManager.getExcludeGlobs(),
      });

      for (const file of files.slice(0, 50)) {
        try {
          const fileDeps = await this.analyzeFileDeps(file);
          results.push(fileDeps);
        } catch {
          // Skip files that can't be analyzed
        }
      }
    }

    if (options.whoImports) {
      results = await this.findWhoImports(targetPath, results, options);
    }

    if (options.circular) {
      const circular = await this.detectCircularDeps(results, options);
      return this.formatCircularDeps(circular, targetPath, options);
    }

    return this.formatDeps(results, targetPath, options);
  }

  private async analyzeFileDeps(filePath: string): Promise<FileDeps> {
    const content = FileUtils.readFile(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    const fileDir = path.dirname(filePath);

    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];

    const { ASTParser } = await import('../../parsers/typescript');
    const parser = new ASTParser(content);

    if (parser.isValid()) {
      const importData = parser.extractImports();
      const exportData = parser.extractExports();

      imports.push(...importData.map((imp: any) => ({
        source: imp.source,
        isExternal: this.isExternalImport(imp.source),
        resolvedPath: imp.resolvedPath,
        specifiers: imp.specifiers || [],
        line: imp.line,
        type: imp.type || 'import',
      })));

      exports.push(...exportData.map((exp: any) => ({
        name: exp.name,
        type: exp.type,
        line: exp.line,
        exported: exp.exported !== false,
      })));
    }

    return {
      file: relativePath,
      imports,
      exports,
    };
  }

  private isExternalImport(source: string): boolean {
    if (!source.startsWith('.') && !source.startsWith('/')) {
      return true;
    }
    return false;
  }

  private async findWhoImports(targetPath: string, results: FileDeps[], options: any): Promise<FileDeps[]> {
    const whoImports: FileDeps[] = [];
    const targetName = path.basename(targetPath, path.extname(targetPath));

    for (const fileDeps of results) {
      const importsTarget = fileDeps.imports.some(imp => {
        const importBasename = path.basename(imp.source, path.extname(imp.source));
        return importBasename === targetName || imp.resolvedPath === targetPath;
      });

      if (importsTarget) {
        whoImports.push(fileDeps);
      }
    }

    return whoImports;
  }

  private async detectCircularDeps(results: FileDeps[], options: any): Promise<any[]> {
    const graph: Map<string, string[]> = new Map();

    for (const fileDeps of results) {
      const internalImports = fileDeps.imports
        .filter(imp => !imp.isExternal)
        .map(imp => path.resolve(path.dirname(fileDeps.file), imp.source));

      graph.set(fileDeps.file, internalImports);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: any[] = [];

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const result = dfs(neighbor, [...path]);
          if (result) {
            circular.push(result);
          }
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          circular.push([...path.slice(cycleStart), neighbor]);
        }
      }

      recursionStack.delete(node);
      return null;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return circular;
  }

  private formatDeps(results: FileDeps[], targetPath: string, options: any): CommandResult {
    const lines: string[] = [];
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      results.forEach(fileDeps => {
        fileDeps.imports.forEach(imp => {
          const prefix = imp.isExternal ? 'IMPORT' : 'IMPORT';
          const external = imp.isExternal ? ' [external]' : ` [internal → ${imp.resolvedPath || '?'}]`;
          const specifiers = imp.specifiers.length > 0 ? ` ${imp.specifiers.join(',')}` : '';
          lines.push(`${prefix} ${imp.source}${specifiers}${external}`);
        });

        fileDeps.exports.forEach(exp => {
          lines.push(`EXPORT ${exp.type} ${exp.name} :${exp.line}`);
        });
      });
    } else if (fmt === 'json') {
      const content = JSON.stringify({
        ok: true,
        path: targetPath,
        dependencies: results,
      }, null, 2);

      return {
        ok: true,
        command: 'deps',
        tokenEstimate: TokenUtils.estimateTokens(content),
        content,
        results,
      };
    } else {
      lines.push(`ok: true`);
      lines.push(`path: ${targetPath}`);
      lines.push(`files: ${results.length}`);
      lines.push('===');

      results.slice(0, 20).forEach(fileDeps => {
        const externalImports = fileDeps.imports.filter(i => i.isExternal);
        const internalImports = fileDeps.imports.filter(i => !i.isExternal);

        if (fileDeps.imports.length > 0 || fileDeps.exports.length > 0) {
          lines.push(`${fileDeps.file}`);

          if (externalImports.length > 0) {
            const extNames = externalImports.map(i => {
              const name = i.source.split('/').pop();
              const specs = i.specifiers.length > 0 ? `(${i.specifiers.slice(0, 2).join(',')})` : '';
              return `${name}${specs}`;
            }).join('  ');
            lines.push(`  imports (external): ${extNames}`);
          }

          if (internalImports.length > 0) {
            lines.push(`  imports (internal): ${internalImports.length}`);
            internalImports.slice(0, 3).forEach(imp => {
              lines.push(`    ${imp.source} → ${imp.resolvedPath || '?'}`);
            });
          }

          if (fileDeps.exports.length > 0) {
            const exports = fileDeps.exports.map(e => `${e.type}:${e.name}`).slice(0, 3).join(', ');
            lines.push(`  exports: ${exports}`);
          }
        }
      });
    }

    const content = lines.join('\n');

    return {
      ok: true,
      command: 'deps',
      tokenEstimate: TokenUtils.estimateTokens(content),
      content,
      results,
    };
  }

  private formatCircularDeps(circular: any[], targetPath: string, options: any): CommandResult {
    const lines: string[] = [];
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (circular.length === 0) {
        lines.push('ok true  no circular dependencies');
      } else {
        lines.push(`ok false  ${circular.length} circular dependencies`);
        circular.forEach((cycle, i) => {
          lines.push(`cycle ${i + 1}: ${cycle.join(' → ')}`);
        });
      }
    } else if (fmt === 'json') {
      const content = JSON.stringify({
        ok: true,
        command: 'deps',
        circular,
        count: circular.length,
      }, null, 2);

      return {
        ok: true,
        command: 'deps',
        tokenEstimate: TokenUtils.estimateTokens(content),
        content,
        circular,
      };
    } else {
      lines.push(`ok: true`);
      lines.push(`circular dependencies: ${circular.length}`);
      lines.push('===');

      if (circular.length === 0) {
        lines.push('No circular dependencies found');
      } else {
        circular.forEach((cycle, i) => {
          lines.push(`Cycle ${i + 1}:`);
          lines.push(`  ${cycle.join(' → ')}`);
        });
      }
    }

    const content = lines.join('\n');

    return {
      ok: true,
      command: 'deps',
      tokenEstimate: TokenUtils.estimateTokens(content),
      content,
      circular,
    };
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--file') {
        options.file = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--who-imports') {
        options.whoImports = args[++i];
      } else if (arg === '--circular') {
        options.circular = true;
      } else if (arg === '--depth') {
        options.depth = parseInt(args[++i], 10);
      } else if (arg === '--external') {
        options.external = true;
      } else if (arg === '--internal') {
        options.internal = true;
      } else if (!options.path) {
        options.path = arg;
      }
    }

    return options;
  }
}
