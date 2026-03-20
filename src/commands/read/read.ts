import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class ReadCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('read', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      if (options.info) {
        return this.showInfo(options.filePath);
      }

      if (options.around) {
        return this.readAround(options.filePath, options.around, options.context || 20);
      }

      if (options.head) {
        return this.readHead(options.filePath, options.head);
      }

      if (options.tail) {
        return this.readTail(options.filePath, options.tail);
      }

      if (options.start || options.end || options.lines) {
        return this.readRange(options.filePath, options.start, options.end, options.lines);
      }

      if (options.fn) {
        return this.readFunctionByName(options.filePath, options.fn);
      }

      return this.readAll(options.filePath, options.lines || this.configManager.get('defaultLines'));
    });
  }

  private async readFunctionByName(filePath: string, functionName: string): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const { ASTParser } = await import('../../parsers/typescript');
    const parser = new ASTParser(content);

    if (!parser.isValid()) {
      throw createError('ENOMATCH', functionName, `Function '${functionName}' not found in ${filePath}`);
    }

    const symbols = parser.extractSymbols();
    const funcSymbol = symbols.find(s =>
      s.name === functionName &&
      (s.type === 'function' || s.type === 'method')
    );

    if (!funcSymbol) {
      throw createError('ENOMATCH', functionName, `Function '${functionName}' not found in ${filePath}`);
    }

    const lines = content.split('\n');
    const startLine = funcSymbol.line || 1;
    const endLine = funcSymbol.end || startLine;

    const functionLines = lines.slice(startLine - 1, endLine);
    const output = functionLines.map((line, i) => `${startLine + i}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      function: functionName,
      lines: functionLines.length,
      startLine,
      endLine,
      totalLines: lines.length,
    };
  }

  private async showInfo(filePath: string): Promise<CommandResult> {
    const info = FileUtils.getFileInfo(filePath);
    
    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokensForObject(info),
    };
  }

  private async readAround(filePath: string, lineNum: number, context: number): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const start = Math.max(1, lineNum - context);
    const end = Math.min(lines.length, lineNum + context);

    const selectedLines = lines.slice(start - 1, end);
    const output = selectedLines.map((line, i) => `${start + i}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: selectedLines.length,
      startLine: start,
      endLine: end,
      aroundLine: lineNum,
      totalLines: lines.length,
    };
  }

  private async readHead(filePath: string, n: number): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const selectedLines = lines.slice(0, n);
    const output = selectedLines.map((line, i) => `${i + 1}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: selectedLines.length,
      totalLines: lines.length,
    };
  }

  private async readTail(filePath: string, n: number): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const start = Math.max(0, lines.length - n);
    const selectedLines = lines.slice(start);
    const output = selectedLines.map((line, i) => `${start + i + 1}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: selectedLines.length,
      totalLines: lines.length,
      startLine: start + 1,
    };
  }

  private async readRange(
    filePath: string,
    start?: number,
    end?: number,
    lines?: number
  ): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const allLines = content.split('\n');

    const readStart = start || 1;
    let readEnd = end;

    if (lines) {
      readEnd = readStart + lines - 1;
    }

    if (!readEnd || readEnd > allLines.length) {
      readEnd = allLines.length;
    }

    const selectedLines = allLines.slice(readStart - 1, readEnd);
    const output = selectedLines.map((line, i) => `${readStart + i}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: selectedLines.length,
      startLine: readStart,
      endLine: readEnd,
      totalLines: allLines.length,
    };
  }

  private async readAll(filePath: string, lines: number): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const allLines = content.split('\n');

    const selectedLines = allLines.slice(0, lines);
    const output = selectedLines.map((line, i) => `${i + 1}  ${line}`).join('\n');

    return {
      ok: true,
      command: 'read',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: selectedLines.length,
      totalLines: allLines.length,
      hasMore: allLines.length > lines,
    };
  }

  private parseArgs(args: string[]): {
    filePath: string;
    start?: number;
    end?: number;
    lines?: number;
    head?: number;
    tail?: number;
    around?: number;
    context?: number;
    fn?: string;
    info?: boolean;
    encoding?: string;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };
    
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--start' && nextArg) {
        options.start = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--end' && nextArg) {
        options.end = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--lines' && nextArg) {
        options.lines = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--head' && nextArg) {
        options.head = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--tail' && nextArg) {
        options.tail = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--around' && nextArg) {
        options.around = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--context' && nextArg) {
        options.context = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--fn' && nextArg) {
        options.fn = nextArg;
        i++;
      } else if (arg === '--info') {
        options.info = true;
      } else if (arg === '--encoding' && nextArg) {
        options.encoding = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }

  private async readFunction(filePath: string, fnName: string): Promise<CommandResult> {
    throw createError('ENOMATCH', fnName, 'Function reading not implemented yet');
  }
}
