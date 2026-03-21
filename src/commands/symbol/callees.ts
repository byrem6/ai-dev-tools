import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as path from 'path';

export class CalleesCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('callees', args, async () => {
      if (!options.symbol) {
        throw createError('ENOMATCH', '');
      }

      const searchPath = options.path || process.cwd();
      return this.findCallees(options.symbol, searchPath, options);
    });
  }

  private async findCallees(symbol: string, searchPath: string, options: any): Promise<CommandResult> {
    // First, find the symbol definition
    const symbolDef = await this.findSymbolDefinition(symbol, searchPath);
    
    if (!symbolDef) {
      throw createError('ENOMATCH', symbol, 'Try: adt def or adt grep');
    }

    // Then, analyze what it calls
    const callees = await this.analyzeCallees(symbolDef);

    const output = this.formatCallees(callees, symbol, symbolDef, options);

    return {
      ok: true,
      command: 'callees',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      callees,
      symbol,
      symbolDef,
      totalFound: callees.length,
    };
  }

  private async findSymbolDefinition(symbol: string, searchPath: string): Promise<any> {
    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const symbolLower = symbol.toLowerCase();

    for (const file of files.slice(0, 50)) {
      try {
        const content = FileUtils.readFile(file);
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();

          for (const sym of symbols) {
            if (sym.name.toLowerCase() === symbolLower) {
              return {
                file,
                symbol: sym,
                content,
              };
            }
          }
        }
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    return null;
  }

  private async analyzeCallees(symbolDef: any): Promise<any[]> {
    const content = symbolDef.content;
    const lines = content.split('\n');
    const startLine = symbolDef.symbol.line - 1;
    const endLine = symbolDef.symbol.end ? symbolDef.symbol.end - 1 : this.findBodyEnd(lines, startLine);

    const bodyLines = lines.slice(startLine, endLine);
    const bodyText = bodyLines.join('\n');

    const callees: any[] = [];

    // Find function calls, property access, and identifier usage
    const callPattern = /(\w+)\s*\(/g;
    const propertyPattern = /(\w+)\.\s*(\w+)/g;
    const identifierPattern = /\b([A-Z][a-zA-Z0-9]*)\b|\b([a-z_][a-zA-Z0-9]*)\b/g;

    const uniqueCallees = new Set<string>();

    // Find function/method calls
    let match;
    while ((match = callPattern.exec(bodyText)) !== null) {
      const callee = match[1];
      if (callee && 
          callee !== 'if' && 
          callee !== 'while' && 
          callee !== 'for' && 
          callee !== 'switch' &&
          callee !== 'catch' &&
          callee !== 'function') {
        uniqueCallees.add(callee);
      }
    }

    // Find property access
    while ((match = propertyPattern.exec(bodyText)) !== null) {
      const object = match[1];
      const property = match[2];
      if (object && property) {
        uniqueCallees.add(`${object}.${property}`);
      }
    }

    // Categorize callees
    const categorized = {
      internal: [] as any[],
      external: [] as any[],
      builtIn: [] as string[],
    };

    uniqueCallees.forEach(callee => {
      if (this.isBuiltin(callee)) {
        categorized.builtIn.push(callee);
      } else if (this.isInternal(callee, symbolDef.file)) {
        categorized.internal.push({
          name: callee,
          type: 'internal',
        });
      } else {
        categorized.external.push({
          name: callee,
          type: 'external',
        });
      }
    });

    return [...categorized.internal, ...categorized.external, ...categorized.builtIn];
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
    }

    return lines.length;
  }

  private isBuiltin(name: string): boolean {
    const builtins = [
      'console', 'console.log', 'console.error', 'console.warn',
      'Math', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'JSON', 'Promise', 'setTimeout', 'setInterval',
      'require', 'module', 'exports', 'process',
    ];
    return builtins.includes(name) || name.startsWith('Math.') || name.startsWith('JSON.');
  }

  private isInternal(name: string, currentFile: string): boolean {
    // Simple heuristic - assume it's internal if it's a known type
    const internalTypes = ['String', 'Number', 'Boolean', 'Array', 'Object', 'Promise', 'Map', 'Set'];
    return !internalTypes.includes(name);
  }

  private formatCallees(callees: any[], symbol: string, symbolDef: any, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      const internal = callees.filter(c => c.type === 'internal');
      const external = callees.filter(c => c.type === 'external');
      
      internal.forEach(callee => {
        lines.push(`→ ${callee.name}  [internal]`);
      });
      
      external.forEach(callee => {
        lines.push(`→ ${callee.name}  [external]`);
      });

      if (callees.length === 0) {
        lines.push('(no callees found)');
      }
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        symbol,
        definition: {
          file: symbolDef.file,
          line: symbolDef.symbol.line,
          type: symbolDef.symbol.type,
        },
        callees,
        totalCallees: callees.length,
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`symbol: ${symbol}`);
      lines.push(`file: ${symbolDef.file}`);
      lines.push(`line: ${symbolDef.symbol.line}`);
      lines.push(`callees: ${callees.length}  ~tokens: ${TokenUtils.estimateTokens('')}`);
      lines.push('===');

      const internal = callees.filter(c => c.type === 'internal');
      const external = callees.filter(c => c.type === 'external');
      const builtIn = callees.filter(c => typeof c === 'string');

      if (internal.length > 0) {
        lines.push('internal:');
        internal.forEach(callee => {
          lines.push(`  → ${callee.name}`);
        });
      }

      if (external.length > 0) {
        if (internal.length > 0) lines.push('');
        lines.push('external:');
        external.forEach(callee => {
          lines.push(`  → ${callee.name}`);
        });
      }

      if (builtIn.length > 0) {
        if (internal.length > 0 || external.length > 0) lines.push('');
        lines.push('built-in:');
        builtIn.forEach(callee => {
          lines.push(`  → ${callee}`);
        });
      }
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

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      } else if (!arg.startsWith('--') && options.path === undefined) {
        options.path = arg;
      }
    }

    return options;
  }
}
