import { Command } from './command';
import { CommandResult, OutputFormat } from '../types';
import { FileUtils } from '../utils/file';
import { TokenUtils } from '../utils/token';
import { createError } from './error';

export abstract class BaseCommand extends Command {
  abstract execute(...args: string[]): Promise<CommandResult>;
  protected formatList(items: string[], options: any, label?: string): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return items.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: this.getCommandName(),
        [label || 'items']: items,
        total: items.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      if (label) {
        lines.push(`${label}: ${items.length}`);
      }
      lines.push('===');
      items.slice(0, 50).forEach(item => lines.push(item));
      return lines.join('\n');
    }
  }

  protected formatKeyValue(
    data: Record<string, any>,
    options: any,
    label?: string
  ): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      Object.keys(data).forEach(key => {
        lines.push(`${key}=${data[key] || '<not set>'}`);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: this.getCommandName(),
        [label || 'data']: data,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push('===');
      Object.keys(data).forEach(key => {
        lines.push(`${key}=${data[key] || '<not set>'}`);
      });
      return lines.join('\n');
    }
  }

  protected formatCheckList(
    present: string[],
    missing: string[],
    options: any
  ): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok ${missing.length === 0 ? 'true' : 'false'}`);

      present.forEach(key => lines.push(`✓ ${key}`));
      missing.forEach(key => lines.push(`✗ ${key}  [MISSING]`));

      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: missing.length === 0,
        command: this.getCommandName(),
        present,
        missing,
        allPresent: missing.length === 0,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${missing.length === 0 ? 'true' : 'false'}`);

      if (present.length > 0) {
        lines.push('present:');
        present.forEach(key => lines.push(`  ✓ ${key}`));
      }

      if (missing.length > 0) {
        lines.push('missing:');
        missing.forEach(key => lines.push(`  ✗ ${key}`));
      }

      return lines.join('\n');
    }
  }

  protected parseStandardArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (key.includes('=')) {
          const [k, v] = key.split('=');
          options[k] = v;
        } else {
          options[key] = true;
        }
      }
    }

    return options;
  }

  protected getCommandName(): string {
    return this.constructor.name.replace('Command', '').toLowerCase();
  }

  protected async safeFileRead(filePath: string): Promise<string> {
    if (!FileUtils.fileExists(filePath)) {
      throw createError('ENOENT', filePath);
    }
    return FileUtils.readFile(filePath);
  }

  protected async safeFileWrite(filePath: string, content: string): Promise<void> {
    const { writeFileSync } = require('fs');
    const { resolve, dirname } = require('path');

    const fullPath = resolve(process.cwd(), filePath);
    const dir = dirname(fullPath);

    const { mkdirSync } = require('fs');
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    writeFileSync(fullPath, content, 'utf-8');
  }

  protected async safeFileDelete(filePath: string): Promise<void> {
    const { unlinkSync } = require('fs');
    const { resolve } = require('path');

    const fullPath = resolve(process.cwd(), filePath);

    if (!FileUtils.fileExists(fullPath)) {
      throw createError('ENOENT', fullPath);
    }

    unlinkSync(fullPath);
  }

  protected createBackup(filePath: string): string {
    const { copyFileSync, existsSync, mkdirSync } = require('fs');
    const { resolve, dirname, basename } = require('path');
    const { v4: uuidv4 } = require('uuid');

    const fullPath = resolve(process.cwd(), filePath);
    const backupDir = resolve(process.cwd(), '.adt', 'backups');

    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const backupName = `${basename(fullPath)}.${uuidv4()}.backup`;
    const backupPath = resolve(backupDir, backupName);

    copyFileSync(fullPath, backupPath);

    return backupPath;
  }
}
