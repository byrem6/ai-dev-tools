import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class RunCommand extends Command {
  public getDescription(): string {
    return 'Run project scripts';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('run', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runScript(targetPath, options);
    });
  }

  private async runScript(targetPath: string, options: any): Promise<CommandResult> {
    let command = '';
    let scriptName = '';

    if (options.script.startsWith('npm:')) {
      scriptName = options.script.substring(4);
      command = `npm run ${scriptName}`;
    } else if (options.script.startsWith('npx:')) {
      scriptName = options.script.substring(4);
      command = `npx ${scriptName}`;
    } else {
      command = options.script;
    }

    const startTime = Date.now();
    let duration: number;

    try {
      const { execSync } = require('child_process');
      const stdout = execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
        timeout: options.timeout || 120000,
      });
      duration = Date.now() - startTime;

      const output = this.formatOutput(stdout, '', 0, command, duration, options);

      return {
        ok: true,
        command: 'run',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        script: options.script,
        exitCode: 0,
        stdout,
        stderr: '',
        success: true,
        duration,
      };
    } catch (error: any) {
      duration = Date.now() - (startTime || Date.now());
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      const exitCode = error.status || 1;

      const output = this.formatOutput(stdout, stderr, exitCode, command, duration, options);

      return {
        ok: exitCode === 0,
        command: 'run',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        script: options.script,
        exitCode,
        stdout,
        stderr,
        success: exitCode === 0,
        duration,
      };
    }
  }

  private formatOutput(stdout: string, stderr: string, exitCode: number, command: string, duration: number, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (exitCode === 0) {
        lines.push(`ok true  exit:${exitCode}  ${duration}ms`);
      } else {
        lines.push(`ok false  exit:${exitCode}  ${duration}ms`);
      }
      
      if (stdout.trim()) {
        lines.push(stdout.trim().split('\n')[0]);
      }
      
      if (stderr.trim()) {
        lines.push(`stderr: ${stderr.trim().split('\n')[0]}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: exitCode === 0,
        command,
        exitCode,
        success: exitCode === 0,
        stdout,
        stderr,
        duration,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${exitCode === 0 ? 'true' : 'false'}`);
      lines.push(`script: ${options.script}`);
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
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--timeout') {
        options.timeout = parseInt(args[++i], 10);
      } else if (!options.script) {
        options.script = arg;
      }
    }

    return options;
  }
}
