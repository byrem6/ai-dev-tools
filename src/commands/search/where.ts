import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class WhereCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('where', args, async () => {
      if (!options.query) {
        throw createError('ENOENT', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findWhere(options.query, searchPath, options);
    });
  }

  private async findWhere(query: string, searchPath: string, options: any): Promise<CommandResult> {
    const results: any[] = [];

    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    if (options.type === 'file' || options.type === 'both') {
      const files = await this.findFiles(query, searchPath);
      results.push(...files.map(f => ({
        type: 'file',
        path: f,
        lines: FileUtils.getFileInfo(f).totalLines,
      })));
    }

    if (options.type === 'symbol' || options.type === 'both') {
      const symbols = await this.findSymbols(query, searchPath);
      results.push(...symbols);
    }

    const output = this.formatResults(results, query, options);

    return {
      ok: true,
      command: 'where',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      results,
      query,
      totalFound: results.length,
    };
  }

  private async findFiles(query: string, searchPath: string): Promise<string[]> {
    const files = await fg.glob('**/*', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const queryLower = query.toLowerCase();
    
    return files
      .filter((file: string) => {
        const basename = path.basename(file).toLowerCase();
        return basename.includes(queryLower) || basename === queryLower;
      })
      .slice(0, 20);
  }

  private async findSymbols(query: string, searchPath: string): Promise<any[]> {
    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const symbols: any[] = [];
    const queryLower = query.toLowerCase();

    for (const file of files.slice(0, 50)) {
      try {
        const content = FileUtils.readFile(file);
        
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);
        
        if (parser.isValid()) {
          const extractedSymbols = parser.extractSymbols();
          
          extractedSymbols.forEach(symbol => {
            if (symbol.name.toLowerCase() === queryLower || 
                symbol.name.toLowerCase().includes(queryLower)) {
              symbols.push({
                type: 'symbol',
                symbolType: symbol.type,
                name: symbol.name,
                file: file,
                line: symbol.line,
                exported: symbol.exported,
              });
            }
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    return symbols.slice(0, 20);
  }

  private formatResults(results: any[], query: string, options: any): string {
    const lines: string[] = [];

    results.forEach(result => {
      if (options.fmt === 'slim') {
        if (result.type === 'file') {
          lines.push(`file  ${result.path}  ${result.lines} lines`);
        } else if (result.type === 'symbol') {
          lines.push(`sym   ${result.symbolType} ${result.name} :${result.line}  ${result.file}`);
        }
      } else {
        if (result.type === 'file') {
          lines.push(`${result.path}  (${result.lines} lines)`);
        } else if (result.type === 'symbol') {
          const exportInfo = result.exported ? ' [exported]' : '';
          lines.push(`${result.symbolType} ${result.name}:${result.line}${exportInfo}`);
          lines.push(`  → ${result.file}`);
        }
      }
    });

    if (lines.length > 0) {
      lines.push(``);
      lines.push(`~tokens:${TokenUtils.estimateTokens(lines.join('\n'))}`);
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      query: args[0],
      path: args[1],
      type: 'both',
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--type' && nextArg) {
        if (['file', 'symbol', 'both'].includes(nextArg)) {
          options.type = nextArg;
        }
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
