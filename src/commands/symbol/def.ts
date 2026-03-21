import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

export class DefCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('def', args, async () => {
      if (!options.symbol) {
        throw createError('ENOMATCH', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findDefinition(options.symbol, searchPath, options);
    });
  }

  private async findDefinition(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const definitions: any[] = [];
    const symbolLower = symbol.toLowerCase();

    for (const file of files.slice(0, 100)) {
      try {
        const content = FileUtils.readFile(file);
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();

          symbols.forEach(sym => {
            if (sym.name.toLowerCase() === symbolLower) {
              const definition = this.extractDefinitionDetails(sym, content, file);
              definitions.push(definition);
            }
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }

      if (definitions.length > 0 && !options.all) {
        break;
      }
    }

    if (definitions.length === 0) {
      throw createError('ENOMATCH', symbol, 'Try: adt refs or adt grep');
    }

    const output = this.formatDefinitions(definitions, symbol, options);

    return {
      ok: true,
      command: 'def',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      definitions,
      symbol,
      totalFound: definitions.length,
    };
  }

  private extractDefinitionDetails(symbol: any, content: string, filePath: string): any {
    const lines = content.split('\n');
    const startLine = symbol.line - 1;
    
    let signature = '';
    let params: string[] = [];
    let returnType = '';
    let bodyStart = symbol.line;
    let bodyEnd = symbol.end || startLine + 10;

    for (let i = startLine; i < bodyEnd && i < lines.length; i++) {
      const line = lines[i];
      signature += line;

      if (line.includes('{')) {
        bodyEnd = i + 1;
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

    // Extract class context
    let classContext = null;
    const symbolMatch = content.substring(0, content.indexOf(signature)).match(/class\s+(\w+)/);
    if (symbolMatch) {
      classContext = symbolMatch[1];
    }

    return {
      file: filePath,
      type: symbol.type,
      name: symbol.name,
      line: symbol.line,
      end: symbol.end,
      signature: signature.replace(/\{[\s\S]*/, '').trim(),
      params,
      returnType,
      async: symbol.async || false,
      exported: symbol.exported,
      class: classContext,
      bodyStart,
      bodyEnd,
    };
  }

  private formatDefinitions(definitions: any[], symbol: string, options: any): string {
    const lines: string[] = [];

    definitions.forEach(def => {
      if (options.fmt === 'slim') {
        let line = `${def.file}:${def.line}:`;
        
        if (def.class) {
          line += `${def.class}.${def.name}(`;
        } else {
          line += `${def.type} ${def.name}(`;
        }

        if (def.params && def.params.length > 0) {
          line += `${def.params.join(', ')}`;
        }

        if (def.returnType) {
          line += `): ${def.returnType}`;
        } else {
          line += ')';
        }

        lines.push(line);
        lines.push(`body :${def.line}-${def.end}  (${def.end - def.line + 1} lines)`);
      } else if (options.fmt === 'json') {
        lines.push(JSON.stringify(def));
      } else {
        lines.push(`${def.file}`);
        lines.push(`  type: ${def.type}${def.exported ? ' [exported]' : ''}`);
        lines.push(`  lines: ${def.line}-${def.end}  (${def.end - def.line + 1} lines)`);
        
        if (def.class) {
          lines.push(`  class: ${def.class}`);
        }

        lines.push(`  sig: ${def.signature.replace(/\{[\s\S]*/, '').trim()}`);
        
        if (def.params && def.params.length > 0) {
          lines.push(`  params: ${def.params.join(', ')}`);
        }

        if (def.returnType) {
          lines.push(`  returns: ${def.returnType}`);
        }

        if (def.async) {
          lines.push(`  async: true`);
        }

        if (definitions.length > 1) {
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
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--all') {
        options.all = true;
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
