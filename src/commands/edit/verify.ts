import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class VerifyCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'slim');

    return this.runWithLogging('verify', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.verifyLines(options.filePath, options);
    });
  }

  private async verifyLines(filePath: string, options: any): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    let verified = true;
    const mismatches: any[] = [];

    if (options.line !== undefined) {
      const result = this.verifySingleLine(lines, options.line, options);
      if (!result.match) {
        verified = false;
        mismatches.push(result);
      }
    } else if (options.lines) {
      const [start, end] = options.lines.split(':').map((n: string) => parseInt(n, 10));
      
      for (let i = start; i <= end; i++) {
        const result = this.verifySingleLine(lines, i, options);
        if (!result.match) {
          verified = false;
          mismatches.push(result);
        }
      }
    }

    const output = this.formatVerification(filePath, verified, mismatches, options);

    const result: CommandResult = {
      ok: verified,
      command: 'verify',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      verified,
    };

    if (!verified && mismatches.length > 0) {
      result.mismatches = mismatches;
    }

    return result;
  }

  private verifySingleLine(lines: string[], lineNum: number, options: any): any {
    const actualLine = lines[lineNum - 1];
    
    if (!actualLine) {
      return {
        line: lineNum,
        match: false,
        expected: options.expect || options.exact,
        actual: '(line does not exist)',
      };
    }

    if (options.exact) {
      return {
        line: lineNum,
        match: actualLine.trim() === options.exact.trim(),
        expected: options.exact,
        actual: actualLine.trim(),
      };
    }

    if (options.expect) {
      const match = actualLine.includes(options.expect);
      return {
        line: lineNum,
        match,
        expected: options.expect,
        actual: actualLine.trim(),
      };
    }

    if (options.regex) {
      try {
        const regex = new RegExp(options.regex);
        const match = regex.test(actualLine);
        return {
          line: lineNum,
          match,
          expected: `regex: ${options.regex}`,
          actual: actualLine.trim(),
        };
      } catch {
        return {
          line: lineNum,
          match: false,
          expected: `regex: ${options.regex}`,
          actual: 'Invalid regex',
        };
      }
    }

    return {
      line: lineNum,
      match: true,
      actual: actualLine.trim(),
    };
  }

  private formatVerification(filePath: string, verified: boolean, mismatches: any[], options: any): string {
    const lines: string[] = [];

    if (verified) {
      if (options.fmt === 'slim') {
        if (options.line) {
          lines.push(`ok true  :${options.line}  matches`);
        } else {
          lines.push(`ok true  :${options.lines}  verified`);
        }
      } else {
        lines.push(`ok: true`);
        lines.push(`file: ${filePath}`);
        lines.push(`verified: true`);
        
        if (options.line) {
          lines.push(`line: ${options.line}`);
          lines.push(`content: ${mismatches[0]?.actual || 'OK'}`);
        } else if (options.lines) {
          lines.push(`lines: ${options.lines}`);
        }
      }
    } else {
      if (options.fmt === 'slim') {
        lines.push(`ok false  :${mismatches[0]?.line || '?'}  mismatch`);
        lines.push(`expected: ${mismatches[0]?.expected || 'N/A'}`);
        lines.push(`actual: ${mismatches[0]?.actual || 'N/A'}`);
        lines.push(`tip: use outline to re-confirm line number`);
      } else {
        lines.push(`ok: false`);
        lines.push(`file: ${filePath}`);
        lines.push(`verified: false`);
        lines.push('');
        lines.push('mismatches:');
        
        mismatches.forEach(m => {
          lines.push(`  :${m.line}`);
          lines.push(`    expected: ${m.expected}`);
          lines.push(`    actual: ${m.actual}`);
        });

        lines.push('');
        lines.push(`tip: use outline to re-confirm line number`);
      }
    }

    return lines.join('\n');
  }

  private parseArgs(args: string[]): any {
    const options: any = {
      filePath: args[0],
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--lines' && nextArg) {
        options.lines = nextArg;
        i++;
      } else if (arg === '--line' && nextArg) {
        options.line = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--expect' && nextArg) {
        options.expect = nextArg;
        i++;
      } else if (arg === '--exact' && nextArg) {
        options.exact = nextArg;
        i++;
      } else if (arg === '--regex' && nextArg) {
        options.regex = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg;
        i++;
      }
    }

    return options;
  }
}
