import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';

export class GitResetCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-reset', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!GitUtils.isGitRepository(targetPath)) {
        throw createError('EGIT', 'Not a git repository');
      }

      return this.resetGit(targetPath, options);
    });
  }

  private async resetGit(targetPath: string, options: any): Promise<CommandResult> {
    const mode = options.soft ? 'soft' : options.mixed ? 'mixed' : options.hard ? 'hard' : 'mixed';
    const target = options._[0] || 'HEAD';

    const result = GitUtils.reset(targetPath, mode, target);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to reset');
    }

    const output = this.formatReset(mode, target, result, options);
    return {
      ok: true,
      command: 'git-reset',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      mode,
      target,
      files: result.files,
    };
  }

  private formatReset(mode: string, target: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  ${mode}  ${target}`);
      if (result.files && result.files.length > 0) {
        lines.push(`files-affected: ${result.files.length}`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-reset',
        mode,
        target,
        filesAffected: result.files?.length || 0,
        files: result.files,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`mode: ${mode}`);
      lines.push(`target: ${target}`);
      lines.push('===');
      
      if (result.files && result.files.length > 0) {
        lines.push(`files-affected: ${result.files.length}`);
        result.files.slice(0, 10).forEach((f: string) => {
          lines.push(`  ${f}`);
        });
        if (result.files.length > 10) {
          lines.push(`  ... and ${result.files.length - 10} more`);
        }
      }

      if (mode === 'soft') {
        lines.push('state: changes moved to staged area');
      } else if (mode === 'mixed') {
        lines.push('state: changes moved to unstaged');
      } else if (mode === 'hard') {
        lines.push('state: changes discarded permanently');
      }

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
