import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class MapCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('map', args, async () => {
      let targetPath = options.path || process.cwd();
      
      // Resolve relative paths
      if (targetPath !== process.cwd() && !path.isAbsolute(targetPath)) {
        targetPath = path.resolve(process.cwd(), targetPath);
      }
      
      // Check if path exists (file or directory)
      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath, `Path not found: ${targetPath}. Try: adt tree . --fmt slim`);
      }
      
      // Check if it's a directory
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        throw createError('ENOTDIR', targetPath, `Not a directory: ${targetPath}. Use 'adt info' for files.`);
      }

      return this.generateMap(targetPath, options);
    });
  }

  private async generateMap(targetPath: string, options: any): Promise<CommandResult> {
    const isRoot = targetPath === process.cwd();
    
    // Detect project structure
    const structure = await this.analyzeStructure(targetPath);
    
    // Detect technology stack
    const stack = this.detectStack(targetPath);
    
    // Get file statistics
    const stats = await this.getFileStats(targetPath);

    const output = this.formatMap(structure, stack, stats, targetPath, options);

    return {
      ok: true,
      command: 'map',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      structure,
      stack,
      stats,
      path: targetPath,
    };
  }

  private async analyzeStructure(targetPath: string): Promise<any> {
    const files = await fg.glob('**/*', {
      cwd: targetPath,
      onlyFiles: false,
      absolute: false,
      deep: 3,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const dirs: Set<string> = new Set();
    const fileTypes: Map<string, number> = new Map();
    let totalFiles = 0;
    let totalDirs = 0;

    for (const item of files) {
      if (item.includes('/')) {
        const parts = item.split('/');
        const dir = parts.slice(0, -1).join('/');
        dirs.add(dir);
        totalDirs++;
      } else {
        totalFiles++;
      }

      const ext = item.includes('.') ? item.split('.').pop()! : '(no ext)';
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
    }

    // Analyze directory structure
    const dirStructure: any = {};
    dirs.forEach((dir: string) => {
      const parts = dir.split('/');
      let current: any = dirStructure;
      
      parts.forEach((part: string, index: number) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? {} : {};
        }
        if (index < parts.length - 1) {
          current = current[part];
        }
      });
    });

    return {
      dirs: Array.from(dirs).sort(),
      directories: Array.from(dirs).sort(),
      fileTypes: Object.fromEntries(fileTypes),
      totalFiles,
      totalDirs,
      dirStructure,
    };
  }

  private detectStack(targetPath: string): string[] {
    const stack: string[] = [];

    // Check for package.json
    const packageJson = path.join(targetPath, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        
        if (pkg.dependencies) {
          if (pkg.dependencies.typescript) stack.push('TypeScript');
          if (pkg.dependencies.react) stack.push('React');
          if (pkg.dependencies.vue) stack.push('Vue');
          if (pkg.dependencies.angular) stack.push('Angular');
          if (pkg.dependencies.express) stack.push('Express');
          if (pkg.dependencies.fastify) stack.push('Fastify');
          if (pkg.dependencies.nestjs) stack.push('NestJS');
          if (pkg.dependencies.jest) stack.push('Jest');
          if (pkg.dependencies.mocha) stack.push('Mocha');
        }
      } catch {
        // Invalid package.json
      }
    }

    // Check for tsconfig.json
    const tsconfig = path.join(targetPath, 'tsconfig.json');
    if (fs.existsSync(tsconfig)) {
      if (!stack.includes('TypeScript')) {
        stack.push('TypeScript');
      }
    }

    // Check for Python files
    const pyFiles = fs.readdirSync(targetPath).filter(f => f.endsWith('.py'));
    if (pyFiles.length > 0) {
      stack.push('Python');
    }

    // Check for Go files
    const goFiles = fs.readdirSync(targetPath).filter(f => f.endsWith('.go'));
    if (goFiles.length > 0) {
      stack.push('Go');
    }

    if (stack.length === 0) {
      stack.push('JavaScript'); // Default
    }

    return stack;
  }

  private async getFileStats(targetPath: string): Promise<any> {
    const files = await fg.glob('**/*', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const extCounts: Map<string, number> = new Map();
    let totalLines = 0;

    for (const file of files) {
      const ext = file.includes('.') ? file.split('.').pop()! : '(no ext)';
      extCounts.set(ext, (extCounts.get(ext) || 0) + 1);

      try {
        const info = FileUtils.getFileInfo(path.join(targetPath, file));
        totalLines += info.totalLines;
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      extensionBreakdown: Object.fromEntries(extCounts),
    };
  }

  private formatMap(structure: any, stack: string[], stats: any, targetPath: string, options: any): string {
    const lines: string[] = [];

    if (options.fmt === 'slim') {
      if (stack.length > 0) {
        lines.push(stack.join(' · '));
      }
      
      if (structure.dirs && structure.dirs.length > 0) {
        structure.dirs.slice(0, 10).forEach((dir: string) => {
          lines.push(dir.replace(/\//g, '/'));
        });
      }
      
      lines.push(`${stats.totalFiles} files  ${structure.totalDirs} dirs`);
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        path: targetPath,
        stack,
        structure,
        stats,
      }, null, 2);
    } else {
      lines.push(`ok: true`);
      lines.push(`path: ${targetPath}`);
      lines.push(`stack: ${stack.join(' · ')}`);
      
      // Config files
      const configs = [];
      if (fs.existsSync(path.join(targetPath, 'package.json'))) configs.push('package.json');
      if (fs.existsSync(path.join(targetPath, 'tsconfig.json'))) configs.push('tsconfig.json');
      if (configs.length > 0) {
        lines.push(`config: ${configs.join('  ')}`);
      }

      lines.push('---');
      
      // Directory structure
      const dirsToShow = structure.dirs.slice(0, 15);
      dirsToShow.forEach((dir: string) => {
        const parts = dir.split('/');
        const indent = '  '.repeat(parts.length);
        const name = parts[parts.length - 1];
        const parent = parts.slice(0, -1).join('/');
        
        lines.push(`${indent}${name}/  (${structure.fileTypes[name] || '?'} files)`);
      });

      if (structure.totalFiles > 0) {
        lines.push('---');
        lines.push(`total: ${stats.totalFiles} files  ${stats.totalLines} lines  ${structure.totalDirs} dirs`);
        lines.push(`by extension:`);
        
        const sortedExts = Object.entries(stats.extensionBreakdown)
          .sort(([, a]: [string, any], [, b]: [string, any]) => (b as number) - (a as number))
          .slice(0, 10);
        
        sortedExts.forEach(([ext, count]) => {
          lines.push(`  .${ext}  ${count} files`);
        });
      }
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      } else if (!arg.startsWith('--') && options.path === undefined) {
        options.path = arg;
      }
    }

    return options;
  }
}
