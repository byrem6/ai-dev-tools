import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface RecentFile {
  path: string;
  modified: string;
  modifiedRel: string;
  size: number;
  sizeHuman: string;
}

export class RecentCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('recent', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.findRecentFiles(targetPath, options);
    });
  }

  private async findRecentFiles(targetPath: string, options: any): Promise<CommandResult> {
    const limit = options.limit || 20;
    const hours = options.hours || 24;
    const extension = options.ext || options.extension;
    const exclude = options.exclude || [];

    const patterns = extension 
      ? [`**/*.${extension.replace(/^\./, '')}`]
      : ['**/*'];

    const files = await fg.glob(patterns, {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.adt/**',
        ...exclude,
      ],
    });

    const recentFiles: RecentFile[] = [];
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      try {
        const stats = fs.statSync(fullPath);
        const mtime = stats.mtime.getTime();
        
        if (mtime >= cutoffTime) {
          recentFiles.push({
            path: file,
            modified: stats.mtime.toISOString(),
            modifiedRel: this.getRelativeTime(stats.mtime),
            size: stats.size,
            sizeHuman: FileUtils.formatBytes(stats.size),
          });
        }
      } catch {
        // Skip files that can't be accessed
      }
    }

    recentFiles.sort((a, b) => {
      const timeA = new Date(a.modified).getTime();
      const timeB = new Date(b.modified).getTime();
      return timeB - timeA;
    });

    const result = recentFiles.slice(0, limit);

    const output = this.formatRecentFiles(result, hours, options);

    return {
      ok: true,
      command: 'recent',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      files: result,
      total: result.length,
      cutoff: `last ${hours} hours`,
    };
  }

  private getRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'just now';
    }
  }

  private formatRecentFiles(files: RecentFile[], hours: number, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`period: ${hours}h  count: ${files.length}`);
      
      for (const file of files) {
        lines.push(`${file.modifiedRel.padStart(8)}  ${file.path}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: true, period: `${hours}h`, files }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: recent`);
      lines.push(`period: ${hours} hours`);
      lines.push(`total: ${files.length}`);
      lines.push(`===`);

      for (const file of files) {
        const time = file.modifiedRel.padStart(8);
        const size = file.sizeHuman.padStart(8);
        lines.push(`${time}  ${size}  ${file.path}`);
      }

      if (files.length === 0) {
        lines.push(`No files modified in the last ${hours} hours`);
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
      } else if (arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (arg === '--hours') {
        options.hours = parseInt(args[++i], 10);
      } else if (arg === '--ext' || arg === '--extension') {
        options.ext = args[++i];
      } else if (arg === '--exclude') {
        options.exclude = (args[++i] || '').split(',');
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
