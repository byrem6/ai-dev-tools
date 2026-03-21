import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class WhichCommand extends Command {
  public getDescription(): string {
    return 'Locate command paths';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('which', args, async () => {
      if (!options.commands || options.commands.length === 0) {
        throw createError('ENOMATCH', '', 'Command names required');
      }

      return this.findCommands(options.commands, options);
    });
  }

  private async findCommands(commands: string[], options: any): Promise<CommandResult> {
    const results: any[] = [];

    commands.forEach(cmd => {
      try {
        let command = '';
        if (process.platform === 'win32') {
          command = `where ${cmd}`;
        } else {
          command = `which ${cmd}`;
        }

        const output = execSync(command, {
          encoding: 'utf-8',
        });

        const path = output.trim().split('\n')[0];
        let version = '';
        
        try {
          const versionCmd = process.platform === 'win32' ? `${cmd} --version` : `${cmd} --version`;
          version = execSync(versionCmd, { encoding: 'utf-8' }).trim().split('\n')[0];
        } catch {
          version = 'unknown';
        }

        results.push({
          command: cmd,
          path,
          version,
          found: true,
        });
      } catch {
        results.push({
          command: cmd,
          path: null,
          version: null,
          found: false,
        });
      }
    });

    const output = this.formatWhich(results, options);

    return {
      ok: true,
      command: 'which',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      results,
    };
  }

  private formatWhich(results: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      results.forEach(r => {
        if (r.found) {
          lines.push(`${r.command}: ${r.path}`);
        } else {
          lines.push(`${r.command}: not found`);
        }
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'which',
        results,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push('===');

      results.forEach(r => {
        if (r.found) {
          lines.push(`${r.command}:`);
          lines.push(`  path: ${r.path}`);
          if (r.version) lines.push(`  version: ${r.version}`);
        } else {
          lines.push(`${r.command}: not found`);
        }
      });

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = { commands: [] };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else {
        options.commands.push(arg);
      }
    }

    return options;
  }
}
