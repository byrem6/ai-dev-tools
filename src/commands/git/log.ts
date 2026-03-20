import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class GitLogCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git log', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath);
      }

      return this.showLog(targetPath, options);
    });
  }

  private async showLog(repoPath: string, options: any): Promise<CommandResult> {
    const limit = options.limit || options.n || 20;
    const logLines = GitUtils.getLog(repoPath, limit);
    
    const commits: any[] = [];
    logLines.forEach((logLine: any) => {
      if (typeof logLine === 'object' && logLine.hash) {
        commits.push({
          hash: logLine.hash,
          hashShort: logLine.hashShort,
          author: logLine.author,
          date: logLine.date,
          message: logLine.message,
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
          files: [],
        });
      }
    });

    const output = this.formatLog(commits, repoPath, options);

    return {
      ok: true,
      command: 'git-log',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      commits,
      total: commits.length,
    };
  }

  private formatLog(commits: any[], repoPath: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      commits.forEach(commit => {
        const author = commit.author.split('<')[0].trim();
        const date = commit.date.substring(0, 10);
        lines.push(`${commit.hashShort}  ${commit.message.trim().substring(0, 50)}  ${author}  ${date}`);
      });
      lines.push(`---`);
      lines.push(`${commits.length} commits`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-log',
        commits,
        total: commits.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`total: ${commits.length}  limit: ${options.limit || 20}`);
      lines.push('===');

      commits.forEach(commit => {
        const author = commit.author.split('<')[0].trim();
        const date = commit.date.substring(0, 10);
        lines.push(`${commit.hashShort}  ${date}  ${author}`);
        lines.push(`  ${commit.message.trim()}`);
        lines.push('');
      });

      return lines.join('\n').trim();
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
      } else if (arg === '-n' || arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (arg === '--author') {
        options.author = args[++i];
      } else if (arg === '--since') {
        options.since = args[++i];
      } else if (arg === '--oneline') {
        options.oneline = true;
      }
    }

    return options;
  }
}
