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
  public getDescription(): string {
    return 'Batch command execution';
  }

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

    if (options.parallel) {
      const promises = operations.map(async (op) => {
        try {
          const result = await this.executeOperation(op, targetPath);
          return { op, success: true, result };
        } catch (error: any) {
          return { op, success: false, error: error.message };
        }
      });
      
      const settled = await Promise.all(promises);
      settled.forEach((r: any) => {
        results.push(r);
        if (!r.success) {
          errors.push({ op: r.op, error: r.error });
        }
      });
    } else {
      for (const op of operations) {
        try {
          const result = await this.executeOperation(op, targetPath);
          results.push({ op, success: true, result });
          
          if (op.pipe) {
            const lastResult = result;
            for (const pipeOp of op.pipe) {
              try {
                const pipeResult = await this.executeOperation(pipeOp, targetPath, lastResult);
                results.push({ op: pipeOp, success: true, result: pipeResult });
              } catch (pipeError: any) {
                results.push({ op: pipeOp, success: false, error: pipeError.message });
                errors.push({ op: pipeOp, error: pipeError.message });
                break;
              }
            }
          }
        } catch (error: any) {
          results.push({ op, success: false, error: error.message });
          errors.push({ op, error: error.message });
          
          if (!options.continueOnError) {
            break;
          }
        }
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

  private async executeOperation(op: any, targetPath: string, input?: any): Promise<any> {
    const args = op.args || [];
    
    if (input && input.content) {
      args.push('--input', JSON.stringify(input));
    }

    switch (op.command) {
      case 'read':
        const { ReadCommand } = await import('../../commands/read/read');
        const readCmd = new ReadCommand(this.formatManager, this.configManager, this.sessionManager);
        return await readCmd.execute(...args);

      case 'peek':
        const { PeekCommand } = await import('../../commands/read/peek');
        const peekCmd = new PeekCommand(this.formatManager, this.configManager, this.sessionManager);
        return await peekCmd.execute(...args);

      case 'grep':
        const { GrepCommand } = await import('../../commands/search/grep');
        const grepCmd = new GrepCommand(this.formatManager, this.configManager, this.sessionManager);
        return await grepCmd.execute(...args);

      case 'where':
        const { WhereCommand } = await import('../../commands/search/where');
        const whereCmd = new WhereCommand(this.formatManager, this.configManager, this.sessionManager);
        return await whereCmd.execute(...args);

      case 'symbols':
        const { SymbolsCommand } = await import('../../commands/symbol/symbols');
        const symbolsCmd = new SymbolsCommand(this.formatManager, this.configManager, this.sessionManager);
        return await symbolsCmd.execute(...args);

      case 'verify':
        const { VerifyCommand } = await import('../../commands/edit/verify');
        const verifyCmd = new VerifyCommand(this.formatManager, this.configManager, this.sessionManager);
        return await verifyCmd.execute(...args);

      case 'patch':
        const { PatchCommand } = await import('../../commands/edit/patch');
        const patchCmd = new PatchCommand(this.formatManager, this.configManager, this.sessionManager);
        return await patchCmd.execute(...args);

      case 'complexity':
        const { ComplexityCommand } = await import('../../commands/complexity/complexity');
        const complexityCmd = new ComplexityCommand(this.formatManager, this.configManager, this.sessionManager);
        return await complexityCmd.execute(...args);

      case 'context':
        const { ContextCommand } = await import('../../commands/context/context');
        const contextCmd = new ContextCommand(this.formatManager, this.configManager, this.sessionManager);
        return await contextCmd.execute(...args);

      case 'stats':
        const { StatsCommand } = await import('../../commands/map/stats');
        const statsCmd = new StatsCommand(this.formatManager, this.configManager, this.sessionManager);
        return await statsCmd.execute(...args);

      case 'map':
        const { MapCommand } = await import('../../commands/map/map');
        const mapCmd = new MapCommand(this.formatManager, this.configManager, this.sessionManager);
        return await mapCmd.execute(...args);

      case 'health':
        const { HealthCommand } = await import('../../commands/utility/health');
        const healthCmd = new HealthCommand(this.formatManager, this.configManager, this.sessionManager);
        return await healthCmd.execute(...args);

      default:
        throw new Error(`Unknown command: ${op.command}. Supported: read, peek, grep, where, symbols, verify, patch, complexity, context, stats, map, health`);
    }
  }

  private parseBatchFile(content: string): any[] {
    const operations: any[] = [];
    const lines = content.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;

      const pipeIndex = line.indexOf('|');
      if (pipeIndex !== -1) {
        const leftPart = line.substring(0, pipeIndex).trim();
        const rightPart = line.substring(pipeIndex + 1).trim();
        
        const leftOp = this.parseCommandString(leftPart);
        const rightOp = this.parseCommandString(rightPart);
        
        leftOp.pipe = [rightOp];
        operations.push(leftOp);
      } else {
        const op = this.parseCommandString(line);
        if (op) {
          operations.push(op);
        }
      }
    });

    return operations;
  }

  private parseCommandString(cmdStr: string): any | null {
    const parts = this.splitCommandArgs(cmdStr);
    if (parts.length === 0) return null;

    // Normalize command name to lowercase
    const commandName = parts[0].toLowerCase();
    
    return {
      command: commandName,
      args: parts.slice(1),
    };
  }

  private splitCommandArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      
      if ((ch === '"' || ch === "'") && (i === 0 || str[i - 1] === '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (ch === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += ch;
        }
      } else if (ch === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
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
      } else if (arg === '--parallel' || arg === '-p') {
        options.parallel = true;
      } else if (arg === '--commands' || arg === '-c') {
        options.commandsStr = args[++i];
      } else if (arg.startsWith('--')) {
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options[arg.substring(2)] = args[++i];
        }
      }
    }

    if (options.commandsStr) {
      options.operations = this.parseBatchFile(options.commandsStr);
    }

    return options;
  }
}
