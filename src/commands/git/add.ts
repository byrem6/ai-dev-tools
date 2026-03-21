import { Command } from '../../core/command';
import { CommandResult } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class GitAddCommand extends Command {
  public getDescription(): string {
    return 'Stage files for commit';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-add', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath, 'Initialize git repository with: git init');
      }

      const files = options.files as string[];
      const all = options.all as boolean;

      if (!all && (!files || files.length === 0)) {
        throw createError('ENOMATCH', '', 'Specify files to stage or use --all');
      }

      return this.stageFiles(targetPath, files, all, options);
    });
  }

  private async stageFiles(repoPath: string, files: string[], all: boolean, options: any): Promise<CommandResult> {
    try {
      const args = all ? ['-A'] : files;
      execSync(`git add ${args.join(' ')}`, { cwd: repoPath, encoding: 'utf-8' });

      const statusAfter = GitUtils.getStatus(repoPath);
      const staged = statusAfter?.staged || [];
      const output = this.formatAdd(files, all, staged, true, options);

      return {
        ok: true,
        command: 'git-add',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        files: all ? ['all'] : files,
        staged: staged.length,
      };
    } catch (error: any) {
      const msg = error.stderr || error.message || 'git add failed';
      const output = this.formatAdd(files, all, [], false, options);
      return {
        ok: false,
        command: 'git-add',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        error: msg,
      };
    }
  }

  private formatAdd(files: string[], all: boolean, staged: string[], success: boolean, options: any): string {
    const fmt = options.fmt || 'normal';
    const target = all ? 'all files' : files.join(', ');

    if (fmt === 'slim') {
      if (!success) return `ok false  git add failed`;
      return `ok true  staged: ${target}  total-staged: ${staged.length}`;
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: success, command: 'git-add', target, staged }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${success}`);
      lines.push(`staged: ${target}`);
      if (staged.length > 0) {
        lines.push('===');
        staged.slice(0, 20).forEach(f => lines.push(`  ${f}`));
      }
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = { files: [] };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--all' || arg === '-A' || arg === '-a') {
        options.all = true;
      } else if (!arg.startsWith('--')) {
        options.files.push(arg);
      }
    }

    return options;
  }
}
