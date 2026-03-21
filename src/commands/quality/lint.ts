import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';
import * as path from 'path';

export class LintCommand extends Command {
  public getDescription(): string {
    return 'Run linter';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('lint', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runLint(targetPath, options);
    });
  }

  private async runLint(targetPath: string, options: any): Promise<CommandResult> {
    const linter = this.detectLinter(targetPath);
    
    if (!linter) {
      throw createError('EEXEC', '', 'No linter found. Install eslint or similar');
    }

    try {
      let command = '';
      if (linter === 'eslint') {
        command = 'npx eslint';
        if (options.fix) command += ' --fix';
        if (options.ext) command += ` --ext ${options.ext}`;
        command += ` ${targetPath}`;
      }

      const stdout = execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
      });

      const issues: any[] = [];
      if (stdout.trim()) {
        stdout.split('\n').forEach(line => {
          const match = line.match(/^([^:]+):(\d+):(\d+):\s+(.+)$/);
          if (match) {
            issues.push({
              file: match[1],
              line: parseInt(match[2], 10),
              col: parseInt(match[3], 10),
              message: match[4],
            });
          }
        });
      }

      const output = this.formatLint(issues, linter, options);

      return {
        ok: true,
        command: 'lint',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        linter,
        issues,
        total: issues.length,
        fixed: options.fix ? 'some' : 'none',
      };
    } catch (error: any) {
      const stderr = error.stderr || error.stdout || '';
      const issues: any[] = [];
      
      stderr.split('\n').forEach((line: string) => {
        const match = line.match(/^([^:]+):(\d+):(\d+):\s+(.+)$/);
        if (match) {
          issues.push({
            file: match[1],
            line: parseInt(match[2], 10),
            col: parseInt(match[3], 10),
            message: match[4],
          });
        }
      });

      const output = this.formatLint(issues, linter, options);

      return {
        ok: issues.length === 0,
        command: 'lint',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        linter,
        issues,
        total: issues.length,
      };
    }
  }

  private detectLinter(targetPath: string): string | null {
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (FileUtils.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
      
      if (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint) {
        return 'eslint';
      }
      
      if (packageJson.devDependencies?.pylint || packageJson.dependencies?.pylint) {
        return 'pylint';
      }
    }
    
    return null;
  }

  private formatLint(issues: any[], linter: string | null, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (issues.length === 0) {
        lines.push(`ok true  no issues`);
      } else {
        issues.forEach(issue => {
          lines.push(`${issue.file}:${issue.line}:${issue.col}  ${issue.message.substring(0, 60)}`);
        });
        lines.push(`---`);
        lines.push(`${issues.length} issues`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: issues.length === 0,
        command: 'lint',
        linter,
        issues,
        total: issues.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${issues.length === 0 ? 'true' : 'false'}`);
      lines.push(`linter: ${linter || 'none'}  issues: ${issues.length}`);
      lines.push('===');

      issues.slice(0, 50).forEach(issue => {
        lines.push(`${issue.file}:${issue.line}:${issue.col}  ${issue.message}`);
      });

      if (issues.length > 50) {
        lines.push(`... ${issues.length - 50} more issues`);
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
      } else if (arg === '--fix') {
        options.fix = true;
      } else if (arg === '--ext') {
        options.ext = args[++i];
      }
    }

    return options;
  }
}
