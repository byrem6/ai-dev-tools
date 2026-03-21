import { Command } from '../../core/command';
import { CommandResult } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class GitPullCommand extends Command {
  public getDescription(): string {
    return 'Pull changes from remote';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-pull', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath, 'Initialize git repository with: git init');
      }

      return this.pull(targetPath, options);
    });
  }

  private async pull(repoPath: string, options: any): Promise<CommandResult> {
    const branch = GitUtils.getCurrentBranch(repoPath) || 'HEAD';
    const remote = options.remote || 'origin';

    try {
      let cmd = `git pull ${remote}`;
      if (options.branch) cmd += ` ${options.branch}`;
      if (options.rebase) cmd += ` --rebase`;
      if (options.ff) cmd += ` --ff-only`;

      const stdout = execSync(cmd, { cwd: repoPath, encoding: 'utf-8', stdio: 'pipe' });
      const summary = this.parsePullOutput(stdout);
      const output = this.formatPull(remote, branch, true, summary, '', options);

      return {
        ok: true,
        command: 'git-pull',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        remote,
        branch,
        ...summary,
      };
    } catch (error: any) {
      const msg = (error.stderr || error.stdout || error.message || '').trim();
      const output = this.formatPull(remote, branch, false, {}, msg, options);
      return {
        ok: false,
        command: 'git-pull',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        remote,
        branch,
        error: msg,
      };
    }
  }

  private parsePullOutput(output: string): { filesChanged?: number; insertions?: number; deletions?: number; upToDate?: boolean } {
    if (output.includes('Already up to date') || output.includes('up-to-date')) {
      return { upToDate: true };
    }
    const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    if (statsMatch) {
      return {
        filesChanged: parseInt(statsMatch[1] || '0', 10),
        insertions: parseInt(statsMatch[2] || '0', 10),
        deletions: parseInt(statsMatch[3] || '0', 10),
      };
    }
    return {};
  }

  private formatPull(remote: string, branch: string, success: boolean, summary: any, error: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (!success) return `ok false  pull failed\n${error.split('\n')[0]}`;
      if (summary.upToDate) return `ok true  already up to date  remote: ${remote}`;
      return `ok true  pulled: ${remote}/${branch}  files: ${summary.filesChanged || 0}  +${summary.insertions || 0} -${summary.deletions || 0}`;
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: success, command: 'git-pull', remote, branch, ...summary, error: error || undefined }, null, 2);
    } else {
      const lines: string[] = [`ok: ${success}`, `remote: ${remote}`, `branch: ${branch}`];
      if (success && summary.upToDate) {
        lines.push('status: already up to date');
      } else if (success && summary.filesChanged !== undefined) {
        lines.push(`files: ${summary.filesChanged}  +${summary.insertions || 0} -${summary.deletions || 0}`);
      } else if (!success && error) {
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
      } else if (arg === '--rebase' || arg === '-r') {
        options.rebase = true;
      } else if (arg === '--ff-only') {
        options.ff = true;
      } else if (!arg.startsWith('--') && !options.remote) {
        options.remote = arg;
      } else if (!arg.startsWith('--') && !options.branch) {
        options.branch = arg;
      }
    }

    return options;
  }
}
