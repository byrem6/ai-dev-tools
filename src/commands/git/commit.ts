import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class GitCommitCommand extends Command {
  public getDescription(): string {
    return 'Create git commit';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-commit', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath);
      }

      if (!options.message) {
        throw createError('ENOMATCH', '', 'Commit message required');
      }

      return this.createCommit(targetPath, options);
    });
  }

  private async createCommit(repoPath: string, options: any): Promise<CommandResult> {
    const result = GitUtils.commit(repoPath, options.message, options.amend || false);
    const success = result?.ok === true;
    const branch = GitUtils.getCurrentBranch(repoPath) || 'main';
    const hash = result?.commit?.hashShort || '';
    
    const output = this.formatCommit(options.message, branch, hash, success, options);

    return {
      ok: success,
      command: 'git-commit',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      message: options.message,
      branch,
      hash,
      amend: options.amend,
    };
  }

  private formatCommit(message: string, branch: string, hash: string, success: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok ${success}  hash: ${hash || '?'}  committed: "${message.substring(0, 50)}"  branch: ${branch}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: success,
        command: 'git-commit',
        message,
        branch,
        hash,
        amend: options.amend,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${success}`);
      lines.push(`branch: ${branch}`);
      if (hash) lines.push(`hash: ${hash}`);
      lines.push(`message: ${message}`);
      if (options.amend) lines.push(`amend: true`);
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
      } else if (arg === '-m' || arg === '--message') {
        options.message = args[++i];
      } else if (arg === '--amend') {
        options.amend = true;
      }
    }

    return options;
  }
}
