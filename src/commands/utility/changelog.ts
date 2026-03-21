import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface ChangelogEntry {
  version: string;
  date: string;
  commits: string[];
  breaking: string[];
  features: string[];
  fixes: string[];
  other: string[];
}

export class ChangelogCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('changelog', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.generateChangelog(targetPath, options);
    });
  }

  private async generateChangelog(targetPath: string, options: any): Promise<CommandResult> {
    const isGitRepo = GitUtils.isGitRepository(targetPath);

    if (!isGitRepo) {
      throw createError('EGIT', 'Not a git repository', 'Changelog generation requires git history');
    }

    const since = options.since || null;
    const until = options.until || null;
    const version = options.version || null;

    const entries: ChangelogEntry[] = [];

    if (version) {
      const entry = await this.generateVersionEntry(targetPath, version, since, until);
      entries.push(entry);
    } else {
      const tags = await GitUtils.listTags(targetPath);
      
      for (let i = 0; i < tags.length; i++) {
        const currentTag = tags[i];
        const previousTag = i > 0 ? tags[i - 1] : null;
        
        const entry = await this.generateTagEntry(targetPath, currentTag, previousTag);
        entries.push(entry);
      }

      const unreleasedEntry = await this.generateUnreleasedEntry(targetPath, tags[0] || null);
      if (unreleasedEntry.commits.length > 0) {
        entries.unshift(unreleasedEntry);
      }
    }

    const output = this.formatChangelog(entries, options);

    return {
      ok: true,
      command: 'changelog',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      entries,
      totalEntries: entries.length,
    };
  }

  private async generateVersionEntry(
    targetPath: string,
    version: string,
    since: string | null,
    until: string | null
  ): Promise<ChangelogEntry> {
    const limit = 100;
    const commits = GitUtils.getLog(targetPath, limit);
    
    return {
      version,
      date: new Date().toISOString().split('T')[0],
      commits: commits.map(c => c.message),
      breaking: this.filterByPattern(commits.map(c => c.message), ['breaking', 'BREAKING CHANGE:', '!:']),
      features: this.filterByPattern(commits.map(c => c.message), ['feat:', 'feature:', 'add:']),
      fixes: this.filterByPattern(commits.map(c => c.message), ['fix:', 'bugfix:', 'fix ']),
      other: this.filterOtherCommits(commits.map(c => c.message)),
    };
  }

  private async generateTagEntry(
    targetPath: string,
    currentTag: string,
    previousTag: string | null
  ): Promise<ChangelogEntry> {
    const limit = 100;
    const commits = GitUtils.getLog(targetPath, limit);

    return {
      version: currentTag,
      date: new Date().toISOString().split('T')[0],
      commits: commits.map(c => c.message),
      breaking: this.filterByPattern(commits.map(c => c.message), ['breaking', 'BREAKING CHANGE:', '!:']),
      features: this.filterByPattern(commits.map(c => c.message), ['feat:', 'feature:', 'add:']),
      fixes: this.filterByPattern(commits.map(c => c.message), ['fix:', 'bugfix:', 'fix ']),
      other: this.filterOtherCommits(commits.map(c => c.message)),
    };
  }

  private async generateUnreleasedEntry(
    targetPath: string,
    latestTag: string | null
  ): Promise<ChangelogEntry> {
    const limit = 100;
    const commits = GitUtils.getLog(targetPath, limit);

    return {
      version: 'Unreleased',
      date: new Date().toISOString().split('T')[0],
      commits: commits.map(c => c.message),
      breaking: this.filterByPattern(commits.map(c => c.message), ['breaking', 'BREAKING CHANGE:', '!:']),
      features: this.filterByPattern(commits.map(c => c.message), ['feat:', 'feature:', 'add:']),
      fixes: this.filterByPattern(commits.map(c => c.message), ['fix:', 'bugfix:', 'fix ']),
      other: this.filterOtherCommits(commits.map(c => c.message)),
    };
  }

  private filterByPattern(commits: string[], patterns: string[]): string[] {
    const filtered: string[] = [];

    for (const commit of commits) {
      for (const pattern of patterns) {
        if (commit.toLowerCase().includes(pattern.toLowerCase())) {
          const cleaned = this.cleanCommitMessage(commit);
          if (cleaned && !filtered.includes(cleaned)) {
            filtered.push(cleaned);
          }
          break;
        }
      }
    }

    return filtered;
  }

  private filterOtherCommits(commits: string[]): string[] {
    const allPatterns = [
      'breaking', 'BREAKING CHANGE:', '!:',
      'feat:', 'feature:', 'add:',
      'fix:', 'bugfix:', 'fix ',
      'chore:', 'docs:', 'style:', 'refactor:', 'test:', 'perf:'
    ];

    const other: string[] = [];

    for (const commit of commits) {
      let isPattern = false;
      
      for (const pattern of allPatterns) {
        if (commit.toLowerCase().includes(pattern.toLowerCase())) {
          isPattern = true;
          break;
        }
      }

      if (!isPattern) {
        const cleaned = this.cleanCommitMessage(commit);
        if (cleaned && !other.includes(cleaned)) {
          other.push(cleaned);
        }
      }
    }

    return other;
  }

  private cleanCommitMessage(message: string): string {
    return message
      .replace(/^(feat|fix|chore|docs|style|refactor|test|perf|breaking|feature|bugfix|add)(\(.+\))?\s*:\s*/i, '')
      .replace(/^BREAKING CHANGE:\s*/i, '')
      .replace(/^[!:]\s*/, '')
      .replace(/#\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatChangelog(entries: ChangelogEntry[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`entries: ${entries.length}`);
      
      for (const entry of entries) {
        lines.push(`${entry.version}  ${entry.date}  commits: ${entry.commits.length}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: true, entries }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: changelog`);
      lines.push(`===`);
      lines.push(`# Changelog`);
      lines.push(``);

      for (const entry of entries) {
        lines.push(`## ${entry.version} (${entry.date})`);
        lines.push(``);

        if (entry.breaking.length > 0) {
          lines.push(`### Breaking Changes`);
          for (const change of entry.breaking) {
            lines.push(`- ${change}`);
          }
          lines.push(``);
        }

        if (entry.features.length > 0) {
          lines.push(`### Features`);
          for (const feature of entry.features) {
            lines.push(`- ${feature}`);
          }
          lines.push(``);
        }

        if (entry.fixes.length > 0) {
          lines.push(`### Bug Fixes`);
          for (const fix of entry.fixes) {
            lines.push(`- ${fix}`);
          }
          lines.push(``);
        }

        if (entry.other.length > 0 && options.verbose) {
          lines.push(`### Other Changes`);
          for (const other of entry.other) {
            lines.push(`- ${other}`);
          }
          lines.push(``);
        }

        lines.push(``);
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
      } else if (arg === '--version') {
        options.version = args[++i];
      } else if (arg === '--since') {
        options.since = args[++i];
      } else if (arg === '--until') {
        options.until = args[++i];
      } else if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
      } else if (arg === '--write') {
        options.write = true;
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
