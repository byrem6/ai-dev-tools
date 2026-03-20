import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class PatchCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('patch', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.applyPatch(options.filePath, options);
    });
  }

  private async applyPatch(filePath: string, options: any): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    // Take backup
    const checksum = HashUtils.hashContent(content);
    if (this.configManager.get('autoBackup') && !options.noBackup) {
      await this.createBackup(filePath, checksum);
    }

    let newContent = content;
    let opType = '';
    let linesRemoved = 0;
    let linesAdded = 0;

    if (options.replace) {
      const [start, end] = options.replace.split(':').map((n: string) => parseInt(n, 10));
      const result = this.replaceLines(lines, start, end, options.with);
      newContent = result.content;
      linesRemoved = result.removed;
      linesAdded = result.added;
      opType = 'replace';
    } else if (options.insertAfter) {
      const result = this.insertAfterLine(lines, parseInt(options.insertAfter, 10), options.content);
      newContent = result.content;
      linesAdded = result.added;
      opType = 'insert-after';
    } else if (options.insertBefore) {
      const result = this.insertBeforeLine(lines, parseInt(options.insertBefore, 10), options.content);
      newContent = result.content;
      linesAdded = result.added;
      opType = 'insert-before';
    } else if (options.delete) {
      const [start, end] = options.delete.split(':').map((n: string) => parseInt(n, 10));
      const result = this.deleteLines(lines, start, end);
      newContent = result.content;
      linesRemoved = result.removed;
      opType = 'delete';
    }

    const newLines = newContent.split('\n');

    if (options.dryRun) {
      const diff = this.generateDiff(lines, newLines);
      const output = this.formatPatchResult(filePath, opType, {
        dryRun: true,
        linesRemoved,
        linesAdded,
        newTotal: newLines.length,
        diff,
      }, options);

      return {
        ok: true,
        command: 'patch',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        dryRun: true,
        diff,
      };
    }

    FileUtils.writeFile(filePath, newContent);

    const diff = this.generateDiff(lines, newLines);
    const newChecksum = HashUtils.hashContent(newContent);

    const output = this.formatPatchResult(filePath, opType, {
      linesRemoved,
      linesAdded,
      newTotal: newLines.length,
      checksum: { before: checksum, after: newChecksum },
      diff,
    }, options);

    return {
      ok: true,
      command: 'patch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      opType,
      linesRemoved,
      linesAdded,
      newTotal: newLines.length,
      checksum: { before: checksum, after: newChecksum },
    };
  }

  private async createBackup(filePath: string, checksum: string): Promise<void> {
    const backupDir = path.join(this.configManager.getBackupsDir(), checksum);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, path.basename(filePath));
    const content = FileUtils.readFile(filePath);
    fs.writeFileSync(backupPath, content, 'utf-8');
  }

  private replaceLines(lines: string[], start: number, end: number, withText: string): any {
    const removed = end - start + 1;
    const added = withText.split('\n').length;

    const newLines = [
      ...lines.slice(0, start - 1),
      ...withText.split('\n'),
      ...lines.slice(end),
    ];

    return {
      content: newLines.join('\n'),
      removed,
      added,
    };
  }

  private insertAfterLine(lines: string[], lineNum: number, content: string): any {
    const added = content.split('\n').length;
    const newLines = [...lines];
    newLines.splice(lineNum, 0, ...content.split('\n'));

    return {
      content: newLines.join('\n'),
      added,
    };
  }

  private insertBeforeLine(lines: string[], lineNum: number, content: string): any {
    const added = content.split('\n').length;
    const newLines = [...lines];
    newLines.splice(lineNum - 1, 0, ...content.split('\n'));

    return {
      content: newLines.join('\n'),
      added,
    };
  }

  private deleteLines(lines: string[], start: number, end: number): any {
    const removed = end - start + 1;
    const newLines = [
      ...lines.slice(0, start - 1),
      ...lines.slice(end),
    ];

    return {
      content: newLines.join('\n'),
      removed,
      added: 0,
    };
  }

  private generateDiff(oldLines: string[], newLines: string[]): string {
    const diff: string[] = [];

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        continue;
      }

      if (oldLine && !newLine) {
        diff.push(`- ${oldLine}`);
      } else if (!oldLine && newLine) {
        diff.push(`+ ${newLine}`);
      } else if (oldLine !== newLine) {
        diff.push(`- ${oldLine}`);
        diff.push(`+ ${newLine}`);
      }
    }

    return diff.join('\n');
  }

  private formatPatchResult(filePath: string, opType: string, result: any, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      if (result.dryRun) {
        lines.push(`ok true  ${opType}  [dry-run]`);
      } else {
        lines.push(`ok true  ${opType}  -${result.linesRemoved} +${result.linesAdded}  total:${result.newTotal}`);
        if (result.checksum) {
          lines.push(`checksum: ${result.checksum.after.substring(0, 8)}...`);
        }
      }
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        operation: opType,
        file: filePath,
        dryRun: result.dryRun || false,
        linesRemoved: result.linesRemoved,
        linesAdded: result.linesAdded,
        newTotal: result.newTotal,
        checksum: result.checksum,
        diff: result.diff,
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`file: ${filePath}`);
      lines.push(`op: ${opType}  lines: -${result.linesRemoved} +${result.linesAdded}  new-total: ${result.newTotal}`);
      
      if (result.dryRun) {
        lines.push(`dry-run: true`);
      }

      if (result.checksum) {
        lines.push(`checksum: ${result.checksum.before.substring(0, 8)} → ${result.checksum.after.substring(0, 8)}`);
      }

      if (result.diff && result.diff.length > 0) {
        lines.push(`---`);
        lines.push(result.diff);
      }
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      filePath: args[0],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--replace' && nextArg) {
        options.replace = nextArg;
        i++;
      } else if (arg === '--with' && nextArg) {
        options.with = nextArg;
        i++;
      } else if (arg === '--insert-after' && nextArg) {
        options.insertAfter = nextArg;
        i++;
      } else if (arg === '--content' && nextArg) {
        options.content = nextArg;
        i++;
      } else if (arg === '--insert-before' && nextArg) {
        options.insertBefore = nextArg;
        i++;
      } else if (arg === '--delete' && nextArg) {
        options.delete = nextArg;
        i++;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--no-backup') {
        options.noBackup = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
