import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { PlatformUtils } from '../../utils/platform';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class ExecCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('exec', args, async () => {
      if (!options.command && !args[0]) {
        throw createError('ENOMATCH', '', 'Usage: adt exec <command>');
      }

      const cmd = options.command || args[0];
      return this.executeCommand(cmd, options);
    });
  }

  private async executeCommand(command: string, options: any): Promise<CommandResult> {
    const platform = PlatformUtils.getPlatformInfo();
    let shell = 'bash';
    
    if (options.shell) {
      shell = options.shell;
    } else     if (platform.platform === 'win32') {
      shell = 'powershell';
    }

    let fullCommand = command;
    if (shell === 'powershell' && !command.startsWith('powershell')) {
      fullCommand = `powershell -Command "${command}"`;
    }

    try {
      const cwd = options.cwd || process.cwd();
      const timeout = options.timeout || 30000;
      const startTime = Date.now();
      
      const stdout = execSync(fullCommand, {
        cwd,
        encoding: 'utf-8',
        timeout,
        env: { ...process.env, ...options.env },
        maxBuffer: 10 * 1024 * 1024,
      });
      const duration = Date.now() - startTime;

      const output = this.formatOutput(stdout, '', 0, command, shell, cwd, duration, options);

      return {
        ok: true,
        command: 'exec',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        exitCode: 0,
        stdout,
        stderr: '',
        success: true,
        duration,
        timedOut: false,
      };
    } catch (error: any) {
      const startTime = Date.now();
      const duration = Date.now() - startTime;
      const stderr = error.stderr || '';
      const exitCode = error.status || 1;
      
      const output = this.formatOutput(error.stdout || '', stderr, exitCode, command, shell, options.cwd || process.cwd(), duration, options);

      return {
        ok: exitCode === 0,
        command: 'exec',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        exitCode,
        stdout: error.stdout || '',
        stderr,
        success: exitCode === 0,
        duration,
        timedOut: error.killed,
      };
    }
  }

  private formatOutput(stdout: string, stderr: string, exitCode: number, command: string, shell: string, cwd: string, duration: number, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (exitCode === 0) {
        lines.push(`ok true  exit:${exitCode}  ${duration}ms`);
      } else {
        lines.push(`ok false  exit:${exitCode}  ${duration}ms`);
      }
      
      if (stdout.trim()) {
        lines.push(stdout.trim());
      }
      
      if (stderr.trim()) {
        lines.push(`stderr: ${stderr.trim().split('\n')[0]}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: exitCode === 0,
        command,
        shell,
        exitCode,
        success: exitCode === 0,
        stdout,
        stderr,
        duration,
        timedOut: false,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${exitCode === 0 ? 'true' : 'false'}`);
      lines.push(`command: ${command}`);
      lines.push(`shell: ${shell}  cwd: ${cwd}`);
      lines.push(`exit: ${exitCode}  duration: ${duration}ms`);
      
      if (stdout.trim()) {
        lines.push('---');
        lines.push('stdout:');
        lines.push(stdout.trim());
      }
      
      if (stderr.trim()) {
        lines.push('---');
        lines.push('stderr:');
        lines.push(stderr.trim());
      }
      
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--shell') {
        options.shell = args[++i];
      } else if (arg === '--cwd') {
        options.cwd = args[++i];
      } else if (arg === '--env') {
        options.env = args[++i];
      } else if (arg === '--timeout') {
        options.timeout = parseInt(args[++i], 10);
      } else if (!options.command) {
        options.command = arg;
      }
    }

    return options;
  }
}
