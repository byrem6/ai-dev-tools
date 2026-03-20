import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';

export class FormatCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('format', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runFormat(targetPath, options);
    });
  }

  private async runFormat(targetPath: string, options: any): Promise<CommandResult> {
    const formatter = this.detectFormatter(targetPath);
    
    if (!formatter) {
      throw createError('EEXEC', '', 'No formatter found. Install prettier or similar');
    }

    try {
      let command = '';
      if (formatter === 'prettier') {
        command = 'npx prettier';
        if (options.check) command += ' --check';
        if (options.write) command += ' --write';
        command += ` "${targetPath}/**/*.{ts,tsx,js,jsx,json,md}"`;
      }

      const stdout = execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
      });

      const files: any[] = [];
      if (stdout.trim()) {
        stdout.split('\n').forEach(line => {
          files.push({ file: line, status: 'formatted' });
        });
      }

      const output = this.formatFormat(files, formatter, options);

      return {
        ok: true,
        command: 'format',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        formatter,
        files,
        total: files.length,
      };
    } catch (error: any) {
      const stderr = error.stderr || error.stdout || '';
      const files: any[] = [];
      
      stderr.split('\n').forEach((line: string) => {
        if (line.trim()) {
          files.push({ file: line, status: 'needs-formatting' });
        }
      });

      const output = this.formatFormat(files, formatter, options);

      return {
        ok: files.length === 0,
        command: 'format',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        formatter,
        files,
        total: files.length,
      };
    }
  }

  private detectFormatter(targetPath: string): string | null {
    const packageJsonPath = require('path').join(targetPath, 'package.json');
    if (FileUtils.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
      
      if (packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier) {
        return 'prettier';
      }
      
      if (packageJson.devDependencies?.black || packageJson.dependencies?.black) {
        return 'black';
      }
    }
    
    return null;
  }

  private formatFormat(files: any[], formatter: string | null, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (files.length === 0) {
        lines.push(`ok true  all files formatted`);
      } else {
        files.forEach(f => {
          lines.push(`${f.file}  ${f.status}`);
        });
        lines.push(`---`);
        lines.push(`${files.length} files need formatting`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: files.length === 0,
        command: 'format',
        formatter,
        files,
        total: files.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${files.length === 0 ? 'true' : 'false'}`);
      lines.push(`formatter: ${formatter || 'none'}`);
      
      if (files.length > 0) {
        lines.push(`files: ${files.length}`);
        lines.push('===');
        files.slice(0, 20).forEach(f => {
          lines.push(f.file);
        });
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
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--check') {
        options.check = true;
      } else if (arg === '--write') {
        options.write = true;
      }
    }

    return options;
  }
}
