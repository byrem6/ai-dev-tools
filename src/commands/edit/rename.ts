import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class RenameCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('rename', args, async () => {
      if (!options.old) {
        throw createError('ENOMATCH', '', 'Usage: adt rename <old> <new> [path] [options]');
      }

      if (!options.new) {
        throw createError('ENOMATCH', '', 'Missing <new> name');
      }

      const searchPath = options.path || process.cwd();
      return this.performRename(options.old, options.new, searchPath, options);
    });
  }

  private async performRename(oldName: string, newName: string, searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const renameType = options.type || this.detectRenameType(oldName, searchPath);
    const dryRun = options.dryRun || options.d;

    let changes: any[] = [];
    let totalChanges = 0;

    if (renameType === 'file' || renameType === 'auto') {
      const fileChanges = await this.renameFiles(oldName, newName, searchPath, dryRun);
      changes = changes.concat(fileChanges.changes);
      totalChanges += fileChanges.totalChanges;
    }

    if (renameType === 'symbol' || renameType === 'auto') {
      const symbolChanges = await this.renameSymbols(oldName, newName, searchPath, dryRun);
      changes = changes.concat(symbolChanges.changes);
      totalChanges += symbolChanges.totalChanges;
    }

    const output = this.formatRenameOutput(oldName, newName, totalChanges, changes, dryRun, options);

    return {
      ok: true,
      command: 'rename',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      oldName,
      newName,
      type: renameType,
      totalChanges,
      changes,
      dryRun,
    };
  }

  private detectRenameType(name: string, searchPath: string): string {
    const filePath = path.join(searchPath, name);
    if (FileUtils.fileExists(filePath)) {
      return 'file';
    }
    return 'symbol';
  }

  private async renameFiles(oldName: string, newName: string, searchPath: string, dryRun: boolean): Promise<any> {
    const changes: any[] = [];
    let totalChanges = 0;

    const filePath = path.join(searchPath, oldName);

    if (FileUtils.fileExists(filePath)) {
      const stats = fs.statSync(filePath);
      const destPath = path.join(searchPath, newName);
      
      changes.push({
        type: 'file',
        operation: 'rename',
        from: filePath,
        to: destPath,
      });

      totalChanges++;

      if (!dryRun) {
        fs.renameSync(filePath, destPath);
      }
    }

    return { changes, totalChanges };
  }

  private async renameSymbols(oldName: string, newName: string, searchPath: string, dryRun: boolean): Promise<any> {
    const changes: any[] = [];
    let totalChanges = 0;

    const exts = ['ts', 'tsx', 'js', 'jsx'];
    const pattern = `**/*.{${exts.join(',')}}`;

    const files = await fg.glob(pattern, {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const oldLower = oldName.toLowerCase();

    for (const file of files.slice(0, 100)) {
      try {
        const content = FileUtils.readFile(file);
        const relativePath = path.relative(searchPath, file);
        let newContent = content;
        let fileChanges = 0;
        const lines: number[] = [];

        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();
          const symbolDefs = symbols.filter(s => s.name.toLowerCase() === oldLower);

          symbolDefs.forEach(sym => {
            const lineNum = sym.line;
            const oldLine = content.split('\n')[lineNum - 1];
            const newLine = oldLine.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
            
            if (oldLine !== newLine) {
              lines.push(lineNum);
              fileChanges++;
              
              const linesArr = newContent.split('\n');
              linesArr[lineNum - 1] = newLine;
              newContent = linesArr.join('\n');
            }
          });
        }

        const regex = new RegExp(`\\b${oldName}\\b`, 'g');
        const matches = content.match(regex);
        if (matches) {
          newContent = content.replace(regex, newName);
          fileChanges = matches.length;
          
          let match;
          const regexG = new RegExp(`\\b${oldName}\\b`, 'g');
          while ((match = regexG.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            lines.push(lineNum);
          }
        }

        if (fileChanges > 0) {
          changes.push({
            type: 'symbol',
            file: relativePath,
            changes: fileChanges,
            lines: [...new Set(lines)].sort((a, b) => a - b),
          });

          totalChanges += fileChanges;

          if (!dryRun) {
            fs.writeFileSync(file, newContent, 'utf-8');
          }
        }
      } catch {
        // Skip files that can't be processed
      }
    }

    return { changes, totalChanges };
  }

  private formatRenameOutput(oldName: string, newName: string, totalChanges: number, changes: any[], dryRun: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true  ${oldName} → ${newName}  ${totalChanges} changes  ${changes.length} files${dryRun ? '  [dry-run]' : ''}`);
      
      changes.slice(0, 20).forEach(change => {
        if (change.type === 'file') {
          lines.push(`${path.relative(process.cwd(), change.from)} → ${path.basename(change.to)}`);
        } else {
          lines.push(`${change.file}  (${change.changes})`);
        }
      });
      
      if (changes.length > 20) {
        lines.push(`... ${changes.length - 20} more files`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'rename',
        oldName,
        newName,
        type: options.type || 'auto',
        totalChanges,
        files: changes.length,
        dryRun,
        changes: changes.slice(0, 50),
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`type: ${options.type || 'auto'}  old: ${oldName}  new: ${newName}`);
      lines.push(`total: ${totalChanges} changes  files: ${changes.length}${dryRun ? '  dry-run: true' : ''}`);
      lines.push('===');
      
      changes.slice(0, 10).forEach(change => {
        if (change.type === 'file') {
          lines.push(`${path.relative(process.cwd(), change.from)} → ${path.basename(change.to)}`);
        } else {
          lines.push(`${change.file}  (${change.changes})  lines: ${change.lines.slice(0, 3).join(', ')}${change.lines.length > 3 ? '...' : ''}`);
        }
      });
      
      if (changes.length > 10) {
        lines.push(`... ${changes.length - 10} more files`);
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
      } else if (arg === '--type') {
        options.type = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '-d' || arg === '--dry-run') {
        options.dryRun = true;
      } else if (!options.old) {
        options.old = arg;
      } else if (!options.new) {
        options.new = arg;
      }
    }

    return options;
  }
}
