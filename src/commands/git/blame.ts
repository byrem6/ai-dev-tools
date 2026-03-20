import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';

export class GitBlameCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git blame', args, async () => {
      if (!options.file) {
        throw createError('ENOMATCH', '', 'Usage: adt git blame <file>');
      }

      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath);
      }

      const filePath = require('path').resolve(targetPath, options.file);
      if (!FileUtils.fileExists(filePath)) {
        throw createError('ENOENT', filePath);
      }

      return this.showBlame(filePath, options);
    });
  }

  private async showBlame(filePath: string, options: any): Promise<CommandResult> {
    const dir = require('path').dirname(filePath);
    const file = require('path').basename(filePath);
    const blame = GitUtils.getBlame(dir, file) || [];
    
    const blames: any[] = [];
    blame.forEach((item: any) => {
      blames.push({
        hash: item.hash,
        hashShort: item.hash.substring(0, 7),
        author: item.author,
        date: item.date,
        content: item.content,
      });
    });

    const output = this.formatBlame(blames, options);
    return {
      ok: true,
      command: 'git-blame',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      blames,
    };
  }

  private formatBlame(blames: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      blames.slice(0, 20).forEach((b, i) => {
        lines.push(`${i + 1}:${b.hashShort}  ${b.author}  ${b.date}  ${b.content.substring(0, 50)}`);
      });
      if (blames.length > 20) {
        lines.push(`... and ${blames.length - 20} more`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-blame',
        count: blames.length,
        blames,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`lines: ${blames.length}`);
      lines.push('===');
      blames.slice(0, 50).forEach((b, i) => {
        lines.push(`${i + 1}:  [${b.hashShort}  ${b.author}  ${b.date}]  ${b.content}`);
      });
      if (blames.length > 50) {
        lines.push(`... and ${blames.length - 50} more`);
      }
      return lines.join('\n');
    }
  }

  protected parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (key === 'fmt') {
          options.fmt = args[++i];
        } else if (key === 'file') {
          options.file = args[++i];
        } else if (key === 'path') {
          options.path = args[++i];
        } else {
          options[key] = true;
        }
      }
    }

    return options;
  }
}
