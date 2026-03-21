import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';

export class GitTagCommand extends Command {
  public getDescription(): string {
    return 'Git tag management';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-tag', args, async () => {
      const subCommand = options._[0] || 'list';
      const targetPath = options.path || process.cwd();

      if (!GitUtils.isGitRepository(targetPath)) {
        throw createError('EGIT', 'Not a git repository');
      }

      switch (subCommand) {
        case 'list':
          return this.tagList(targetPath, options);
        case 'create':
          return this.tagCreate(targetPath, options);
        case 'delete':
          return this.tagDelete(targetPath, options);
        case 'push':
          return this.tagPush(targetPath, options);
        default:
          return this.tagList(targetPath, options);
      }
    });
  }

  private async tagList(targetPath: string, options: any): Promise<CommandResult> {
    const result = GitUtils.listTags(targetPath);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to list tags');
    }

    const output = this.formatTagList(result.tags || [], options);
    return {
      ok: true,
      command: 'git-tag',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tags: result.tags,
    };
  }

  private async tagCreate(targetPath: string, options: any): Promise<CommandResult> {
    const tagName = options._[1] || options.name;
    if (!tagName) {
      throw createError('EGIT', 'Tag name required');
    }

    const message = options.message || options.m;
    const commit = options.commit;
    const result = GitUtils.createTag(targetPath, tagName, message, commit);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to create tag');
    }

    const output = this.formatTagCreate(tagName, message, result, options);
    return {
      ok: true,
      command: 'git-tag',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tag: result.tag,
    };
  }

  private async tagDelete(targetPath: string, options: any): Promise<CommandResult> {
    const tagName = options._[1] || options.name;
    if (!tagName) {
      throw createError('EGIT', 'Tag name required');
    }

    const result = GitUtils.deleteTag(targetPath, tagName);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to delete tag');
    }

    const output = this.formatTagDelete(tagName, options);
    return {
      ok: true,
      command: 'git-tag',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private async tagPush(targetPath: string, options: any): Promise<CommandResult> {
    const tagName = options._[1] || options.name;
    const pushAll = options.all || tagName === undefined;

    const result = GitUtils.pushTag(targetPath, tagName, pushAll);

    if (!result.ok) {
      throw createError('EGIT', result.error || 'Failed to push tag');
    }

    const output = this.formatTagPush(tagName, pushAll, result, options);
    return {
      ok: true,
      command: 'git-tag',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private formatTagList(tags: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return tags.map(t => t.name).join('\n') + `\n---\n${tags.length} tags`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-tag',
        action: 'list',
        count: tags.length,
        tags,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`tags: ${tags.length}`);
      lines.push('===');
      tags.forEach(t => {
        lines.push(`${t.name}  ${t.commit?.hash || ''}  ${t.message || ''}`);
      });
      return lines.join('\n');
    }
  }

  private formatTagCreate(tagName: string, message: string | undefined, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  tag ${tagName} created at ${result.tag?.commit || 'HEAD'}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-tag',
        action: 'create',
        tag: result.tag,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: create');
      lines.push(`tag: ${tagName}`);
      lines.push(`commit: ${result.tag?.commit || 'HEAD'}`);
      if (message) {
        lines.push(`message: ${message}`);
      }
      return lines.join('\n');
    }
  }

  private formatTagDelete(tagName: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  tag ${tagName} deleted`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-tag',
        action: 'delete',
        tag: tagName,
      }, null, 2);
    } else {
      return `ok: true\naction: delete\ntag: ${tagName}\nstatus: deleted`;
    }
  }

  private formatTagPush(tagName: string | undefined, pushAll: boolean, result: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (pushAll) {
        return `ok true  pushed all tags`;
      }
      return `ok true  pushed tag ${tagName}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-tag',
        action: 'push',
        tag: tagName,
        all: pushAll,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: push');
      if (pushAll) {
        lines.push('tags: all');
      } else {
        lines.push(`tag: ${tagName}`);
      }
      lines.push('status: pushed');
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
        } else if (key === 'message') {
          options.message = args[++i];
        } else if (key === 'commit') {
          options.commit = args[++i];
        } else if (key === 'name') {
          options.name = args[++i];
        } else if (key === 'all') {
          options.all = true;
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        if (key === 'm') {
          options.message = args[++i];
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
