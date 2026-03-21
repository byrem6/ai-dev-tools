import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';

export class GitMergeCommand extends Command {
  public getDescription(): string {
    return 'Git merge branches';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-merge', args, async () => {
      const branch = options._[0];
      const targetPath = options.path || process.cwd();

      if (!branch) {
        throw createError('EGIT', 'Branch name required');
      }

      if (!GitUtils.isGitRepository(targetPath)) {
        throw createError('EGIT', 'Not a git repository');
      }

      if (options.dryRun) {
        return this.dryRunMerge(targetPath, branch, options);
      }

      return this.mergeBranch(targetPath, branch, options);
    });
  }

  private async dryRunMerge(targetPath: string, branch: string, options: any): Promise<CommandResult> {
    const result = GitUtils.checkMergeConflicts(targetPath, branch);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to check merge conflicts');
    }

    const output = this.formatDryRun(branch, result, options);
    return {
      ok: true,
      command: 'git-merge',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      dryRun: true,
      conflicts: result.conflicts,
      risk: result.risk,
    };
  }

  private async mergeBranch(targetPath: string, branch: string, options: any): Promise<CommandResult> {
    const mode = options.noFF ? 'no-ff' : options.squash ? 'squash' : 'merge-commit';
    const result = GitUtils.merge(targetPath, branch, mode);

    if (!result.ok) {
      if (result.conflicts && result.conflicts.length > 0) {
        const output = this.formatMergeConflicts(branch, result.conflicts, options);
        return {
          ok: false,
          command: 'git-merge',
          tokenEstimate: TokenUtils.estimateTokens(output),
          content: output,
          conflicts: result.conflicts,
          error: 'EMERGE_CONFLICT',
        };
      }
      throw createError('EGIT', result.error || 'Failed to merge');
    }

    const output = this.formatMergeSuccess(branch, mode, result, options);
    return {
      ok: true,
      command: 'git-merge',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branch,
      mode,
      commits: result.commits,
      files: result.files,
      conflicts: result.conflicts,
    };
  }

  private formatDryRun(branch: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  ${branch} → [dry-run]`);
      lines.push(`risk: ${result.risk || 'unknown'}`);
      if (result.conflicts && result.conflicts.length > 0) {
        lines.push(`conflicts: ${result.conflicts.length}`);
        result.conflicts.slice(0, 5).forEach((c: string) => {
          lines.push(`  ${c}`);
        });
      } else {
        lines.push('conflicts: 0');
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-merge',
        branch,
        dryRun: true,
        risk: result.risk,
        conflicts: result.conflicts,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`branch: ${branch}`);
      lines.push(`dry-run: true`);
      lines.push(`risk: ${result.risk || 'unknown'}`);
      lines.push('===');
      
      if (result.conflicts && result.conflicts.length > 0) {
        lines.push(`potential-conflicts: ${result.conflicts.length}`);
        result.conflicts.forEach((c: string) => {
          lines.push(`  ${c}`);
        });
      } else {
        lines.push('potential-conflicts: 0 (clean merge expected)');
      }

      return lines.join('\n');
    }
  }

  private formatMergeSuccess(branch: string, mode: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  ${branch} → HEAD  ${result.commits || 0} commits  ${result.files || 0} files  ${result.conflicts?.length || 0} conflicts`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-merge',
        branch,
        mode,
        commits: result.commits,
        files: result.files,
        conflicts: result.conflicts,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`merged: ${branch} → HEAD`);
      lines.push(`method: ${mode}`);
      if (result.hash) {
        lines.push(`hash: ${result.hash}`);
      }
      lines.push(`commits: ${result.commits || 0}`);
      lines.push(`files: ${result.files || 0}`);
      lines.push(`conflicts: ${result.conflicts?.length || 0}`);
      return lines.join('\n');
    }
  }

  private formatMergeConflicts(branch: string, conflicts: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok false  merging ${branch}`);
      lines.push(`conflicts: ${conflicts.length}`);
      conflicts.slice(0, 10).forEach((c) => {
        lines.push(`  ${c}`);
      });
      if (conflicts.length > 10) {
        lines.push(`  ... and ${conflicts.length - 10} more`);
      }
      lines.push('tip: resolve conflicts then run "adt git-merge --continue"');
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: false,
        command: 'git-merge',
        branch,
        error: 'EMERGE_CONFLICT',
        conflicts,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: false');
      lines.push(`branch: ${branch}`);
      lines.push(`error: merge conflicts detected`);
      lines.push('===');
      lines.push(`conflicts: ${conflicts.length}`);
      conflicts.forEach((c) => {
        lines.push(`  ${c}`);
      });
      lines.push('===');
      lines.push('tip: resolve conflicts and commit, or run "git merge --abort"');
      return lines.join('\n');
    }
  }

  protected parseArgs(args: string[]): any {
    const options: any = {};
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (key === 'fmt') {
          options.fmt = args[++i];
        } else if (key === 'path') {
          options.path = args[++i];
        } else if (key === 'no-ff') {
          options.noFF = true;
        } else if (key === 'squash') {
          options.squash = true;
        } else if (key === 'dry-run') {
          options.dryRun = true;
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        options[arg.slice(1)] = true;
      } else {
        positional.push(arg);
      }
    }

    options._ = positional;
    return options;
  }
}
