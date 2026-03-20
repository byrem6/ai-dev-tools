import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

interface RefResult {
  file: string;
  line: number;
  col: number;
  text: string;
  type: 'DEF' | 'IMP' | 'USE';
}

export class RefsCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('refs', args, async () => {
      if (!options.symbol) {
        throw createError('ENOENT', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findReferences(options.symbol, searchPath, options);
    });
  }

  private async findReferences(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    const refs: RefResult[] = [];

    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const symbolLower = symbol.toLowerCase();

    for (const file of files) {
      try {
        const content = FileUtils.readFile(file);
        const lines = content.split('\n');

        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          // Find definitions
          const symbols = parser.extractSymbols();
          symbols.forEach(sym => {
            if (sym.name.toLowerCase() === symbolLower) {
              refs.push({
                file: file,
                line: sym.line,
                col: 1,
                text: `export ${sym.type} ${sym.name} {`,
                type: 'DEF',
              });
            }
          });

          // Find imports
          const imports = parser.extractImports();
          imports.forEach(imp => {
            imp.specifiers.forEach(spec => {
              if (spec.toLowerCase() === symbolLower) {
                refs.push({
                  file: file,
                  line: imp.line,
                  col: 1,
                  text: `import { ${spec} } from '${imp.source}'`,
                  type: 'IMP',
                });
              }
            });
          });

          // Find usages in code
          const importNames = new Set();
          imports.forEach(imp => {
            imp.specifiers.forEach(spec => importNames.add(spec));
          });

          lines.forEach((line, i) => {
            if (this.isCommentOrString(line)) return;

            const regex = new RegExp(`\\b${symbol}\\b`, 'g');
            const matches = line.match(regex);

            if (matches && !importNames.has(symbol)) {
              const col = line.indexOf(symbol) + 1;
              if (col > 0) {
                refs.push({
                  file: file,
                  line: i + 1,
                  col,
                  text: line.trim().substring(0, 100),
                  type: 'USE',
                });
              }
            }
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }

      if (refs.length > 100) {
        break;
      }
    }

    const output = this.formatRefs(refs, symbol, options);

    const defCount = refs.filter(r => r.type === 'DEF').length;
    const impCount = refs.filter(r => r.type === 'IMP').length;
    const useCount = refs.filter(r => r.type === 'USE').length;

    return {
      ok: true,
      command: 'refs',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      refs,
      symbol,
      totalRefs: refs.length,
      defCount,
      impCount,
      useCount,
    };
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

  private formatRefs(refs: RefResult[], symbol: string, options: any): string {
    const lines: string[] = [];

    const defs = refs.filter(r => r.type === 'DEF');
    const imps = refs.filter(r => r.type === 'IMP');
    const uses = refs.filter(r => r.type === 'USE');

    if (options.fmt === 'slim') {
      defs.forEach(ref => {
        lines.push(`DEF  ${ref.file}:${ref.line}:${ref.text}`);
      });
      imps.forEach(ref => {
        lines.push(`IMP  ${ref.file}:${ref.line}:${ref.text}`);
      });
      uses.forEach(ref => {
        lines.push(`USE  ${ref.file}:${ref.line}:${ref.text.substring(0, 80)}`);
      });
    } else {
      if (defs.length > 0) {
        lines.push('definitions:');
        defs.forEach(ref => {
          lines.push(`  ${ref.file}:${ref.line}  ${ref.text}`);
        });
      }

      if (imps.length > 0) {
        if (defs.length > 0) lines.push('');
        lines.push('imports:');
        imps.forEach(ref => {
          lines.push(`  ${ref.file}:${ref.line}  ${ref.text}`);
        });
      }

      if (uses.length > 0) {
        if (defs.length > 0 || imps.length > 0) lines.push('');
        lines.push('usages:');
        uses.forEach(ref => {
          lines.push(`  ${ref.file}:${ref.line}  ${ref.text.substring(0, 80)}`);
        });
      }
    }

    const summary = `${defs.length} def  ${imps.length} imports  ${uses.length} usages`;
    lines.push('');
    lines.push(`~tokens:${TokenUtils.estimateTokens(lines.join('\n'))}`);
    lines.push(summary);

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      symbol: args[0],
      path: args[1],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--type' && nextArg) {
        options.refType = nextArg;
        i++;
      } else if (arg === '--files-only') {
        options.filesOnly = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
