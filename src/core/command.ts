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

  protected getCommandName(): string {
    return this.constructor.name.replace('Command', '').toLowerCase();
  }

  public getDescription(): string {
    return '';
  }

  public showHelp(options?: { usage?: string; description?: string; examples?: string[] }): CommandResult {
    const commandName = this.getCommandName();
    const usage = options?.usage || `adt ${commandName} [options]`;
    const description = options?.description || this.getDescription() || `${commandName} command`;
    const examples = options?.examples || [];

    let content = `Usage: ${usage}\n\n`;
    content += `Description: ${description}\n\n`;
    content += `Options:\n`;
    content += `  --fmt <format>  Output format (slim|normal|json) (default: normal)\n`;
    content += `  --help         Show this help message`;

    if (examples.length > 0) {
      content += `\n\nExamples:\n`;
      for (const example of examples) {
        content += `  ${example}\n`;
      }
    }

    return {
      ok: true,
      command: commandName,
      tokenEstimate: this.estimateTokens(content),
      content,
    };
  }

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
