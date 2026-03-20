import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class GitDiffCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git diff', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath);
      }

      return this.showDiff(targetPath, options);
    });
  }

  private async showDiff(repoPath: string, options: any): Promise<CommandResult> {
    const target = options.target || 'HEAD';
      const diff = GitUtils.getDiff(repoPath, options.staged) || '';
    
    const lines = diff.split('\n');
    const files: any[] = [];
    let totalInsertions = 0;
    let totalDeletions = 0;

    let currentFile: any = null;
    lines.forEach(line => {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          files.push(currentFile);
        }
        const parts = line.split(' ');
        const filePath = parts[2].substring(2);
        currentFile = {
          file: filePath,
          status: 'modified',
          insertions: 0,
          deletions: 0,
          hunks: [],
        };
      } else if (line.match(/^@@/)) {
        if (currentFile) {
          currentFile.hunks.push(line);
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        if (currentFile) {
          currentFile.insertions++;
          totalInsertions++;
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        if (currentFile) {
          currentFile.deletions++;
          totalDeletions++;
        }
      }
    });

    if (currentFile) {
      files.push(currentFile);
    }

      const output = this.formatDiff(files, totalInsertions, totalDeletions, diff || '', options);

    return {
      ok: true,
      command: 'git-diff',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      files,
      totalInsertions,
      totalDeletions,
      totalFiles: files.length,
    };
  }

  private formatDiff(files: any[], totalInsertions: number, totalDeletions: number, diff: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      files.forEach(file => {
        const status = file.insertions > 0 && file.deletions > 0 ? 'M' : file.insertions > 0 ? 'A' : 'D';
        lines.push(`${status}  ${file.file}  +${file.insertions} -${file.deletions}`);
      });
      lines.push(`---`);
      lines.push(`${files.length} files  +${totalInsertions} -${totalDeletions}`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-diff',
        summary: {
          filesChanged: files.length,
          insertions: totalInsertions,
          deletions: totalDeletions,
        },
        files,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`files: ${files.length}  +${totalInsertions} -${totalDeletions}`);
      lines.push('===');

      files.slice(0, 10).forEach(file => {
        lines.push(`${file.file}  (+${file.insertions} -${file.deletions})`);
      });

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
      } else if (arg === '--staged') {
        options.staged = true;
      } else if (arg === '--stat') {
        options.stat = true;
      } else if (!options.target) {
        options.target = arg;
      }
    }

    return options;
  }
}
