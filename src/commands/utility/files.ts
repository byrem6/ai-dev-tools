import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface FileInfoExtended {
  path: string;
  size: number;
  sizeHuman: string;
  modified: string;
  language?: string;
  lines?: number;
}

export class FilesCommand extends Command {
  public getDescription(): string {
    return 'List project files';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('files', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.listFiles(targetPath, options);
    });
  }

  private async listFiles(targetPath: string, options: any): Promise<CommandResult> {
    const extension = options.ext || options.extension;
    const exclude = options.exclude || [];
    const includeHidden = options.hidden || options.all;
    const sort = options.sort || 'name';
    const limit = options.limit || 100;
    const recursive = options.recursive !== false;

    const patterns = this.buildPatterns(extension, includeHidden, exclude, recursive);
    
    const files = await fg.glob(patterns, {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      deep: recursive ? Infinity : 1,
    });

    const fileInfos: FileInfoExtended[] = [];

    for (const file of files.slice(0, limit)) {
      const fullPath = path.join(targetPath, file);
      try {
        const stats = fs.statSync(fullPath);
        const ext = path.extname(file).slice(1);
        
        const info: FileInfoExtended = {
          path: file,
          size: stats.size,
          sizeHuman: FileUtils.formatBytes(stats.size),
          modified: stats.mtime.toISOString(),
          language: FileUtils.getLanguageFromExtension(ext),
        };

        if (stats.size < 1024 * 1024) {
          try {
            const content = FileUtils.readFile(fullPath);
            info.lines = content.split('\n').length;
          } catch {
            // Skip reading file if it fails
          }
        }

        fileInfos.push(info);
      } catch {
        // Skip files that can't be accessed
      }
    }

    const sortedFiles = this.sortFiles(fileInfos, sort);

    const output = this.formatFileList(sortedFiles, options);

    return {
      ok: true,
      command: 'files',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      files: sortedFiles,
      total: sortedFiles.length,
      path: targetPath,
      sort,
    };
  }

  private buildPatterns(extension?: string, includeHidden?: boolean, exclude: string[] = [], recursive?: boolean): string[] {
    let patterns = ['**/*'];
    
    if (extension) {
      const exts = extension.split(',').map(e => e.trim().replace(/^\./, ''));
      patterns = exts.map(e => `**/*.${e}`);
    }

    if (!includeHidden) {
      exclude.push('**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**');
    }

    return patterns;
  }

  private sortFiles(files: FileInfoExtended[], sort: string): FileInfoExtended[] {
    const sorted = [...files];

    switch (sort) {
      case 'size':
        return sorted.sort((a, b) => b.size - a.size);
      case 'modified':
      case 'date':
      case 'time':
        return sorted.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      case 'lines':
        return sorted.sort((a, b) => (b.lines || 0) - (a.lines || 0));
      case 'name':
      default:
        return sorted.sort((a, b) => a.path.localeCompare(b.path));
    }
  }

  private formatFileList(files: FileInfoExtended[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`count ${files.length}`);
      
      for (const file of files) {
        const line = file.lines ? `${file.path}  (${file.lines} lines)` : file.path;
        lines.push(line);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: true, files }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: files`);
      lines.push(`total: ${files.length}`);
      lines.push(`===`);

      for (const file of files) {
        const size = file.sizeHuman.padStart(8);
        const lineInfo = file.lines ? `  ${file.lines} lines` : '';
        const lang = file.language ? `  ${file.language}` : '';
        lines.push(`${size}  ${file.path}${lineInfo}${lang}`);
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
      } else if (arg === '--ext' || arg === '--extension') {
        options.ext = args[++i];
      } else if (arg === '--exclude') {
        options.exclude = (args[++i] || '').split(',');
      } else if (arg === '--sort') {
        options.sort = args[++i];
      } else if (arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (arg === '--no-recursive') {
        options.recursive = false;
      } else if (arg === '--hidden' || arg === '--all') {
        options.hidden = true;
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
