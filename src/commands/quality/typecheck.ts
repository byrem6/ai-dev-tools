import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class TypecheckCommand extends Command {
  public getDescription(): string {
    return 'Type checking';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('typecheck', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runTypecheck(targetPath, options);
    });
  }

  private async runTypecheck(targetPath: string, options: any): Promise<CommandResult> {
    const tsconfigPath = require('path').join(targetPath, 'tsconfig.json');
    
    if (!FileUtils.fileExists(tsconfigPath)) {
      throw createError('EEXEC', '', 'tsconfig.json not found');
    }

    try {
      const command = 'npx tsc --noEmit';
      const stdout = execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
      });

      const output = this.formatTypecheck([], true, options);

      return {
        ok: true,
        command: 'typecheck',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        errors: [],
        passed: true,
      };
    } catch (error: any) {
      const stderr = error.stderr || error.stdout || '';
      const errors = this.parseTypecheckErrors(stderr);

      const output = this.formatTypecheck(errors, errors.length === 0, options);

      return {
        ok: errors.length === 0,
        command: 'typecheck',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        errors,
        passed: errors.length === 0,
      };
    }
  }

  private parseTypecheckErrors(output: string): any[] {
    const errors: any[] = [];
    const lines = output.split('\n');

    lines.forEach(line => {
      const match = line.match(/^([^:]+):(\d+):(\d+)\s+error\s+TS(\d+):\s+(.+)$/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          col: parseInt(match[3], 10),
          code: `TS${match[4]}`,
          message: match[5],
        });
      }
    });

    return errors;
  }

  private formatTypecheck(errors: any[], passed: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (passed) {
        lines.push(`ok true  no type errors`);
      } else {
        lines.push(`ok false  ${errors.length} type errors`);
        errors.slice(0, 20).forEach(e => {
          lines.push(`${e.file}:${e.line}:${e.col}  ${e.message.substring(0, 60)}`);
        });
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: passed,
        command: 'typecheck',
        errors,
        passed,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${passed ? 'true' : 'false'}`);
      
      if (passed) {
        lines.push('no type errors');
      } else {
        lines.push(`errors: ${errors.length}`);
        lines.push('===');

        errors.slice(0, 50).forEach(e => {
          lines.push(`${e.file}:${e.line}:${e.col}`);
          lines.push(`  ${e.code}  ${e.message}`);
        });

        if (errors.length > 50) {
          lines.push(`... ${errors.length - 50} more errors`);
        }
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
      }
    }

    return options;
  }
}
