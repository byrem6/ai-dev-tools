import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

export class CallersCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('callers', args, async () => {
      if (!options.symbol) {
        throw createError('ENOMATCH', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findCallers(options.symbol, searchPath, options);
    });
  }

  private async findCallers(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const callers: any[] = [];
    const symbolLower = symbol.toLowerCase();

    for (const file of files.slice(0, 100)) {
      try {
        const content = FileUtils.readFile(file);
        const lines = content.split('\n');

        // First, check if symbol is defined in this file
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();
          const symbolDefs = symbols.filter(s => s.name.toLowerCase() === symbolLower);

          if (symbolDefs.length > 0) {
            // Found definition, now look for call sites
            const callSites = this.findCallSitesInFile(symbol, symbols, content, file);
            callers.push(...callSites);
          }
        }
      } catch (error) {
        // Skip files that can't be parsed
      }

      if (callers.length > 50) {
        break;
      }
    }

    if (callers.length === 0) {
      const output = this.formatNoCallers(symbol, options);
      return {
        ok: true,
        command: 'callers',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        callers: [],
        symbol,
        totalFound: 0,
      };
    }

    const output = this.formatCallers(callers, symbol, options);

    return {
      ok: true,
      command: 'callers',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      callers,
      symbol,
      totalFound: callers.length,
    };
  }

  private findCallSitesInFile(symbol: string, symbols: any[], content: string, filePath: string): any[] {
    const callers: any[] = [];
    const lines = content.split('\n');
    const symbolLower = symbol.toLowerCase();

    lines.forEach((line, i) => {
      if (this.isCommentOrString(line)) return;

      // Look for symbol usage: symbol.method(), symbol(), etc.
      const patterns = [
        new RegExp(`\\b${symbol}\\s*\\(`), // Direct call
        new RegExp(`\\b${symbol}\\s*\\.\\s*\\w+\\s*\\(`), // Method call
        new RegExp(`\\(\\s*['\"]${symbol}['\"]\\s*\\)`), // String reference
        new RegExp(`\\(\\s*\\w+\\s*,\\s*${symbol}\\s*[,)]`), // Parameter
      ];

      patterns.forEach(pattern => {
        const match = line.match(pattern);
        if (match) {
          // Check if this is actually a call site and not a definition
          const isDefinition = line.includes('function') || line.includes('class') || line.includes('=>');
          
          if (!isDefinition) {
            callers.push({
              file: filePath,
              line: i + 1,
              text: line.trim().substring(0, 100),
              context: this.getCallContext(lines, i, 3),
            });
          }
        }
      });
    });

    return callers;
  }

  private getCallContext(lines: string[], lineNum: number, context: number): string[] {
    const start = Math.max(0, lineNum - context);
    const end = Math.min(lines.length, lineNum + context + 1);
    
    const contextLines = [];
    for (let i = start; i < end; i++) {
      const prefix = i === lineNum ? '>' : ' ';
      contextLines.push(`${prefix} ${lines[i]}`);
    }

    return contextLines;
  }

  private isCommentOrString(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') ||
           trimmed.startsWith('*') ||
           trimmed.startsWith('/*') ||
           trimmed.startsWith('"') ||
           trimmed.startsWith("'") ||
           trimmed.startsWith('`');
  }

  private formatCallers(callers: any[], symbol: string, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      callers.forEach(caller => {
        lines.push(`${caller.file}:${caller.line}`);
        lines.push(`  ${caller.text}`);
      });
      
      const summary = `${callers.length} callers  ~${TokenUtils.estimateTokens(lines.join('\n'))} tokens`;
      lines.push('');
      lines.push(summary);
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        symbol,
        totalCallers: callers.length,
        callers: callers.map(c => ({
          file: c.file,
          line: c.line,
          text: c.text,
        })),
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`symbol: ${symbol}`);
      lines.push(`callers: ${callers.length}  ~${TokenUtils.estimateTokens('')} tokens`);
      lines.push('===');

      callers.forEach((caller, index) => {
        lines.push(`${caller.file}:${caller.line}`);
        lines.push(`  text: ${caller.text}`);
        
        if (caller.context && caller.context.length > 0) {
          lines.push('  context:');
          caller.context.forEach((ctx: string) => {
            lines.push(`    ${ctx}`);
          });
        }

        if (index < callers.length - 1) {
          lines.push('');
        }
      });
    }

    return lines.join('\n');
  }

  private formatNoCallers(symbol: string, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      lines.push(`0 callers`);
      lines.push(`~tokens:5`);
    } else {
      lines.push(`ok: true`);
      lines.push(`symbol: ${symbol}`);
      lines.push(`callers: 0`);
      lines.push(`~tokens:10`);
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      symbol: args[0],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--max' && nextArg) {
        options.max = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      } else if (!arg.startsWith('--') && options.path === undefined) {
        options.path = arg;
      }
    }

    return options;
  }
}
