import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface DuplicateGroup {
  hash: string;
  size: number;
  lines: number;
  files: string[];
  sample?: string;
}

export class DuplicateCommand extends Command {
  public getDescription(): string {
    return 'Find duplicate code';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('duplicate', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.findDuplicates(targetPath, options);
    });
  }

  private async findDuplicates(targetPath: string, options: any): Promise<CommandResult> {
    const minLines = options.lines || 5;
    const minSize = options.size || 100;
    const extension = options.ext || options.extension;
    const ignoreWhitespace = options.whitespace !== false;

    const patterns = extension 
      ? [`**/*.${extension.replace(/^\./, '')}`]
      : ['**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,go,rs}'];

    const files = await fg.glob(patterns, {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.adt/**',
        '**/*.min.js',
        '**/*.bundle.js',
      ],
    });

    const codeBlocks = new Map<string, DuplicateGroup>();

    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      try {
        const content = FileUtils.readFile(fullPath);
        const lines = content.split('\n');
        
        this.scanFileForDuplicates(file, lines, minLines, ignoreWhitespace, codeBlocks);
      } catch {
        // Skip files that can't be read
      }
    }

    const duplicates = Array.from(codeBlocks.values())
      .filter(group => group.files.length > 1)
      .sort((a, b) => b.files.length - a.files.length);

    const output = this.formatDuplicates(duplicates, options);

    return {
      ok: true,
      command: 'duplicate',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      duplicates,
      total: duplicates.length,
      duplicateFileCount: duplicates.reduce((sum, g) => sum + g.files.length, 0),
    };
  }

  private scanFileForDuplicates(
    filePath: string, 
    lines: string[], 
    minLines: number,
    ignoreWhitespace: boolean,
    codeBlocks: Map<string, DuplicateGroup>
  ): void {
    for (let i = 0; i <= lines.length - minLines; i++) {
      const block = lines.slice(i, i + minLines);
      const hash = this.hashBlock(block, ignoreWhitespace);
      
      if (!codeBlocks.has(hash)) {
        codeBlocks.set(hash, {
          hash,
          size: block.join('\n').length,
          lines: minLines,
          files: [],
          sample: block[0],
        });
      }
      
      const group = codeBlocks.get(hash)!;
      if (!group.files.includes(filePath)) {
        group.files.push(filePath);
      }
    }
  }

  private hashBlock(lines: string[], ignoreWhitespace: boolean): string {
    let content = lines.join('\n');
    
    if (ignoreWhitespace) {
      content = content.replace(/\s+/g, ' ').trim();
    }
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  private formatDuplicates(duplicates: DuplicateGroup[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`groups: ${duplicates.length}`);
      
      for (const dup of duplicates) {
        lines.push(``);
        lines.push(`  ${dup.files.length} files  ${dup.lines} lines  ${dup.sample?.substring(0, 50)}...`);
        for (const file of dup.files) {
          lines.push(`    ${file}`);
        }
      }
      
      if (duplicates.length === 0) {
        lines.push(`No duplicate code blocks found`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: true, duplicates }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: duplicate`);
      lines.push(`total: ${duplicates.length}`);
      lines.push(`===`);

      for (const dup of duplicates) {
        lines.push(``);
        lines.push(`Count: ${dup.files.length}  Lines: ${dup.lines}  Size: ${dup.size}`);
        lines.push(`Sample: ${dup.sample?.substring(0, 60)}...`);
        lines.push(`Files:`);
        for (const file of dup.files) {
          lines.push(`  - ${file}`);
        }
      }

      if (duplicates.length === 0) {
        lines.push(`No duplicate code blocks found`);
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
      } else if (arg === '--lines') {
        options.lines = parseInt(args[++i], 10);
      } else if (arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (arg === '--size') {
        options.size = parseInt(args[++i], 10);
      } else if (arg === '--ext' || arg === '--extension') {
        options.ext = args[++i];
      } else if (arg === '--no-whitespace') {
        options.whitespace = false;
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
