import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface FileHistory {
  file: string;
  totalCommits: number;
  last30Days: number;
  authors: Array<{ name: string; email: string; commits: number; percentage: number }>;
  firstSeen: string;
  lastModified: string;
  churn: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class HistoryFileCommand extends Command {
  public getDescription(): string {
    return 'Show file git history';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt history-file <file>',
      description: 'Show git change history and churn for a file',
      examples: [
        'adt history-file src/index.ts',
        'adt history-file src/services/UserService.ts --fmt normal',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('history file', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', 'File path is required');
      }

      if (!fs.existsSync(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      const history = await this.getFileHistory(options.filePath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(history);
      }

      return this.formatNormal(history);
    });
  }

  private async getFileHistory(filePath: string): Promise<FileHistory> {
    // Check if we're in a git repository
    const gitRoot = GitUtils.getGitRoot();
    if (!gitRoot) {
      return this.getEmptyHistory(filePath);
    }

    try {
      // Resolve file path relative to git root
      const absolutePath = path.resolve(filePath);
      const relativePath = path.relative(gitRoot, absolutePath);

      // Use git log to get file history
      const logOutput = GitUtils.exec(`log --follow --format=%H|%an|%ae|%ad --date=iso -- "${relativePath}"`, gitRoot);
      const commits = logOutput.trim().split('\n').filter(Boolean);

      if (commits.length === 0 || commits[0] === '') {
        return this.getEmptyHistory(filePath);
      }

      // Parse commits
      const commitData = commits.map(line => {
        const parts = line.split('|');
        if (parts.length >= 4) {
          return {
            hash: parts[0],
            name: parts[1],
            email: parts[2],
            date: parts[3]
          };
        }
        return null;
      }).filter(Boolean) as Array<{ hash: string; name: string; email: string; date: string }>;

      // Calculate last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const last30Days = commitData.filter(c => new Date(c.date) >= thirtyDaysAgo).length;

      // Calculate author stats
      const authorMap = new Map<string, { name: string; email: string; commits: number }>();

      for (const commit of commitData) {
        const key = `${commit.name}|${commit.email}`;
        if (!authorMap.has(key)) {
          authorMap.set(key, { name: commit.name, email: commit.email, commits: 0 });
        }
        const author = authorMap.get(key)!;
        author.commits++;
      }

      const authors = Array.from(authorMap.values()).map(author => ({
        name: author.name,
        email: author.email,
        commits: author.commits,
        percentage: commitData.length > 0 ? Math.round((author.commits / commitData.length) * 100) : 0,
      }));

      authors.sort((a, b) => b.commits - a.commits);

      // Calculate churn
      const churnLevel = this.calculateChurn(last30Days);

      return {
        file: filePath,
        totalCommits: commitData.length,
        last30Days,
        authors,
        firstSeen: commitData[commitData.length - 1]?.date.split('T')[0] || 'N/A',
        lastModified: commitData[0]?.date.split('T')[0] || 'N/A',
        churn: churnLevel,
      };
    } catch (error) {
      return this.getEmptyHistory(filePath);
    }
  }

  private calculateChurn(last30Days: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (last30Days < 5) return 'LOW';
    if (last30Days < 15) return 'MEDIUM';
    return 'HIGH';
  }

  private getEmptyHistory(filePath: string): FileHistory {
    return {
      file: filePath,
      totalCommits: 0,
      last30Days: 0,
      authors: [],
      firstSeen: 'N/A',
      lastModified: 'N/A',
      churn: 'LOW',
    };
  }

  private formatSlim(history: FileHistory): CommandResult {
    const lines = history.authors.map(a =>
      `${a.name}(${a.percentage}%)`
    );

    const output = `${history.totalCommits} commits  ${history.last30Days}/30days  ${history.authors.length} authors  ${history.churn}-churn
first: ${history.firstSeen}  last: ${history.lastModified}
authors: ${lines.join(', ')}`;

    return {
      ok: true,
      command: 'history',
      action: 'file',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      history,
    };
  }

  private formatNormal(history: FileHistory): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `file: ${history.file}`,
      `created: ${history.firstSeen}  last-modified: ${history.lastModified}`,
      `total-commits: ${history.totalCommits}  last-30-days: ${history.last30Days}  [${history.churn} churn]`,
      `===`,
      `authors:`,
    ];

    for (const author of history.authors) {
      sections.push(`  ${author.name}  ${author.percentage}%  (${author.commits} commits)`);
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'history',
      action: 'file',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      history,
    };
  }

  private parseArgs(args: string[]): { filePath?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.filePath = arg;
      }
    }

    return options;
  }
}
