import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class StatsCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('stats', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.generateStats(targetPath, options);
    });
  }

  private async generateStats(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    let totalLines = 0;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    const extStats: Map<string, any> = new Map();

    for (const file of files) {
      const ext = FileUtils.getFileExtension(file);
      
      try {
        const info = FileUtils.getFileInfo(path.join(targetPath, file));
        const content = fs.readFileSync(path.join(targetPath, file), 'utf-8');
        const lines = content.split('\n');

        totalLines += info.totalLines;

        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed === '') {
            blankLines++;
          } else if (this.isCommentLine(line, ext)) {
            commentLines++;
          } else {
            codeLines++;
          }
        });

        if (!extStats.has(ext)) {
          extStats.set(ext, {
            extension: ext,
            files: 0,
            lines: 0,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
          });
        }

        const stats = extStats.get(ext);
        stats.files++;
        stats.lines += info.totalLines;
        stats.codeLines += this.countCodeLines(content, ext);
        stats.commentLines += this.countCommentLines(content, ext);
        stats.blankLines += this.countBlankLines(content);

        // Track largest files
        if (info.totalLines > 300) {
          if (!stats.largest) stats.largest = [];
          stats.largest.push({ file, lines: info.totalLines });
          stats.largest.sort((a: any, b: any) => b.lines - a.lines);
          stats.largest = stats.largest.slice(0, 5);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Calculate complexity
    const complexity = this.calculateComplexity(targetPath, files);

    const output = this.formatStats({
      totalFiles: files.length,
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      extensionBreakdown: Object.fromEntries(extStats),
      largestFiles: extStats.get('ts')?.largest || [],
      complexity,
    }, targetPath, options);

    return {
      ok: true,
      command: 'stats',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      stats: {
        totalFiles: files.length,
        totalLines,
        codeLines,
        commentLines,
        blankLines,
        extensionBreakdown: Object.fromEntries(extStats),
        largestFiles: extStats.get('ts')?.largest || [],
        complexity,
      },
      path: targetPath,
    };
  }

  private countCodeLines(content: string, ext: string): number {
    return content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed !== '' && !this.isCommentLine(line, ext);
    }).length;
  }

  private countCommentLines(content: string, ext: string): number {
    return content.split('\n').filter(line => this.isCommentLine(line, ext)).length;
  }

  private countBlankLines(content: string): number {
    return content.split('\n').filter(line => line.trim() === '').length;
  }

  private isCommentLine(line: string, ext: string): boolean {
    const trimmed = line.trim();
    
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      return trimmed.startsWith('//') ||
             trimmed.startsWith('/*') ||
             trimmed.startsWith('*') ||
             (trimmed.startsWith('/*') && !trimmed.includes('*/'));
    } else if (ext === 'py') {
      return trimmed.startsWith('#');
    }
    
    return false;
  }

  private calculateComplexity(targetPath: string, files: string[]): any {
    // Simple complexity: lines per file, nesting depth
    const complexities: any[] = [];

    for (const file of files.slice(0, 20)) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) {
        continue;
      }

      try {
        const filePath = path.join(targetPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let maxDepth = 0;
        let currentDepth = 0;

        lines.forEach(line => {
          const openCount = (line.match(/\{/g) || []).length;
          const closeCount = (line.match(/\}/g) || []).length;
          
          currentDepth += openCount - closeCount;
          
          if (currentDepth > maxDepth) {
            maxDepth = currentDepth;
          }

          // Reset depth at end of line
          currentDepth = Math.max(0, currentDepth);
        });

        if (lines.length > 100) {
          complexities.push({
            file,
            lines: lines.length,
            complexity: maxDepth + Math.floor(lines.length / 100),
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    complexities.sort((a, b) => b.complexity - a.complexity);

    return {
      highComplexity: complexities.filter(c => c.complexity > 10).slice(0, 5),
      largestFiles: complexities.slice(0, 5),
    };
  }

  private formatStats(stats: any, targetPath: string, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      lines.push(`${stats.totalFiles} files  ${stats.totalLines} lines`);
      lines.push(`code: ${stats.codeLines}  comments: ${stats.commentLines}  blank: ${stats.blankLines}`);
      
      const ts = stats.extensionBreakdown['ts'];
      if (ts) {
        lines.push(`ts: ${ts.files}f/${ts.lines}l`);
      }

      if (stats.largestFiles.length > 0) {
        lines.push(`largest: ${stats.largestFiles.map((f: any) => `${path.basename(f.file)}:${f.lines}`).slice(0, 3).join('  ')}`);
      }
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        path: targetPath,
        ...stats,
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`path: ${targetPath}`);
      lines.push(`~tokens: ${TokenUtils.estimateTokens('')}`);
      lines.push('===');
      lines.push(`files: ${stats.totalFiles}`);
      lines.push(`lines: ${stats.totalLines}`);
      lines.push(`code: ${stats.codeLines}   comments: ${stats.commentLines}   blank: ${stats.blankLines}`);
      lines.push('by extension:');
      
      Object.entries(stats.extensionBreakdown)
        .sort(([, a]: [string, any], [, b]: [string, any]) => (b as any).files - (a as any).files)
        .slice(0, 10)
        .forEach(([ext, stat]: [string, any]) => {
          lines.push(`  .${ext}  ${stat.files} files  ${stat.lines} lines  (${stat.codeLines} code)`);
        });

      if (stats.largestFiles.length > 0) {
        lines.push('');
        lines.push('largest files:');
        stats.largestFiles.slice(0, 5).forEach((f: any) => {
          const complexity = f.complexity ? `  [complexity: ${f.complexity}]` : '';
          lines.push(`  ${path.basename(f.file)}  ${f.lines} lines${complexity}`);
        });
      }

      if (stats.complexity?.highComplexity?.length > 0) {
        lines.push('');
        lines.push('most complex:');
        stats.complexity.highComplexity.forEach((c: any) => {
          lines.push(`  ${path.basename(c.file)}  complexity: ${c.complexity}`);
        });
      }
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      path: args[0],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
