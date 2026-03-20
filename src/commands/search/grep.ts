import { Command } from '../../core/command';
import { CommandResult, OutputFormat, MatchResult } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class GrepCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('grep', args, async () => {
      if (!options.pattern) {
        throw createError('ENOENT', '');
      }

      const searchPath = options.path || process.cwd();
      return this.searchPattern(options.pattern, searchPath, options);
    });
  }

  private async searchPattern(
    pattern: string,
    searchPath: string,
    options: any
  ): Promise<CommandResult> {
    const matches: MatchResult[] = [];
    const maxResults = options.max || this.configManager.get('maxGrepResults');
    const maxPerFile = options.maxPerFile || 20;
    const excludeDirs = options.exclude || this.configManager.get('excludeByDefault');

    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const files = this.findFiles(searchPath, excludeDirs, options.ext);

    for (const file of files) {
      if (matches.length >= maxResults) break;

      const fileMatches = this.searchInFile(file, pattern, options, maxPerFile);
      matches.push(...fileMatches);
    }

    const output = this.formatMatches(matches, pattern, options);

    return {
      ok: true,
      command: 'grep',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      matches,
      totalMatches: matches.length,
      totalFiles: this.countUniqueFiles(matches),
      pattern,
    };
  }

  private findFiles(
    searchPath: string,
    excludeDirs: string[],
    extFilter?: string
  ): string[] {
    const files: string[] = [];

    if (FileUtils.isFile(searchPath)) {
      return [searchPath];
    }

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (excludeDirs.includes(entry.name)) {
            continue;
          }
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = FileUtils.getFileExtension(fullPath);
          
          if (extFilter) {
            const filters = extFilter.split(',');
            if (filters.includes(ext) || filters.includes(`.${ext}`)) {
              files.push(fullPath);
            }
          } else {
            files.push(fullPath);
          }
        }
      }
    };

    try {
      scanDir(searchPath);
    } catch (error) {
      console.error('Error scanning directory:', error);
    }

    return files;
  }

  private searchInFile(
    filePath: string,
    pattern: string,
    options: any,
    maxPerFile: number
  ): MatchResult[] {
    const matches: MatchResult[] = [];

    try {
      const content = FileUtils.readFile(filePath);
      const lines = content.split('\n');

      let regex: RegExp;
      try {
        if (options.regex) {
          regex = new RegExp(pattern, options.ignoreCase ? 'gi' : 'g');
        } else {
          regex = new RegExp(
            pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options.ignoreCase ? 'gi' : 'g'
          );
        }
      } catch (error) {
        return matches;
      }

      const contextBefore = options.before || options.context || 0;
      const contextAfter = options.after || options.context || 0;

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxPerFile) break;

        const line = lines[i];
        regex.lastIndex = 0;

        if (options.noComments && this.isCommentLine(line)) {
          continue;
        }

        const found = regex.test(line);
        
        if (found) {
          if (options.word && !this.isWholeWordMatch(line, pattern, options.ignoreCase)) {
            continue;
          }

          const match: MatchResult = {
            file: filePath,
            line: i + 1,
            col: line.search(regex) + 1,
            text: line.trim(),
          };

          if (contextBefore > 0 || contextAfter > 0) {
            match.context = {
              before: lines.slice(Math.max(0, i - contextBefore), i),
              after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextAfter)),
            };
          }

          matches.push(match);
        }
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }

    return matches;
  }

  private isCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || 
           trimmed.startsWith('#') || 
           trimmed.startsWith('/*') || 
           trimmed.startsWith('*') ||
           trimmed.startsWith(';');
  }

  private isWholeWordMatch(line: string, pattern: string, ignoreCase?: boolean): boolean {
    const regex = new RegExp(`\\b${pattern}\\b`, ignoreCase ? 'i' : '');
    return regex.test(line);
  }

  private countUniqueFiles(matches: MatchResult[]): number {
    const files = new Set(matches.map(m => m.file));
    return files.size;
  }

  private formatMatches(matches: MatchResult[], pattern: string, options: any): string {
    const lines: string[] = [];

    matches.forEach(match => {
      if (options.fmt === 'slim') {
        let line = `${match.file}:${match.line}:${match.col || ''}:${match.text}`;
        lines.push(line);

        if (match.context) {
          match.context.before.forEach(ctx => {
            lines.push(`> ${match.file}:${match.line - match.context!.before.length + match.context!.before.indexOf(ctx)}:${ctx}`);
          });
          match.context.after.forEach(ctx => {
            lines.push(`> ${match.file}:${match.line + match.context!.after.indexOf(ctx) + 1}:${ctx}`);
          });
        }
      } else {
        lines.push(`${match.file}:${match.line}:${match.col || ''}  ${match.text}`);

        if (match.context) {
          match.context.before.forEach(ctx => {
            lines.push(`  ${ctx}`);
          });
          match.context.after.forEach(ctx => {
            lines.push(`  ${ctx}`);
          });
        }
      }
    });

    const summary = `---\n${matches.length} matches  ${this.countUniqueFiles(matches)} files`;
    lines.push(summary);

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      pattern: args[0],
      path: args[1],
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '-i' || arg === '--ignore-case') {
        options.ignoreCase = true;
      } else if (arg === '-r' || arg === '--regex') {
        options.regex = true;
      } else if (arg === '-w' || arg === '--word') {
        options.word = true;
      } else if (arg === '-l' || arg === '--files-only') {
        options.filesOnly = true;
      } else if (arg === '--no-comments') {
        options.noComments = true;
      } else if (arg === '--max' && nextArg) {
        options.max = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--max-per-file' && nextArg) {
        options.maxPerFile = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--ext' && nextArg) {
        options.ext = nextArg;
        i++;
      } else if (arg === '--exclude' && nextArg) {
        options.exclude = nextArg.split(',');
        i++;
      } else if ((arg === '--context' || arg === '-C' || arg === '-A' || arg === '-B') && nextArg) {
        options.context = parseInt(nextArg, 10);
        if (arg === '-A') {
          options.after = parseInt(nextArg, 10);
        } else if (arg === '-B') {
          options.before = parseInt(nextArg, 10);
        }
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
