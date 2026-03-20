import { CommandResult, OutputFormat, ErrorResult } from '../types';
import { AdtError } from './error';

export class FormatManager {
  private format: OutputFormat;

  constructor(format: OutputFormat = 'normal') {
    this.format = format;
  }

  setFormat(format: OutputFormat): void {
    this.format = format;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  output(result: CommandResult | ErrorResult | AdtError): string {
    if (result instanceof AdtError) {
      return this.formatError(result);
    }

    if ('ok' in result && !result.ok && 'content' in result && !result.content) {
      return this.formatError(result as ErrorResult);
    }

    switch (this.format) {
      case 'slim':
        return this.toSlim(result);
      case 'normal':
        return this.toNormal(result);
      case 'json':
        return this.toJson(result);
    }
  }

  private formatError(error: AdtError | ErrorResult): string {
    if (error instanceof AdtError) {
      switch (this.format) {
        case 'slim':
          return error.toSlim();
        case 'normal':
          return error.toNormal();
        case 'json':
          return error.toJson();
      }
    }

    const err = error as ErrorResult;
    switch (this.format) {
      case 'slim':
        return `ok false\n${err.code} ${err.path || ''}\ntip: ${err.tip || ''}`;
      case 'normal':
        return `ok: false\nerror: ${err.error}\ncode: ${err.code}${err.path ? `\npath: ${err.path}` : ''}${err.tip ? `\ntip: ${err.tip}` : ''}`;
      case 'json':
        return JSON.stringify(err, null, 2);
    }
  }

  private toSlim(result: CommandResult): string {
    if (!result.ok) {
      return 'ok false';
    }

    let output = 'ok true';
    if (result.tokenEstimate) {
      output += `\n~tokens:${result.tokenEstimate}`;
    }
    if (result.content) {
      output += `\n${result.content}`;
    }
    return output;
  }

  private toNormal(result: CommandResult): string {
    if (!result.ok && !result.content) {
      return 'ok: false';
    }

    let output = `ok: ${result.ok ? 'true' : 'false'}`;
    if (result.command) {
      output += `\ncommand: ${result.command}`;
    }
    if (result.file) {
      output += `\nfile: ${result.file}`;
    }
    if (result.lines !== undefined) {
      output += `\nlines: ${result.lines}`;
    }
    if (result.totalLines !== undefined) {
      output += `\ntotal: ${result.totalLines}`;
    }
    if (result.hasMore !== undefined) {
      output += `\nhasMore: ${result.hasMore}`;
    }
    if (result.tokenEstimate) {
      output += `\n~tokens: ${result.tokenEstimate}`;
    }
    if (result.content) {
      output += `\n---\n${result.content}`;
    }
    return output;
  }

  private toJson(result: CommandResult): string {
    return JSON.stringify(result, null, 2);
  }

  static estimateTokens(str: string): number {
    return Math.ceil(str.length / 4);
  }

  static formatMatch(
    file: string,
    line: number,
    col: number,
    text: string,
    format: OutputFormat
  ): string {
    if (format === 'slim') {
      return `${file}:${line}:${col}:${text}`;
    }
    if (format === 'json') {
      return JSON.stringify({ file, line, col, text });
    }
    return `${file}:${line}:${col}  ${text}`;
  }

  static formatLocation(
    file: string,
    line: number,
    col?: number
  ): string {
    if (col) {
      return `${file}:${line}:${col}`;
    }
    return `${file}:${line}`;
  }
}
