import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class SafeCommand extends Command {
  public getDescription(): string {
    return 'Safety check operations';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('safe', args, async () => {
      const target = options._[0];
      
      if (!target) {
        throw createError('ENOENT', '', 'Usage: adt safe <file|directory>');
      }

      return this.checkSafe(target, options);
    });
  }

  private async checkSafe(target: string, options: any): Promise<CommandResult> {
    const targetPath = require('path').resolve(target);
    
    if (!FileUtils.fileExists(targetPath)) {
      throw createError('ENOENT', target);
    }

    const checks = {
      exists: true,
      isBinary: false,
      isReadable: false,
      hasBOM: false,
      encoding: 'unknown',
      lineEnding: 'unknown',
      size: 0,
      type: 'unknown',
      safe: false,
    };

    try {
      const fs = require('fs');
      const stats = fs.statSync(targetPath);
      
      checks.isReadable = true;
      checks.size = stats.size;
      checks.type = stats.isDirectory() ? 'directory' : 
                    stats.isSymbolicLink() ? 'symlink' : 'file';

      if (checks.type === 'file') {
        const buffer = fs.readFileSync(targetPath);
        
        // Check if binary
        checks.isBinary = this.isBinary(buffer);
        checks.safe = !checks.isBinary;
        
        if (!checks.isBinary) {
          // Check for BOM
          checks.hasBOM = buffer.length >= 3 && 
                         buffer[0] === 0xEF && 
                         buffer[1] === 0xBB && 
                         buffer[2] === 0xBF;
          
          // Detect encoding
          checks.encoding = this.detectEncoding(buffer);
          
          // Detect line ending
          checks.lineEnding = this.detectLineEnding(buffer);
        }
      }

      const output = this.formatSafe(targetPath, checks, options);
      
      return {
        ok: true,
        command: 'safe',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        target: targetPath,
        checks,
      };
    } catch (error: any) {
      if (error.code === 'EACCES') {
        checks.isReadable = false;
        const output = this.formatSafe(targetPath, checks, options);
        return {
          ok: false,
          command: 'safe',
          tokenEstimate: TokenUtils.estimateTokens(output),
          content: output,
          target: targetPath,
          checks,
          error: 'EACCES',
        };
      }
      throw error;
    }
  }

  private isBinary(buffer: Buffer): boolean {
    // Check for null bytes (common in binary files)
    if (buffer.indexOf('\0') !== -1) {
      return true;
    }

    // Check character distribution
    const textBytes = buffer.slice(0, 10000); // Check first 10KB
    let textCharCount = 0;
    
    for (let i = 0; i < textBytes.length; i++) {
      const byte = textBytes[i];
      // Text characters are usually in range 9-13, 32-126
      if ((byte >= 9 && byte <= 13) || (byte >= 32 && byte <= 126)) {
        textCharCount++;
      }
    }

    // If less than 70% are text characters, likely binary
    return textCharCount / textBytes.length < 0.7;
  }

  private detectEncoding(buffer: Buffer): string {
    if (buffer.length < 3) return 'utf-8';
    
    // Check for BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf-8-bom';
    }
    
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf-16le';
    }
    
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf-16be';
    }
    
    // Try to detect ASCII vs UTF-8
    let isAscii = true;
    const sampleSize = Math.min(buffer.length, 10000);
    
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] > 127) {
        isAscii = false;
        break;
      }
    }
    
    return isAscii ? 'ascii' : 'utf-8';
  }

  private detectLineEnding(buffer: Buffer): string {
    const content = buffer.toString('utf-8');
    
    // Count line endings
    let crlfCount = 0;
    let lfCount = 0;
    
    for (let i = 0; i < content.length - 1; i++) {
      if (content[i] === '\r' && content[i + 1] === '\n') {
        crlfCount++;
      } else if (content[i] === '\n') {
        lfCount++;
      }
    }
    
    if (crlfCount > lfCount) {
      return 'CRLF';
    } else if (lfCount > 0) {
      return 'LF';
    } else {
      return 'unknown';
    }
  }

  private formatSafe(target: string, checks: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      
      if (!checks.exists) {
        lines.push(`ok false`);
        lines.push(`ENOENT ${target}`);
        lines.push(`tip: adt find ${target}`);
      } else if (!checks.isReadable) {
        lines.push(`ok false`);
        lines.push(`EACCES ${target}`);
        lines.push(`tip: check file permissions`);
      } else if (checks.isBinary) {
        lines.push(`ok true`);
        lines.push(`binary: true`);
        lines.push(`safe: false`);
        lines.push(`tip: use hex viewer or specialized tool`);
      } else {
        lines.push(`ok true`);
        lines.push(`safe: true`);
        lines.push(`encoding: ${checks.encoding}`);
        lines.push(`line-ending: ${checks.lineEnding}`);
        lines.push(`bom: ${checks.hasBOM}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: checks.exists && checks.isReadable && !checks.isBinary,
        command: 'safe',
        target,
        checks: {
          ...checks,
          safe: !checks.isBinary,
        },
      }, null, 2);
    } else {
      const lines: string[] = [];
      
      if (!checks.exists) {
        lines.push('ok: false');
        lines.push(`error: ENOENT`);
        lines.push(`path: ${target}`);
        lines.push(`tip: adt find ${target}`);
      } else if (!checks.isReadable) {
        lines.push('ok: false');
        lines.push(`error: EACCES`);
        lines.push(`path: ${target}`);
        lines.push(`tip: Check file permissions`);
      } else if (checks.isBinary) {
        lines.push('ok: true');
        lines.push(`safe: false`);
        lines.push(`reason: Binary file detected`);
        lines.push(`type: ${checks.type}`);
        lines.push(`size: ${checks.size} bytes`);
      } else {
        lines.push('ok: true');
        lines.push(`safe: true`);
        lines.push(`type: ${checks.type}`);
        lines.push(`size: ${checks.size} bytes`);
        lines.push('===');
        lines.push(`encoding: ${checks.encoding}`);
        lines.push(`line-ending: ${checks.lineEnding}`);
        lines.push(`bom: ${checks.hasBOM ? 'Yes' : 'No'}`);
        lines.push(`readable: Yes`);
      }
      
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
