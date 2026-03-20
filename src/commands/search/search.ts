import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';

export class SearchCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('search', args, async () => {
      const patterns = options.multi || [];
      const targetPath = options.path || process.cwd();

      if (patterns.length === 0) {
        throw createError('ENOMATCH', '', 'Usage: adt search --multi <pattern1> <pattern2> [...]');
      }

      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.multiPatternSearch(patterns, targetPath, options);
    });
  }

  private async multiPatternSearch(patterns: string[], targetPath: string, options: any): Promise<CommandResult> {
    const extensions = options.ext ? options.ext.split(',') : ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'];
    
    const files = await fg.glob(`**/*.{${extensions.join(',')}}`, {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.config.excludeByDefault,
    });

    const results: any[] = [];
    
    for (const file of files.slice(0, options.maxFiles || 100)) {
      const filePath = require('path').join(targetPath, file);
      
      try {
        const content = FileUtils.readFile(filePath);
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;
          
          // Check if line matches all patterns (AND logic) or any pattern (OR logic)
          const matches = this.checkPatterns(line, patterns, options);
          
          if (matches) {
            // Check NOT pattern
            if (options.not && this.checkPatterns(line, [options.not], { regex: false })) {
              continue;
            }

            results.push({
              file,
              line: lineNum,
              text: line.trim(),
              matches: this.getMatchedPatterns(line, patterns),
            });
          }
        }
      } catch {
        // File read error, skip
      }
    }

    const output = this.formatSearchResults(results, patterns, options);
    
    return {
      ok: true,
      command: 'search',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      patterns,
      results,
      count: results.length,
    };
  }

  private checkPatterns(line: string, patterns: string[], options: any): boolean {
    const useRegex = options.regex || options.r;
    
    for (const pattern of patterns) {
      let matches = false;
      
      if (useRegex) {
        try {
          const regex = new RegExp(pattern, options.i ? 'i' : '');
          matches = regex.test(line);
        } catch {
          // Invalid regex, try as string match
          matches = options.i 
            ? line.toLowerCase().includes(pattern.toLowerCase())
            : line.includes(pattern);
        }
      } else {
        matches = options.i
          ? line.toLowerCase().includes(pattern.toLowerCase())
          : line.includes(pattern);
      }
      
      if (options.and && !matches) {
        return false; // AND logic: all must match
      }
      
      if (!options.and && matches) {
        return true; // OR logic: any can match
      }
    }
    
    return options.and ? true : false;
  }

  private getMatchedPatterns(line: string, patterns: string[]): string[] {
    const matched: string[] = [];
    
    for (const pattern of patterns) {
      if (line.toLowerCase().includes(pattern.toLowerCase())) {
        matched.push(pattern);
      }
    }
    
    return matched;
  }

  private formatSearchResults(results: any[], patterns: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      
      results.slice(0, options.max || 50).forEach(r => {
        lines.push(`${r.file}:${r.line}: ${r.text.substring(0, 100)}`);
      });
      
      if (results.length > (options.max || 50)) {
        lines.push(`... and ${results.length - (options.max || 50)} more`);
      }
      
      lines.push(`---`);
      lines.push(`${results.length} matches  ${results.length > 0 ? results[0].file + ' etc.' : ''}`);
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'search',
        patterns,
        logic: options.and ? 'AND' : 'OR',
        count: results.length,
        results: results.slice(0, options.max || 100),
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('command: search');
      lines.push(`patterns: ${patterns.join(', ')}`);
      lines.push(`logic: ${options.and ? 'AND' : 'OR'}`);
      lines.push(`matches: ${results.length}`);
      lines.push('===');
      
      // Group by file
      const byFile = new Map<string, any[]>();
      results.forEach(r => {
        if (!byFile.has(r.file)) {
          byFile.set(r.file, []);
        }
        byFile.get(r.file)!.push(r);
      });
      
      byFile.forEach((fileResults, file) => {
        lines.push(`${file} (${fileResults.length} matches):`);
        fileResults.slice(0, 10).forEach(r => {
          lines.push(`  :${r.line}  ${r.text.substring(0, 80)}`);
        });
        if (fileResults.length > 10) {
          lines.push(`  ... and ${fileResults.length - 10} more`);
        }
      });
      
      return lines.join('\n');
    }
  }

  protected parseArgs(args: string[]): any {
    const options: any = {};
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (key === 'fmt') {
          options.fmt = args[++i];
        } else if (key === 'path') {
          options.path = args[++i];
        } else if (key === 'ext') {
          options.ext = args[++i];
        } else if (key === 'multi') {
          options.multi = [];
          while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
            options.multi.push(args[++i]);
          }
        } else if (key === 'and') {
          options.and = true;
        } else if (key === 'not') {
          options.not = args[++i];
        } else if (key === 'regex' || key === 'r') {
          options.regex = true;
        } else if (key === 'i') {
          options.i = true;
        } else if (key === 'max') {
          options.max = parseInt(args[++i]) || 50;
        } else if (key === 'max-files') {
          options.maxFiles = parseInt(args[++i]) || 100;
        } else {
          options[key] = true;
        }
      } else {
        positional.push(arg);
      }
    }

    options._ = positional;
    return options;
  }
}
