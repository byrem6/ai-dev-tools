import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

export class SigCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'slim');

    return this.runWithLogging('sig', args, async () => {
      if (!options.symbol) {
        throw createError('ENOMATCH', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findSignature(options.symbol, searchPath, options);
    });
  }

  private async findSignature(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    let files: string[] = [];
    
    // Check if searchPath is a file or directory
    const pathStats = FileUtils.fileExists(searchPath) ? 
      require('fs').statSync(searchPath) : null;
    
    if (pathStats && pathStats.isFile()) {
      // Single file
      files = [searchPath];
    } else if (pathStats && pathStats.isDirectory()) {
      // Directory - use glob
      files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
        cwd: searchPath,
        onlyFiles: true,
        absolute: true,
        ignore: this.configManager.get('excludeByDefault'),
      });
    } else {
      throw createError('ENOENT', searchPath);
    }

    const signatures: any[] = [];
    const symbolLower = symbol.toLowerCase();

    for (const file of files) {
      try {
        const content = FileUtils.readFile(file);

        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();

          symbols.forEach(sym => {
            if (sym.name.toLowerCase() === symbolLower) {
              const sig = this.extractSignature(sym, content);
              if (sig) {
                signatures.push({
                  file: file,
                  line: sig.line,
                  signature: sig.signature,
                  params: sig.params,
                  returnType: sig.returnType,
                  async: sym.async || false,
                  type: sym.type,
                });
              }
            }
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }

      if (signatures.length > 0 && !options.all) {
        break;
      }
    }

    if (signatures.length === 0) {
      throw createError('ENOMATCH', symbol, 'Try: adt refs or adt grep');
    }

    const output = this.formatSignatures(signatures, symbol, options);

    return {
      ok: true,
      command: 'sig',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      signatures,
      symbol,
      totalFound: signatures.length,
    };
  }

  private extractSignature(symbol: any, content: string): any {
    const lines = content.split('\n');
    const startLine = symbol.line - 1;
    const endLine = symbol.end ? symbol.end - 1 : startLine + 10;
    
    let signature = '';
    let params: string[] = [];
    let returnType = '';

    for (let i = startLine; i <= endLine && i < lines.length; i++) {
      const line = lines[i];
      signature += line;

      if (line.includes('{')) {
        break;
      }
    }

    // Extract parameters
    const paramsMatch = signature.match(/\(([^)]*)\)/);
    if (paramsMatch) {
      params = paramsMatch[1].split(',').map((p: string) => p.trim()).filter((p: string) => p);
    }

    // Extract return type
    const returnMatch = signature.match(/:\s*([A-Z][\w<>[\],\s]*)/);
    if (returnMatch) {
      returnType = returnMatch[1].trim();
    }

    // Clean up signature
    signature = signature
      .replace(/\{[\s\S]*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      line: symbol.line,
      signature,
      params,
      returnType,
    };
  }

  private formatSignatures(signatures: any[], symbol: string, options: any): string {
    const lines: string[] = [];

    signatures.forEach(sig => {
      if (options.fmt === 'slim') {
        lines.push(`${sig.file}:${sig.line}`);
        lines.push(sig.signature);
      } else if (options.fmt === 'json') {
        lines.push(JSON.stringify(sig));
      } else {
        lines.push(`${sig.file}:${sig.line}`);
        lines.push(`  ${sig.signature}`);
        
        if (sig.params && sig.params.length > 0) {
          lines.push('  Parameters:');
          sig.params.forEach((p: string) => {
            lines.push(`    - ${p}`);
          });
        }

        if (sig.returnType) {
          lines.push(`  Returns: ${sig.returnType}`);
        }
      }

      if (options.fmt !== 'json') {
        lines.push('');
      }
    });

    if (options.fmt !== 'json') {
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
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
