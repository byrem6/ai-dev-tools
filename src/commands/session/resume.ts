import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ResumeCommand extends Command {
  public getDescription(): string {
    return 'Resume last session';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('resume', args, async () => {
      const homeDir = os.homedir();
      const adtDir = path.join(homeDir, '.adt');
      const sessionFile = path.join(adtDir, 'session.json');
      
      // Check if session file exists
      if (!fs.existsSync(sessionFile)) {
        return {
          ok: true,
          command: 'resume',
          tokenEstimate: 20,
          content: this.formatNoSession(options),
        };
      }

      try {
        const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        return this.formatSession(sessionData, options);
      } catch (error) {
        return {
          ok: false,
          command: 'resume',
          tokenEstimate: 30,
          content: `Error reading session: ${error}`,
        };
      }
    });
  }

  private formatSession(sessionData: any, options: any): CommandResult {
    const lines: string[] = [];
    
    if (options.fmt === 'slim') {
      lines.push(`ok true`);
      lines.push(`project: ${sessionData.projectPath || process.cwd()}`);
      lines.push(`started: ${sessionData.startTime || 'unknown'}`);
      lines.push(`commands: ${sessionData.commandCount || 0}`);
      if (sessionData.lastCommand) {
        lines.push(`last: ${sessionData.lastCommand}`);
      }
      if (sessionData.context && Object.keys(sessionData.context).length > 0) {
        lines.push(`context: ${Object.keys(sessionData.context).length} keys`);
      }
    } else if (options.fmt === 'json') {
      return {
        ok: true,
        command: 'resume',
        tokenEstimate: 150,
        content: JSON.stringify({
          ok: true,
          command: 'resume',
          session: sessionData,
        }, null, 2),
      };
    } else {
      lines.push('ok: true');
      lines.push('command: resume');
      lines.push('---');
      
      if (sessionData.projectPath) {
        lines.push(`project: ${sessionData.projectPath}`);
      }
      
      if (sessionData.startTime) {
        lines.push(`started: ${sessionData.startTime}`);
      }
      
      if (sessionData.lastCommand) {
        lines.push(`last command: ${sessionData.lastCommand}`);
      }
      
      if (sessionData.commandCount) {
        lines.push(`total commands: ${sessionData.commandCount}`);
      }
      
      if (sessionData.context && Object.keys(sessionData.context).length > 0) {
        lines.push('---');
        lines.push('context:');
        Object.entries(sessionData.context).forEach(([key, value]: [string, any]) => {
          lines.push(`  ${key}: ${value}`);
        });
      }
      
      if (sessionData.tasks && sessionData.tasks.length > 0) {
        lines.push('---');
        lines.push('active tasks:');
        sessionData.tasks.forEach((task: any) => {
          const status = task.status === 'in_progress' ? '→' : '✓';
          lines.push(`  ${status} ${task.title}`);
        });
      }
    }

    const content = lines.join('\n');
    return {
      ok: true,
      command: 'resume',
      tokenEstimate: TokenUtils.estimateTokens(content),
      content,
      sessionData,
    };
  }

  private formatNoSession(options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\nno active session`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'resume',
        session: null,
        message: 'No active session found',
      }, null, 2);
    } else {
      return `ok: true\nmessage: No active session found. Start working to create a session.`;
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      }
    }

    return options;
  }
}
