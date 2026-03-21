import { CommandResult, OutputFormat } from '../types';
import { TokenUtils } from '../utils/token';

export class Logger {
  private static instance: Logger;
  private enabled: boolean = true;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.enabled && this.logLevel === 'debug') {
      this.log('DEBUG', message, args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled && ['debug', 'info'].includes(this.logLevel)) {
      this.log('INFO', message, args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.enabled && ['debug', 'info', 'warn'].includes(this.logLevel)) {
      this.log('WARN', message, args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.enabled) {
      this.log('ERROR', message, args);
    }
  }

  private log(level: string, message: string, args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;

    if (args.length > 0) {
      console.error(`${prefix} ${message}`, ...args);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }

  static toCommandResult(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    args: any[] = [],
    format: OutputFormat = 'normal'
  ): CommandResult {
    const timestamp = new Date().toISOString();
    const content = `[${timestamp}] [${level.toUpperCase()}] ${message}${
      args.length > 0 ? ' ' + JSON.stringify(args) : ''
    }`;

    return {
      ok: true,
      command: 'log',
      tokenEstimate: TokenUtils.estimateTokens(content),
      content,
      level,
      message,
      timestamp,
    };
  }
}
