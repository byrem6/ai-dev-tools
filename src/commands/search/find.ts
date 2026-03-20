import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class FindCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('find', args, async () => {
      // Get query from args or options
      let query = args.find(arg => !arg.startsWith('--'));
      
      // If no query provided, use wildcard
      if (!query && !options.name) {
        query = '*';
      }
      
      // If path is provided as first arg and it's a directory
      const targetPath = options.path || process.cwd();
      
      if (query && fs.existsSync(query) && fs.statSync(query).isDirectory()) {
        // First arg is a directory, use it as path
        return this.findFiles('*', query, options);
      }

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath, `Target path not found: ${targetPath}. Try: adt tree . --fmt slim`);
      }

      return this.findFiles(query || '*', targetPath, options);
    });
  }

  private async findFiles(query: string, targetPath: string, options: any): Promise<CommandResult> {
    const searchResults: any[] = [];

    // Build glob pattern from query
    const patterns = this.buildGlobPatterns(query, options);
    
    for (const pattern of patterns) {
      try {
        const files = await fg.glob(pattern, {
          cwd: targetPath,
          onlyFiles: options.type !== 'd',
          onlyDirectories: options.type === 'd',
          absolute: false,
          ignore: options.exclude ? options.exclude.split(',') : this.configManager.config.excludeByDefault,
          deep: options.depth || undefined,
        });

        for (const file of files) {
          const filePath = path.join(targetPath, file);
          
          try {
            const stat = fs.statSync(filePath);
            const result: any = {
              path: file,
              fullPath: filePath,
              type: stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'symlink' : 'file',
              size: stat.size,
              modified: stat.mtime,
            };

            // Additional filters
            if (options.contains && !this.checkFileContains(filePath, options.contains)) {
              continue;
            }
            
            if (options.sizeGt && stat.size <= parseInt(options.sizeGt) * 1024) {
              continue;
            }
            
            if (options.sizeLt && stat.size >= parseInt(options.sizeLt) * 1024) {
              continue;
            }

            if (options.empty && stat.size !== 0) {
              continue;
            }

            searchResults.push(result);
          } catch {
            // Stat error, skip
          }
        }
      } catch {
        // Glob pattern error, skip
      }
    }

    // Remove duplicates
    const uniqueResults = this.removeDuplicates(searchResults);
    
    // Sort results
    const sortedResults = this.sortResults(uniqueResults, options);
    
    // Limit results
    const limitedResults = sortedResults.slice(0, options.max || 100);

    const output = this.formatFindResults(limitedResults, query, options);
    
    return {
      ok: true,
      command: 'find',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      query,
      results: limitedResults,
      count: limitedResults.length,
    };
  }

  private buildGlobPatterns(query: string, options: any): string[] {
    const patterns: string[] = [];

    // If query contains wildcards, use it directly
    if (query.includes('*') || query.includes('?')) {
      patterns.push(query);
    } else {
      // Name pattern matching
      if (options.name) {
        patterns.push(options.name);
      } else {
        // Search for files containing query in name
        patterns.push(`*${query}*`);
        patterns.push(`**/*${query}*`);
      }
    }

    // Extension filter
    if (options.ext) {
      const exts = options.ext.split(',');
      const expanded = patterns.flatMap((p: string) => 
        exts.map((ext: string) => p.replace(/\.\w+$/g, `.${ext}`))
      );
      patterns.push(...expanded);
    }

    return patterns;
  }

  private checkFileContains(filePath: string, searchText: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.includes(searchText);
    } catch {
      return false;
    }
  }

  private removeDuplicates(results: any[]): any[] {
    const seen = new Set<string>();
    return results.filter(r => {
      const key = r.path;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sortResults(results: any[], options: any): any[] {
    const sortBy = options.sort || 'name';
    
    return results.sort((a, b) => {
      switch (sortBy) {
        case 'size':
          return b.size - a.size;
        case 'modified':
          return b.modified.getTime() - a.modified.getTime();
        case 'name':
        default:
          return a.path.localeCompare(b.path);
      }
    });
  }

  private formatFindResults(results: any[], query: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (results.length === 0) {
        return `ok true\nno results for: ${query}`;
      }
      
      const lines: string[] = [];
      results.forEach(r => {
        const typeChar = r.type === 'directory' ? '/' : r.type === 'symlink' ? '@' : '';
        lines.push(`${r.path}${typeChar}  ${this.formatSize(r.size)}`);
      });
      lines.push(`---`);
      lines.push(`${results.length} results`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'find',
        query,
        count: results.length,
        results: results.map(r => ({
          ...r,
          modified: r.modified.toISOString(),
        })),
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`query: ${query}`);
      lines.push(`found: ${results.length}`);
      lines.push('===');
      
      results.forEach(r => {
        const typeChar = r.type === 'directory' ? '/' : r.type === 'symlink' ? '@' : '';
        const size = r.type === 'file' ? this.formatSize(r.size) : '';
        const modified = r.modified ? r.modified.toISOString().split('T')[0] : '';
        lines.push(`${r.path}${typeChar}  ${size}  ${modified}`);
      });
      
      return lines.join('\n');
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
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
        } else if (key === 'name') {
          options.name = args[++i];
        } else if (key === 'ext') {
          options.ext = args[++i];
        } else if (key === 'type') {
          options.type = args[++i];
        } else if (key === 'contains') {
          options.contains = args[++i];
        } else if (key === 'size-gt') {
          options.sizeGt = args[++i];
        } else if (key === 'size-lt') {
          options.sizeLt = args[++i];
        } else if (key === 'empty') {
          options.empty = true;
        } else if (key === 'sort') {
          options.sort = args[++i];
        } else if (key === 'max') {
          options.max = parseInt(args[++i]) || 100;
        } else if (key === 'depth') {
          options.depth = parseInt(args[++i]);
        } else if (key === 'exclude') {
          options.exclude = args[++i];
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
