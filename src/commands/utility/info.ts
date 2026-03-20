import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class InfoCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('info', args, async () => {
      if (!options.target) {
        throw createError('ENOMATCH', '', 'Usage: adt info <file>');
      }

      return this.getFileInfo(options.target, options);
    });
  }

  private async getFileInfo(filePath: string, options: any): Promise<CommandResult> {
    const resolvedPath = path.resolve(filePath);
    
    if (!FileUtils.fileExists(resolvedPath)) {
      throw createError('ENOENT', resolvedPath);
    }

    const info = FileUtils.getFileInfo(resolvedPath);
    const hash = HashUtils.hashFile(resolvedPath);
    const isBinary = info.encoding === 'binary';
    const platform = require('process').platform;
    
    const stats = fs.statSync(resolvedPath);
    const modified = new Date(stats.mtime).toISOString();
    const created = stats.birthtime ? new Date(stats.birthtime).toISOString() : modified;
    
    const output = this.formatInfo(resolvedPath, info, hash, isBinary, modified, created, options);

    return {
      ok: true,
      command: 'info',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      path: resolvedPath,
      info,
      hash,
      isBinary,
      modified,
      created,
    };
  }

  private formatInfo(filePath: string, info: any, hash: string, isBinary: boolean, modified: string, created: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`${info.type}  ${info.totalLines} lines  ${info.size} bytes`);
      lines.push(`encoding: ${info.encoding}  lineEnding: ${info.lineEnding}`);
      lines.push(`binary: ${isBinary ? 'yes' : 'no'}`);
      lines.push(`hash: ${hash.substring(0, 16)}...`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'info',
        path: filePath,
        type: info.type,
        size: info.size,
        totalLines: info.totalLines,
        encoding: info.encoding,
        lineEnding: info.lineEnding,
        isBinary,
        hash,
        modified,
        created,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`file: ${filePath}`);
      lines.push('===');
      lines.push(`type: ${info.type}`);
      lines.push(`size: ${info.size} bytes`);
      lines.push(`lines: ${info.totalLines}`);
      lines.push(`encoding: ${info.encoding}`);
      lines.push(`lineEnding: ${info.lineEnding}`);
      lines.push(`binary: ${isBinary ? 'yes' : 'no'}`);
      lines.push(`hash: ${hash}`);
      lines.push(`modified: ${modified}`);
      lines.push(`created: ${created}`);
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (!options.target) {
        options.target = arg;
      }
    }

    return options;
  }
}
