import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';

export class GitStashCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-stash', args, async () => {
      const subCommand = options._[0] || 'list';
      const targetPath = options.path || process.cwd();

      if (!GitUtils.isGitRepository(targetPath)) {
        throw createError('EGIT', 'Not a git repository');
      }

      switch (subCommand) {
        case 'save':
          return this.stashSave(targetPath, options);
        case 'list':
          return this.stashList(targetPath, options);
        case 'pop':
          return this.stashPop(targetPath, options);
        case 'apply':
          return this.stashApply(targetPath, options);
        case 'drop':
          return this.stashDrop(targetPath, options);
        case 'show':
          return this.stashShow(targetPath, options);
        case 'clear':
          return this.stashClear(targetPath, options);
        default:
          return this.stashList(targetPath, options);
      }
    });
  }

  private async stashSave(targetPath: string, options: any): Promise<CommandResult> {
    const message = options.message || 'WIP';
    const result = GitUtils.stashSave(targetPath, message);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to save stash');
    }

    const output = this.formatStashSave(result, options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      stash: result.stash,
    };
  }

  private async stashList(targetPath: string, options: any): Promise<CommandResult> {
    const result = GitUtils.stashList(targetPath);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to list stashes');
    }

    const output = this.formatStashList(result.stashes || [], options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      stashes: result.stashes,
    };
  }

  private async stashPop(targetPath: string, options: any): Promise<CommandResult> {
    const index = options.index || '0';
    const result = GitUtils.stashPop(targetPath, index);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to pop stash');
    }

    const output = this.formatStashOperation('pop', index, result, options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private async stashApply(targetPath: string, options: any): Promise<CommandResult> {
    const index = options.index || '0';
    const result = GitUtils.stashApply(targetPath, index);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to apply stash');
    }

    const output = this.formatStashOperation('apply', index, result, options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private async stashDrop(targetPath: string, options: any): Promise<CommandResult> {
    const index = options.index || '0';
    const result = GitUtils.stashDrop(targetPath, index);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to drop stash');
    }

    const output = this.formatStashOperation('drop', index, result, options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private async stashShow(targetPath: string, options: any): Promise<CommandResult> {
    const index = options.index || '0';
    const result = GitUtils.stashShow(targetPath, index);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to show stash');
    }

    const output = this.formatStashShow(index, result.diff, options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      diff: result.diff,
    };
  }

  private async stashClear(targetPath: string, options: any): Promise<CommandResult> {
    const result = GitUtils.stashClear(targetPath);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to clear stashes');
    }

    const output = this.formatSimpleResult('Cleared all stashes', options);
    return {
      ok: true,
      command: 'git-stash',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private formatStashSave(result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  Saved stash: ${result.stash?.stash}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-stash',
        action: 'save',
        stash: result.stash,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: save');
      lines.push(`stash: ${result.stash?.stash}`);
      lines.push(`branch: ${result.stash?.branch}`);
      lines.push(`message: ${result.stash?.message}`);
      return lines.join('\n');
    }
  }

  private formatStashList(stashes: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      stashes.forEach((s, i) => {
        lines.push(`[${i}]  ${s.stash}  ${s.branch || 'HEAD'}  "${s.message}"  ${s.date}`);
      });
      if (stashes.length > 0) lines.push(`---`);
      lines.push(`${stashes.length} stashes`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-stash',
        action: 'list',
        count: stashes.length,
        stashes,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`stashes: ${stashes.length}`);
      lines.push('===');
      stashes.forEach((s, i) => {
        lines.push(`stash@{${i}}  ${s.branch || 'HEAD'}  ${s.date}`);
        lines.push(`  ${s.message}`);
        if (s.files) {
          lines.push(`  ${s.files} files changed`);
        }
      });
      return lines.join('\n');
    }
  }

  private formatStashOperation(action: string, index: string, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  ${action} stash@{${index}}  success`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-stash',
        action,
        index,
      }, null, 2);
    } else {
      return `ok: true\naction: ${action}\nstash: stash@{${index}}\nstatus: success`;
    }
  }

  private formatStashShow(index: string, diff: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return diff.split('\n').slice(0, 20).join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-stash',
        action: 'show',
        index,
        diff,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`stash: stash@{${index}}`);
      lines.push('===');
      lines.push(diff);
      return lines.join('\n');
    }
  }

  private formatSimpleResult(message: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  ${message}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-stash',
        message,
      }, null, 2);
    } else {
      return `ok: true\nmessage: ${message}`;
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
        } else if (key === 'message' || key === 'm') {
          options.message = args[++i];
        } else if (key === 'path') {
          options.path = args[++i];
        } else if (key === 'index') {
          options.index = args[++i];
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        options[arg.slice(1)] = args[++i];
      } else {
        positional.push(arg);
      }
    }

    options._ = positional;
    return options;
  }
}
