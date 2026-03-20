import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class DeleteCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('delete', args, async () => {
      if (!options.target) {
        throw createError('ENOMATCH', '', 'Usage: adt delete <path> [options]');
      }

      return this.performDelete(options.target, options);
    });
  }

  private async performDelete(targetPath: string, options: any): Promise<CommandResult> {
    const resolvedPath = path.resolve(targetPath);

    if (!FileUtils.fileExists(resolvedPath)) {
      throw createError('ENOENT', resolvedPath);
    }

    const stats = fs.statSync(resolvedPath);
    const isDirectory = stats.isDirectory();
    const backupPath = await this.createBackup(resolvedPath);

    if (!options.force) {
      if (isDirectory) {
        const files = fs.readdirSync(resolvedPath);
        if (files.length > 0) {
          throw createError('ENOTEMPTY', resolvedPath, 'Directory not empty. Use --force to delete non-empty directories');
        }
      }
    }

    if (isDirectory) {
      fs.rmSync(resolvedPath, { recursive: true, force: options.force || false });
    } else {
      fs.unlinkSync(resolvedPath);
    }

    const output = this.formatDeleteOutput(resolvedPath, isDirectory, backupPath, options);

    return {
      ok: true,
      command: 'delete',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      path: resolvedPath,
      type: isDirectory ? 'directory' : 'file',
      backupPath,
    };
  }

  private async createBackup(targetPath: string): Promise<string> {
    const hash = HashUtils.hashFile(targetPath);
    const backupDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.adt', 'backups', hash);
    const backupPath = path.join(backupDir, path.basename(targetPath));

    try {
      fs.mkdirSync(backupDir, { recursive: true });
      
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.cpSync(targetPath, backupPath, { recursive: true });
      } else {
        fs.copyFileSync(targetPath, backupPath);
      }
      
      return backupPath;
    } catch (error) {
      // Backup failed, but continue with deletion
      return '';
    }
  }

  private formatDeleteOutput(targetPath: string, isDirectory: boolean, backupPath: string, options: any): string {
    const fmt = options.fmt || 'normal';
    const relativePath = path.relative(process.cwd(), targetPath);

    if (fmt === 'slim') {
      return `ok true  deleted: ${relativePath}  type: ${isDirectory ? 'dir' : 'file'}${backupPath ? '  backup: ' + backupPath : ''}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'delete',
        path: relativePath,
        type: isDirectory ? 'directory' : 'file',
        backupPath,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`deleted: ${relativePath}`);
      lines.push(`type: ${isDirectory ? 'directory' : 'file'}`);
      if (backupPath) {
        lines.push(`backup: ${backupPath}`);
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
      } else if (arg === '--force') {
        options.force = true;
      } else if (!options.target) {
        options.target = arg;
      }
    }

    return options;
  }
}
