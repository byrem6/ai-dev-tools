import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class MoveCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('move', args, async () => {
      if (!options.source) {
        throw createError('ENOMATCH', '', 'Usage: adt move <source> <destination> [options]');
      }

      if (!options.destination) {
        throw createError('ENOMATCH', '', 'Missing <destination> path');
      }

      return this.performMove(options.source, options.destination, options);
    });
  }

  private async performMove(source: string, destination: string, options: any): Promise<CommandResult> {
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

    let importUpdates: any[] = [];

    if (options.updateImports !== false) {
      importUpdates = await this.updateImportPaths(resolvedSource, resolvedDest, options);
    }

    fs.renameSync(resolvedSource, resolvedDest);

    const output = this.formatMoveOutput(resolvedSource, resolvedDest, importUpdates, options);

    return {
      ok: true,
      command: 'move',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      source: resolvedSource,
      destination: resolvedDest,
      importUpdates,
    };
  }

  private async updateImportPaths(source: string, dest: string, options: any): Promise<any[]> {
    const updates: any[] = [];
    const isSourceDir = fs.statSync(source).isDirectory();

    if (!isSourceDir) {
      const sourceDir = path.dirname(source);
      const destDir = path.dirname(dest);
      const sourceName = path.basename(source, path.extname(source));
      
      const exts = ['ts', 'tsx', 'js', 'jsx'];
      const pattern = `**/*.{${exts.join(',')}}`;

      const files = await fg.glob(pattern, {
        cwd: process.cwd(),
        onlyFiles: true,
        absolute: true,
        ignore: this.configManager.getExcludeGlobs(),
      });

      for (const file of files.slice(0, 100)) {
        try {
          const content = FileUtils.readFile(file);
          const relativePath = path.relative(process.cwd(), file);
          let newContent = content;
          let fileUpdates = 0;
          const lines: number[] = [];

          const importRegex = /(?:import|export|require)\s+(?:(?:\{[^}]*\}|\*)\s+from\s+)?['"]([^'"]+)['"]/g;
          
          let match;
          while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            const oldResolved = path.resolve(path.dirname(file), importPath);
            const oldExt = path.extname(oldResolved);
            
            if (oldResolved === source || (oldResolved + '.ts' === source) || (oldResolved + '.js' === source)) {
              const newImportPath = this.calculateNewImportPath(file, dest);
              
              if (newImportPath !== importPath) {
                const lineNum = content.substring(0, match.index).split('\n').length;
                lines.push(lineNum);
                
                newContent = newContent.replace(match[0], match[0].replace(importPath, newImportPath));
                fileUpdates++;
              }
            }
          }

          if (fileUpdates > 0) {
            updates.push({
              file: relativePath,
              updates: fileUpdates,
              lines,
            });

            if (!options.dryRun) {
              fs.writeFileSync(file, newContent, 'utf-8');
            }
          }
        } catch {
          // Skip files that can't be processed
        }
      }
    }

    return updates;
  }

  private calculateNewImportPath(fromFile: string, toTarget: string): string {
    const fromDir = path.dirname(fromFile);
    const toDir = path.dirname(toTarget);
    const toName = path.basename(toTarget, path.extname(toTarget));
    
    let relativePath = path.relative(fromDir, toDir);
    
    if (relativePath !== '.') {
      relativePath = relativePath.replace(/\\/g, '/');
    }
    
    const importPath = relativePath === '.' ? `./${toName}` : `${relativePath}/${toName}`;
    
    return importPath;
  }

  private formatMoveOutput(source: string, dest: string, importUpdates: any[], options: any): string {
    const fmt = options.fmt || 'normal';
    const relativeSource = path.relative(process.cwd(), source);
    const relativeDest = path.relative(process.cwd(), dest);

    if (fmt === 'slim') {
      return `ok true  ${relativeSource} → ${relativeDest}  imports-updated: ${importUpdates.length}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'move',
        from: relativeSource,
        to: relativeDest,
        importUpdates: importUpdates.length,
        updates: importUpdates,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`from: ${relativeSource}`);
      lines.push(`to: ${relativeDest}`);
      lines.push(`imports-updated: ${importUpdates.length}`);
      
      if (importUpdates.length > 0) {
        lines.push('===');
        importUpdates.slice(0, 10).forEach(update => {
          lines.push(`${update.file}  (${update.updates})`);
        });
        
        if (importUpdates.length > 10) {
          lines.push(`... ${importUpdates.length - 10} more files`);
        }
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
      } else if (arg === '--no-update-imports') {
        options.updateImports = false;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
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
