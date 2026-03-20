import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class BatchCommand extends Command {
  private batchResults: any[] = [];

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'slim');

    return this.runWithLogging('batch', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.executeBatch(targetPath, options);
    });
  }

  private async executeBatch(targetPath: string, options: any): Promise<CommandResult> {
    const batchFile = options.batch || options.file;
    
    if (batchFile) {
      return this.executeBatchFile(batchFile, targetPath, options);
    } else if (options.operations && options.operations.length > 0) {
      return this.executeInlineBatch(targetPath, options);
    } else {
      throw createError('ENOMATCH', '', 'Provide --file or --operations');
    }
  }

  private async executeBatchFile(batchFile: string, targetPath: string, options: any): Promise<CommandResult> {
    const batchPath = path.resolve(targetPath, batchFile);
    
    if (!FileUtils.fileExists(batchPath)) {
      throw createError('ENOENT', batchPath);
    }

    const content = FileUtils.readFile(batchPath);
    const operations = this.parseBatchFile(content);
    
    const results = [];
    const errors = [];

    for (const op of operations) {
      try {
        const result = await this.executeOperation(op, targetPath);
        results.push({ op, success: true, result });
      } catch (error: any) {
        results.push({ op, success: false, error: error.message });
        errors.push({ op, error: error.message });
      }
    }

    const output = this.formatBatchResults(results, errors, options);

    return {
      ok: errors.length === 0,
      command: 'batch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      results,
      errors,
      total: operations.length,
      passed: results.length - errors.length,
      failed: errors.length,
    };
  }

  private async executeInlineBatch(targetPath: string, options: any): Promise<CommandResult> {
    const results = [];
    const errors = [];

    for (const op of options.operations) {
      try {
        const result = await this.executeOperation(op, targetPath);
        results.push({ op, success: true, result });
      } catch (error: any) {
        results.push({ op, success: false, error: error.message });
        errors.push({ op, error: error.message });
      }
    }

    const output = this.formatBatchResults(results, errors, options);

    return {
      ok: errors.length === 0,
      command: 'batch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      results,
      errors,
      total: options.operations.length,
      passed: results.length - errors.length,
      failed: errors.length,
    };
  }

  private async executeOperation(op: any, targetPath: string): Promise<any> {
    switch (op.command) {
      case 'read':
        const { ReadCommand } = await import('../../commands/read/read');
        const readCmd = new ReadCommand(this.formatManager, this.configManager, this.sessionManager);
        return await readCmd.execute(...op.args);

      case 'grep':
        const { GrepCommand } = await import('../../commands/search/grep');
        const grepCmd = new GrepCommand(this.formatManager, this.configManager, this.sessionManager);
        return await grepCmd.execute(...op.args);

      case 'verify':
        const { VerifyCommand } = await import('../../commands/edit/verify');
        const verifyCmd = new VerifyCommand(this.formatManager, this.configManager, this.sessionManager);
        return await verifyCmd.execute(...op.args);

      case 'patch':
        const { PatchCommand } = await import('../../commands/edit/patch');
        const patchCmd = new PatchCommand(this.formatManager, this.configManager, this.sessionManager);
        return await patchCmd.execute(...op.args);

      default:
        throw new Error(`Unknown command: ${op.command}`);
    }
  }

  private parseBatchFile(content: string): any[] {
    const operations: any[] = [];
    const lines = content.split('\n');
    let currentOp: any = null;

    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const parts = line.split(/\s+/);
      
      if (parts[0] === '') return;

      currentOp = {
        command: parts[0],
        args: parts.slice(1),
      };

      operations.push(currentOp);
    });

    return operations;
  }

  private formatBatchResults(results: any[], errors: any[], options: any): string {
    const fmt = options.fmt || 'slim';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`total: ${results.length}  passed: ${results.length - errors.length}  failed: ${errors.length}`);
      
      results.slice(0, 20).forEach((r, i) => {
        if (r.success) {
          lines.push(`${i + 1}. ✓ ${r.op.command} ${r.op.args.join(' ')}`);
        } else {
          lines.push(`${i + 1}. ✗ ${r.op.command} ${r.op.error}`);
        }
      });

      if (results.length > 20) {
        lines.push(`... ${results.length - 20} more`);
      }

      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: errors.length === 0,
        command: 'batch',
        results,
        errors,
        total: results.length,
        passed: results.length - errors.length,
        failed: errors.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${errors.length === 0 ? 'true' : 'false'}`);
      lines.push(`batch operations: ${results.length}`);
      lines.push(`passed: ${results.length - errors.length}  failed: ${errors.length}`);
      lines.push('===');

      results.slice(0, 10).forEach((r, i) => {
        if (r.success) {
          lines.push(`${i + 1}. ✓ ${r.op.command} ${r.op.args.join(' ')}`);
        } else {
          lines.push(`${i + 1}. ✗ ${r.op.command} ${r.op.error}`);
        }
      });

      if (results.length > 10) {
        lines.push(`... ${results.length - 10} more operations`);
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
      } else if (arg === '--file' || arg === '-f') {
        options.file = args[++i];
      } else if (arg === '--continue-on-error') {
        options.continueOnError = true;
      } else if (arg.startsWith('--')) {
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options[args[i].substring(2)] = args[++i];
        }
      }
    }

    return options;
  }
}
