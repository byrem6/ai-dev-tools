import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class ReplaceCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('replace', args, async () => {
      if (!options.target) {
        throw createError('ENOMATCH', '', 'Usage: adt replace <target> <from> <to>');
      }

      if (!options.from) {
        throw createError('ENOMATCH', '', 'Missing <from> pattern');
      }

      if (!options.to) {
        throw createError('ENOMATCH', '', 'Missing <to> replacement');
      }

      const searchPath = options.path || process.cwd();
      return this.performReplace(searchPath, options);
    });
  }

  private async performReplace(searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const exts = options.ext ? options.ext.split(',') : ['ts', 'tsx', 'js', 'jsx'];
    const pattern = `**/*.{${exts.join(',')}}`;

    const files = await fg.glob(pattern, {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const limit = options.limit || Infinity;
    const useRegex = options.regex || options.r;
    const ignoreCase = options.ignoreCase || options.i;
    const dryRun = options.dryRun || options.d;

    let totalReplacements = 0;
    let totalFiles = 0;
    const changes: any[] = [];

    for (const file of files.slice(0, 100)) {
      try {
        const content = FileUtils.readFile(file);
        const relativePath = path.relative(searchPath, file);
        
        let newContent = content;
        let fileReplacements = 0;
        const lines: any[] = [];

        if (useRegex) {
          const flags = ignoreCase ? 'gi' : 'g';
          const regex = new RegExp(options.from, flags);
          
          newContent = content.replace(regex, (match, ...args) => {
            fileReplacements++;
            return options.to;
          });
        } else {
          if (ignoreCase) {
            const regex = new RegExp(options.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            newContent = content.replace(regex, options.to);
            fileReplacements = (content.match(regex) || []).length;
          } else {
            const parts = content.split(options.from);
            fileReplacements = parts.length - 1;
            newContent = parts.join(options.to);
          }
        }

        if (fileReplacements > 0) {
          totalReplacements += fileReplacements;
          totalFiles++;

          const lineNumbers = this.findChangedLines(content, newContent);
          lineNumbers.forEach(lineNum => {
            lines.push(lineNum);
          });

          changes.push({
            file: relativePath,
            replacements: fileReplacements,
            lines,
          });

          if (!dryRun) {
            fs.writeFileSync(file, newContent, 'utf-8');
          }
        }
      } catch {
        // Skip files that can't be processed
      }

      if (totalFiles >= limit) {
        break;
      }
    }

    const output = this.formatReplaceOutput(options, totalReplacements, totalFiles, changes, dryRun);

    return {
      ok: true,
      command: 'replace',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      from: options.from,
      to: options.to,
      totalReplacements,
      totalFiles,
      changes,
      dryRun,
    };
  }

  private findChangedLines(oldContent: string, newContent: string): number[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changedLines: number[] = [];

    for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        changedLines.push(i + 1);
      }
    }

    return changedLines;
  }

  private formatReplaceOutput(options: any, totalReplacements: number, totalFiles: number, changes: any[], dryRun: boolean): string {
    const lines: string[] = [];
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      lines.push(`ok true  ${totalReplacements} replacements  ${totalFiles} files${dryRun ? '  [dry-run]' : ''}`);
      
      changes.forEach(change => {
        lines.push(change.file + '  ' + change.lines.map((l: number) => ':' + l).join(' '));
      });
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'replace',
        from: options.from,
        to: options.to,
        totalReplacements,
        totalFiles,
        dryRun,
        changes,
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`from: ${options.from} → to: ${options.to}  total: ${totalReplacements}  files: ${totalFiles}${dryRun ? '  dry-run: true' : ''}`);
      lines.push(`~tokens: ${TokenUtils.estimateTokens('')}`);
      lines.push('===');

      changes.forEach(change => {
        lines.push(`${change.file}  (${change.replacements})  lines: ${change.lines.slice(0, 5).join(', ')}${change.lines.length > 5 ? '...' : ''}`);
      });
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--ext') {
        options.ext = args[++i];
      } else if (arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (arg === '-r' || arg === '--regex') {
        options.regex = true;
      } else if (arg === '-i' || arg === '--ignore-case') {
        options.ignoreCase = true;
      } else if (arg === '-d' || arg === '--dry-run') {
        options.dryRun = true;
      } else if (!options.target) {
        options.target = arg;
      } else if (!options.from) {
        options.from = arg;
      } else if (!options.to) {
        options.to = arg;
      }
    }

    return options;
  }
}
