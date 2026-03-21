import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class QuickCommand extends Command {
  public getDescription(): string {
    return 'Quick project analysis';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'slim');

    return this.runWithLogging('quick', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.performQuickAnalysis(targetPath, options);
    });
  }

  private async performQuickAnalysis(targetPath: string, options: any): Promise<CommandResult> {
    const query = options.query || '';
    
    if (!query) {
      return this.provideQuickOverview(targetPath, options);
    }

    const results = await this.quickSearch(targetPath, query, options);
    
    const output = this.formatQuickResults(results, query, options);

    return {
      ok: true,
      command: 'quick',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      query,
      results,
      total: results.length,
    };
  }

  private async provideQuickOverview(targetPath: string, options: any): Promise<CommandResult> {
    const stats = await this.getProjectStats(targetPath);
    const importantFiles = await this.getImportantFiles(targetPath);
    
    const output = this.formatQuickOverview(stats, importantFiles, options);

    return {
      ok: true,
      command: 'quick',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      stats,
      importantFiles,
    };
  }

  private async quickSearch(targetPath: string, query: string, options: any): Promise<any[]> {
    const results: any[] = [];
    const queryLower = query.toLowerCase();

    // Fast search in filenames
    const files = await fg.glob('**/*', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    for (const file of files.slice(0, 100)) {
      if (file.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'file',
          path: file,
          match: 'filename',
        });
      }
    }

    // Fast search in symbol names
    const tsFiles = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    for (const file of tsFiles.slice(0, 50)) {
      try {
        const content = FileUtils.readFile(path.join(targetPath, file));
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();
          
          symbols.forEach((sym: any) => {
            if (sym.name.toLowerCase().includes(queryLower)) {
              results.push({
                type: 'symbol',
                file,
                symbol: sym.name,
                line: sym.line,
                kind: sym.type,
              });
            }
          });
        }
      } catch {
        // Skip files that can't be parsed
      }

      if (results.length >= 20) {
        break;
      }
    }

    return results.slice(0, 20);
  }

  private async getProjectStats(targetPath: string): Promise<any> {
    const files = await fg.glob('**/*', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const extCounts: Map<string, number> = new Map();
    let totalLines = 0;

    for (const file of files.slice(0, 200)) {
      try {
        const ext = path.extname(file).substring(1) || '(no ext)';
        extCounts.set(ext, (extCounts.get(ext) || 0) + 1);

        const filePath = path.join(targetPath, file);
        if (FileUtils.fileExists(filePath)) {
          const info = FileUtils.getFileInfo(filePath);
          totalLines += info.totalLines;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      extensionBreakdown: Object.fromEntries(extCounts),
    };
  }

  private async getImportantFiles(targetPath: string): Promise<any[]> {
    const important: any[] = [];
    
    const files = await fg.glob('**/*.{ts,tsx,js,jsx,json}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    // Prioritize: package.json, index files, main files
    const prioritized = files.sort((a, b) => {
      const aPriority = this.getFilePriority(a);
      const bPriority = this.getFilePriority(b);
      return bPriority - aPriority;
    });

    for (const file of prioritized.slice(0, 10)) {
      try {
        const filePath = path.join(targetPath, file);
        const info = FileUtils.getFileInfo(filePath);
        
        important.push({
          file,
          lines: info.totalLines,
          size: info.size,
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return important;
  }

  private getFilePriority(filename: string): number {
    if (filename === 'package.json') return 100;
    if (filename.endsWith('index.ts') || filename.endsWith('index.js')) return 90;
    if (filename.includes('main')) return 80;
    if (filename.includes('app')) return 70;
    if (filename.includes('config')) return 60;
    return 50;
  }

  private formatQuickOverview(stats: any, importantFiles: any[], options: any): string {
    const fmt = options.fmt || 'slim';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`files: ${stats.totalFiles}  lines: ${stats.totalLines}`);
      
      const exts = Object.entries(stats.extensionBreakdown) as [string, number][];
      exts.sort(([, a], [, b]) => b - a);
      exts.slice(0, 5);
      
      exts.forEach(([ext, count]) => {
        lines.push(`${ext}: ${count} files`);
      });

      if (importantFiles.length > 0) {
        lines.push(`important:`);
        importantFiles.slice(0, 5).forEach((f: any) => {
          lines.push(`  ${f.file}  ${f.lines} lines`);
        });
      }

      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'quick',
        stats,
        importantFiles,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`files: ${stats.totalFiles}  lines: ${stats.totalLines}`);
      lines.push('===');

      const exts2 = Object.entries(stats.extensionBreakdown) as [string, number][];
      exts2.sort(([, a], [, b]) => b - a);
      exts2.slice(0, 10);
      
      exts2.forEach(([ext, count]) => {
        lines.push(`  .${ext}  ${count} files`);
      });

      if (importantFiles.length > 0) {
        lines.push('');
        lines.push('important files:');
        importantFiles.forEach((f: any) => {
          lines.push(`  ${f.file}  ${f.lines} lines  ${f.size} bytes`);
        });
      }

      return lines.join('\n');
    }
  }

  private formatQuickResults(results: any[], query: string, options: any): string {
    const fmt = options.fmt || 'slim';

    if (fmt === 'slim') {
      const lines: string[] = [];
      
      results.forEach(r => {
        if (r.type === 'file') {
          lines.push(`file  ${r.path}`);
        } else if (r.type === 'symbol') {
          lines.push(`sym   ${r.file}:${r.line}  ${r.symbol}`);
        }
      });

      lines.push(`---`);
      lines.push(`total: ${results.length} matches`);

      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'quick',
        query,
        results,
        total: results.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`query: ${query}`);
      lines.push(`matches: ${results.length}`);
      lines.push('===');

      results.forEach(r => {
        if (r.type === 'file') {
          lines.push(r.path);
        } else if (r.type === 'symbol') {
          lines.push(`${r.file}:${r.line}  ${r.kind}  ${r.symbol}`);
        }
      });

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--query' || arg === '-q') {
        options.query = args[++i];
      } else if (!options.query) {
        options.query = arg;
      }
    }

    return options;
  }
}
