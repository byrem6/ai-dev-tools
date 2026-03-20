import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { ASTParser } from '../../parsers/typescript';

export class SymbolsCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('symbols', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.listSymbols(options.filePath, options);
    });
  }

  private async listSymbols(filePath: string, options: any): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const { ASTParser } = await import('../../parsers/typescript');
    const parser = new ASTParser(content);

    if (!parser.isValid()) {
      return this.listSymbolsBasic(filePath, content, options);
    }

    const symbols = parser.extractSymbols();
    const filtered = this.filterSymbols(symbols, options);

    const output = this.formatSymbols(filtered, filePath, options);

    return {
      ok: true,
      command: 'symbols',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      symbols: filtered,
      totalSymbols: filtered.length,
    };
  }

  private filterSymbols(symbols: any[], options: any): any[] {
    let filtered = [...symbols];

    if (options.type) {
      filtered = filtered.filter(s => s.type === options.type);
    }

    if (options.exported) {
      filtered = filtered.filter(s => s.exported);
    }

    return filtered;
  }

  private formatSymbols(symbols: any[], filePath: string, options: any): string {
    const lines: string[] = [];

    symbols.forEach(symbol => {
      if (options.fmt === 'slim') {
        let line = `${symbol.type}  ${symbol.name}`;
        
        if (symbol.line && symbol.end) {
          line += ` :${symbol.line}–${symbol.end}`;
        } else if (symbol.line) {
          line += ` :${symbol.line}`;
        }

        if (symbol.exported) {
          line += '  exported';
        }

        lines.push(line);

        if (symbol.members && symbol.members.length > 0) {
          symbol.members.forEach((member: any) => {
            let memberLine = '    ';
            
            if (member.type === 'method') {
              memberLine += 'meth  ';
            } else if (member.type === 'property') {
              memberLine += 'prop  ';
            } else {
              memberLine += `${member.type}  `;
            }

            memberLine += `${member.name}`;
            
            if (member.line && member.end) {
              memberLine += ` :${member.line}–${member.end}`;
            } else if (member.line) {
              memberLine += ` :${member.line}`;
            }

            if (member.async) {
              memberLine += '  async';
            }

            lines.push(memberLine);
          });
        }
      } else {
        let line = `${symbol.type} ${symbol.name}`;
        
        if (symbol.line) {
          line += `  lines ${symbol.line}`;
          if (symbol.end) {
            line += `–${symbol.end}`;
          }
        }

        if (symbol.exported) {
          line += '  [exported]';
        }

        if (symbol.params && symbol.params.length > 0) {
          line += `  (${symbol.params.join(', ')})`;
        }

        if (symbol.returns) {
          line += ` → ${symbol.returns}`;
        }

        lines.push(line);

        if (symbol.members && symbol.members.length > 0) {
          symbol.members.forEach((member: any) => {
            let memberLine = `    ${member.name}`;
            
            if (member.line) {
              memberLine += ` :${member.line}`;
            }

            if (member.async) {
              memberLine += '  async';
            }

            lines.push(memberLine);
          });
        }
      }
    });

    if (lines.length === 0) {
      lines.push('(no symbols found)');
    }

    return lines.join('\n');
  }

  private listSymbolsBasic(filePath: string, content: string, options: any): CommandResult {
    const lines: string[] = [];
    const contentLines = content.split('\n');

    contentLines.forEach((line, i) => {
      const trimmed = line.trim();

      const patterns = {
        function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        const: /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\w+)/,
        class: /^\s*(?:export\s+)?class\s+(\w+)/,
        interface: /^\s*interface\s+(\w+)/,
        type: /^\s*type\s+(\w+)/,
        enum: /^\s*enum\s+(\w+)/,
      };

      for (const [type, pattern] of Object.entries(patterns)) {
        const match = trimmed.match(pattern);
        if (match) {
          lines.push(`${type}  ${match[1]}  :${i + 1}`);
          break;
        }
      }
    });

    const output = lines.length > 0 ? lines.join('\n') : '(no symbols found)';

    return {
      ok: true,
      command: 'symbols',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      symbols: [],
      totalSymbols: lines.length,
    };
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      filePath: args[0],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--type' && nextArg) {
        options.type = nextArg;
        i++;
      } else if (arg === '--exported') {
        options.exported = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
