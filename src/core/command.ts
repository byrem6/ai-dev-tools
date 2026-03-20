import { FormatManager } from './format';
import { ConfigManager } from './config';
import { SessionManager } from './session';
import { CommandResult, OutputFormat } from '../types';

export abstract class Command {
  protected formatManager: FormatManager;
  protected configManager: ConfigManager;
  protected sessionManager: SessionManager;

  constructor(
    formatManager: FormatManager,
    configManager: ConfigManager,
    sessionManager: SessionManager
  ) {
    this.formatManager = formatManager;
    this.configManager = configManager;
    this.sessionManager = sessionManager;
  }

  abstract execute(...args: string[]): Promise<CommandResult>;

  protected async runWithLogging(
    commandName: string,
    args: string[],
    fn: () => Promise<CommandResult>
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.sessionManager.logEvent(
        commandName,
        args,
        result.ok,
        result.tokenEstimate,
        duration
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.sessionManager.logEvent(
        commandName,
        args,
        false,
        undefined,
        duration
      );

      throw error;
    }
  }

  protected setFormat(format?: OutputFormat): void {
    if (format) {
      this.formatManager.setFormat(format);
    } else {
      this.formatManager.setFormat(this.configManager.getDefaultFormat());
    }
  }

  protected estimateTokens(str: string): number {
    return FormatManager.estimateTokens(str);
  }
}
