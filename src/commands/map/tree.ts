import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class TreeCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('tree', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.generateTree(targetPath, options);
    });
  }

  private async generateTree(targetPath: string, options: any): Promise<CommandResult> {
    const maxDepth = options.depth || 3;
    const tree = await this.buildTree(targetPath, 0, maxDepth, options);

    const output = this.formatTree(tree, targetPath, options);

    return {
      ok: true,
      command: 'tree',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tree,
      path: targetPath,
    };
  }

  private async buildTree(targetPath: string, currentDepth: number, maxDepth: number, options: any): Promise<any[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const result: any[] = [];

    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path.join(targetPath, name);

      // Skip if in ignore list
      if (this.shouldIgnore(name, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const children = await this.buildTree(fullPath, currentDepth + 1, maxDepth, options);
        result.push({
          name,
          type: 'directory',
          children,
          path: fullPath,
          depth: currentDepth,
        });
      } else if (entry.isFile()) {
        const info = this.getFileInfo(fullPath);
        result.push({
          name,
          type: 'file',
          info,
          path: fullPath,
          depth: currentDepth,
        });
      }
    }

    // Sort: directories first, then files, then alphabetically
    result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  private getFileInfo(filePath: string): any {
    try {
      const info = FileUtils.getFileInfo(filePath);
      return {
        size: info.sizeHuman,
        lines: info.totalLines,
        ext: FileUtils.getFileExtension(filePath),
      };
    } catch {
      return {
        size: 'unknown',
        lines: 0,
        ext: FileUtils.getFileExtension(filePath),
      };
    }
  }

  private shouldIgnore(name: string, fullPath: string): boolean {
    const ignore = this.configManager.get('excludeByDefault');
    
    // Check directory name
    const dirName = path.basename(fullPath);
    if (ignore.includes(dirName)) {
      return true;
    }

    // Check .gitignore if it exists
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      const patterns = gitignore.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .filter(line => !line.startsWith('!'));
      
      // Simple gitignore matching
      for (const pattern of patterns) {
        if (this.matchGitignore(name, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchGitignore(name: string, pattern: string): boolean {
    // Simple gitignore pattern matching
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(regex).test(name);
  }

  private formatTree(tree: any[], targetPath: string, options: any): string {
    const lines: string[] = [];

    this.formatTreeNode(tree, lines, '', options);

    if (options.fmt !== 'json') {
      const totalFiles = tree.reduce((count: number, node: any) => {
        if (node.type === 'file') return count + 1;
        if (node.children) {
          return count + node.children.reduce((c: number, n: any) => c + this.countFiles(n), 0);
        }
        return count;
      }, 0);

      const totalDirs = tree.reduce((count: number, node: any) => {
        if (node.type === 'directory') return count + 1;
        if (node.children) {
          return count + node.children.reduce((c: number, n: any) => c + this.countDirs(n), 0);
        }
        return count;
      }, 0);

      lines.push('');
      lines.push(`${totalFiles} files  ${totalDirs} dirs`);
      lines.push(`~tokens:${TokenUtils.estimateTokens(lines.join('\n'))}`);
    }

    return lines.join('\n');
  }

  private countFiles(node: any): number {
    if (node.type === 'file') return 1;
    if (node.children) {
      return node.children.reduce((count: number, child: any) => count + this.countFiles(child), 0);
    }
    return 0;
  }

  private countDirs(node: any): number {
    if (node.type === 'directory') return 1;
    if (node.children) {
      return node.children.reduce((count: number, child: any) => count + this.countDirs(child), 0);
    }
    return 0;
  }

  private formatTreeNode(nodes: any[], lines: string[], prefix: string, options: any): void {
    const isLast = (index: number) => index === nodes.length - 1;
    
    nodes.forEach((node: any, index: number) => {
      const isLastNode = index === nodes.length - 1;
      const connector = isLastNode ? '└─ ' : '├─ ';
      const childPrefix = isLastNode ? '    ' : '│   ';

      let line = `${prefix}${connector}${node.name}`;

      if (node.type === 'file' && node.info) {
        if (options.showSize && node.info.size) {
          line += `  ${node.info.size}`;
        }
        if (options.showLines && node.info.lines) {
          line += `  ${node.info.lines} lines`;
        }
      }

      lines.push(line);

      if (node.children && node.children.length > 0) {
        this.formatTreeNode(node.children, lines, prefix + childPrefix, options);
      }
    });
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '-d' || (arg === '--depth' && nextArg)) {
        options.depth = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--show-size') {
        options.showSize = true;
      } else if (arg === '--show-lines') {
        options.showLines = true;
      } else if (arg === '--gitignore') {
        options.gitignore = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      } else if (!arg.startsWith('--') && !arg.startsWith('-') && options.path === undefined) {
        options.path = arg;
      }
    }

    return options;
  }
}
