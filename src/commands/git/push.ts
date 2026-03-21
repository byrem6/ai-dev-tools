import { Command } from '../../core/command';
import { CommandResult } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class GitPushCommand extends Command {
  public getDescription(): string {
    return 'Push commits to remote';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-push', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath, 'Initialize git repository with: git init');
      }

      return this.push(targetPath, options);
    });
  }

  private async push(repoPath: string, options: any): Promise<CommandResult> {
    const branch = GitUtils.getCurrentBranch(repoPath) || 'HEAD';
    const remote = options.remote || 'origin';
    const setUpstream = options.setUpstream || options.u;

    try {
      let cmd = `git push ${remote}`;
      if (options.branch) cmd += ` ${options.branch}`;
      if (setUpstream) cmd += ` --set-upstream`;
      if (options.force) cmd += ` --force`;
      if (options.tags) cmd += ` --tags`;

      const stdout = execSync(cmd, { cwd: repoPath, encoding: 'utf-8', stdio: 'pipe' });
      const output = this.formatPush(remote, branch, true, '', options);

      return {
        ok: true,
        command: 'git-push',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        remote,
        branch,
      };
    } catch (error: any) {
      const msg = (error.stderr || error.stdout || error.message || '').trim();
      const output = this.formatPush(remote, branch, false, msg, options);
      return {
        ok: false,
        command: 'git-push',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        remote,
        branch,
        error: msg,
      };
    }
  }

  private formatPush(remote: string, branch: string, success: boolean, error: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (!success) return `ok false  push failed\n${error.split('\n')[0]}`;
      return `ok true  pushed: ${branch} → ${remote}`;
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: success, command: 'git-push', remote, branch, error: error || undefined }, null, 2);
    } else {
      const lines: string[] = [`ok: ${success}`, `remote: ${remote}`, `branch: ${branch}`];
      if (!success && error) {
        lines.push('===');
        error.split('\n').slice(0, 5).forEach(l => lines.push(`  ${l}`));
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
      } else if (arg === '--force' || arg === '-f') {
        options.force = true;
      } else if (arg === '--set-upstream' || arg === '-u') {
        options.setUpstream = true;
      } else if (arg === '--tags') {
        options.tags = true;
      } else if (!arg.startsWith('--') && !options.remote) {
        options.remote = arg;
      } else if (!arg.startsWith('--') && !options.branch) {
        options.branch = arg;
      }
    }

    return options;
  }
}
