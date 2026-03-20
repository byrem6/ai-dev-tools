import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class CopyCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('copy', args, async () => {
      if (!options.source) {
        throw createError('ENOMATCH', '', 'Usage: adt copy <source> <destination> [options]');
      }

      if (!options.destination) {
        throw createError('ENOMATCH', '', 'Missing <destination> path');
      }

      return this.performCopy(options.source, options.destination, options);
    });
  }

  private async performCopy(source: string, destination: string, options: any): Promise<CommandResult> {
    const resolvedSource = path.resolve(source);
    const resolvedDest = path.resolve(destination);

    if (!FileUtils.fileExists(resolvedSource)) {
      throw createError('ENOENT', resolvedSource);
    }

    const stats = fs.statSync(resolvedSource);
    const isDirectory = stats.isDirectory();
    const destDir = path.dirname(resolvedDest);

    if (!FileUtils.fileExists(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (FileUtils.fileExists(resolvedDest) && !options.overwrite) {
      throw createError('EEXIST', resolvedDest, 'Destination already exists. Use --overwrite to replace');
    }

    if (isDirectory) {
      fs.cpSync(resolvedSource, resolvedDest, { recursive: true, force: options.overwrite || false });
    } else {
      fs.copyFileSync(resolvedSource, resolvedDest);
    }

    const sourceInfo = FileUtils.getFileInfo(resolvedSource);
    const destInfo = FileUtils.getFileInfo(resolvedDest);

    const output = this.formatCopyOutput(resolvedSource, resolvedDest, isDirectory, sourceInfo.size, options);

    return {
      ok: true,
      command: 'copy',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      source: resolvedSource,
      destination: resolvedDest,
      type: isDirectory ? 'directory' : 'file',
      size: sourceInfo.size,
    };
  }

  private formatCopyOutput(source: string, dest: string, isDirectory: boolean, size: number, options: any): string {
    const fmt = options.fmt || 'normal';
    const relativeSource = path.relative(process.cwd(), source);
    const relativeDest = path.relative(process.cwd(), dest);

    if (fmt === 'slim') {
      return `ok true  ${relativeSource} → ${relativeDest}  type: ${isDirectory ? 'dir' : 'file'}  size: ${size}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'copy',
        from: relativeSource,
        to: relativeDest,
        type: isDirectory ? 'directory' : 'file',
        size,
        sizeHuman: `${size} bytes`,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`from: ${relativeSource}`);
      lines.push(`to: ${relativeDest}`);
      lines.push(`type: ${isDirectory ? 'directory' : 'file'}  size: ${size} bytes`);
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--overwrite') {
        options.overwrite = true;
      } else if (!options.source) {
        options.source = arg;
      } else if (!options.destination) {
        options.destination = arg;
      }
    }

    return options;
  }
}
