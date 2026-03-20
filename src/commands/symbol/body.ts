import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

export class BodyCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('body', args, async () => {
      if (!options.symbol) {
        throw createError('ENOMATCH', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findBody(options.symbol, searchPath, options);
    });
  }

  private async findBody(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const bodies: any[] = [];
    const symbolLower = symbol.toLowerCase();

    for (const file of files.slice(0, 50)) {
      try {
        const content = FileUtils.readFile(file);
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();

          symbols.forEach(sym => {
            if (sym.name.toLowerCase() === symbolLower && (sym.type === 'function' || sym.type === 'method')) {
              const body = this.extractBody(sym, content, file);
              bodies.push(body);
            }
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }

      if (bodies.length > 0 && !options.all) {
        break;
      }
    }

    if (bodies.length === 0) {
      throw createError('ENOMATCH', symbol, 'Try: adt def or adt grep');
    }

    const output = this.formatBodies(bodies, symbol, options);

    return {
      ok: true,
      command: 'body',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      bodies,
      symbol,
      totalFound: bodies.length,
    };
  }

  private extractBody(symbol: any, content: string, filePath: string): any {
    const lines = content.split('\n');
    const startLine = symbol.line - 1;
    const endLine = symbol.end ? symbol.end - 1 : this.findBodyEnd(lines, startLine);

    const bodyLines = lines.slice(startLine, endLine);
    const bodyText = bodyLines.join('\n');

    return {
      file: filePath,
      type: symbol.type,
      name: symbol.name,
      line: symbol.line,
      end: symbol.end || endLine + 1,
      body: bodyText,
      lineCount: bodyLines.length,
    };
  }

  private findBodyEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundBrace = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }

      if (braceCount === 0 && foundBrace && i > startLine + 5) {
        // Empty body or single line
        return i + 1;
      }
    }

    return lines.length;
  }

  private formatBodies(bodies: any[], symbol: string, options: any): string {
    const lines: string[] = [];

    bodies.forEach((body, index) => {
      if (options.fmt === 'slim') {
        lines.push(`${body.file}:${body.line}`);
        lines.push(`body :${body.line}–${body.end}  (${body.lineCount} lines)`);
        
        if (bodies.length > 1 && index < bodies.length - 1) {
          lines.push('');
        }
      } else if (options.fmt === 'json') {
        lines.push(JSON.stringify({
          file: body.file,
          type: body.type,
          name: body.name,
          line: body.line,
          end: body.end,
          lineCount: body.lineCount,
          body: body.body.substring(0, 200) + '...',
        }));
      } else {
        lines.push(`${body.file}`);
        lines.push(`  ${body.type} ${body.name}`);
        lines.push(`  lines: ${body.line}–${body.end}  (${body.lineCount} lines)`);
        
        if (options.withBody) {
          lines.push(`  body:`);
          const bodyLines = body.body.split('\n');
          const maxLines = options.maxLines || 20;
          
          bodyLines.slice(0, maxLines).forEach((line: string, i: number) => {
            lines.push(`    ${i + 1}  ${line}`);
          });

          if (bodyLines.length > maxLines) {
            lines.push(`    ... (${bodyLines.length - maxLines} more lines)`);
          }
        }

        if (bodies.length > 1 && index < bodies.length - 1) {
          lines.push('');
        }
      }
    });

    if (options.fmt !== 'json') {
      lines.push('');
      lines.push(`~tokens:${TokenUtils.estimateTokens(lines.join('\n'))}`);
    }

    return lines.join('\n').trim();
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      symbol: args[0],
      path: args[1],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--all') {
        options.all = true;
      } else if (arg === '--with-body') {
        options.withBody = true;
      } else if (arg === '--max-lines' && nextArg) {
        options.maxLines = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
