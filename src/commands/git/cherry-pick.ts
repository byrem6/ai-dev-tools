import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';

export class GitCherryPickCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-cherry-pick', args, async () => {
      const commitHash = options._[0];
      const targetPath = options.path || process.cwd();

      if (!commitHash) {
        throw createError('EGIT', 'Commit hash required');
      }

      if (!GitUtils.isGitRepository(targetPath)) {
        throw createError('EGIT', 'Not a git repository');
      }

      if (options.dryRun) {
        return this.dryRunCherryPick(targetPath, commitHash, options);
      }

      return this.cherryPick(targetPath, commitHash, options);
    });
  }

  private async dryRunCherryPick(targetPath: string, commitHash: string, options: any): Promise<CommandResult> {
    const result = GitUtils.checkCherryPickConflicts(targetPath, commitHash);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to check cherry-pick conflicts');
    }

    const output = this.formatDryRun(commitHash, result, options);
    return {
      ok: true,
      command: 'git-cherry-pick',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      dryRun: true,
      commitHash,
      conflicts: result.conflicts,
      risk: result.risk,
    };
  }

  private async cherryPick(targetPath: string, commitHash: string, options: any): Promise<CommandResult> {
    const result = GitUtils.cherryPick(targetPath, commitHash, options);

    if (!result.ok) {
      if (result.conflicts && result.conflicts.length > 0) {
        const output = this.formatCherryPickConflicts(commitHash, result.conflicts, options);
        return {
          ok: false,
          command: 'git-cherry-pick',
          tokenEstimate: TokenUtils.estimateTokens(output),
          content: output,
          conflicts: result.conflicts,
          error: 'EMERGE_CONFLICT',
        };
      }
      throw createError('EGIT', result.error || 'Failed to cherry-pick');
    }

    const output = this.formatCherryPickSuccess(commitHash, result, options);
    return {
      ok: true,
      command: 'git-cherry-pick',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      commitHash,
      newCommit: result.newCommit,
    };
  }

  private formatDryRun(commitHash: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  ${commitHash} → [dry-run]`);
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
        command: 'git-cherry-pick',
        commitHash,
        dryRun: true,
        risk: result.risk,
        conflicts: result.conflicts,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`commit: ${commitHash}`);
      lines.push(`dry-run: true`);
      lines.push(`risk: ${result.risk || 'unknown'}`);
      lines.push('===');
      
      if (result.conflicts && result.conflicts.length > 0) {
        lines.push(`potential-conflicts: ${result.conflicts.length}`);
        result.conflicts.forEach((c: string) => {
          lines.push(`  ${c}`);
        });
      } else {
        lines.push('potential-conflicts: 0 (clean cherry-pick expected)');
      }

      return lines.join('\n');
    }
  }

  private formatCherryPickSuccess(commitHash: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  cherry-picked ${commitHash}`);
      if (result.newCommit) {
        lines.push(`new-commit: ${result.newCommit}`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-cherry-pick',
        commitHash,
        newCommit: result.newCommit,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`commit: ${commitHash}`);
      lines.push('status: cherry-picked');
      if (result.newCommit) {
        lines.push(`new-commit: ${result.newCommit}`);
      }
      return lines.join('\n');
    }
  }

  private formatCherryPickConflicts(commitHash: string, conflicts: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok false  cherry-picking ${commitHash}`);
      lines.push(`conflicts: ${conflicts.length}`);
      conflicts.slice(0, 10).forEach((c) => {
        lines.push(`  ${c}`);
      });
      if (conflicts.length > 10) {
        lines.push(`  ... and ${conflicts.length - 10} more`);
      }
      lines.push('tip: resolve conflicts then run "adt git-cherry-pick --continue"');
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: false,
        command: 'git-cherry-pick',
        commitHash,
        error: 'EMERGE_CONFLICT',
        conflicts,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: false');
      lines.push(`commit: ${commitHash}`);
      lines.push(`error: cherry-pick conflicts detected`);
      lines.push('===');
      lines.push(`conflicts: ${conflicts.length}`);
      conflicts.forEach((c) => {
        lines.push(`  ${c}`);
      });
      lines.push('===');
      lines.push('tip: resolve conflicts and commit, or run "git cherry-pick --abort"');
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
        } else if (key === 'dry-run') {
          options.dryRun = true;
        } else {
          options[key] = true;
        }
      } else {
        positional.push(arg);
      }
    }

    options._ = positional;
    return options;
  }
}
