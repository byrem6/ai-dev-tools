import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';
import * as path from 'path';

export class TestCommand extends Command {
  public getDescription(): string {
    return 'Run tests';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('test', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runTests(targetPath, options);
    });
  }

  private async runTests(targetPath: string, options: any): Promise<CommandResult> {
    const testRunner = this.detectTestRunner(targetPath);
    
    if (!testRunner) {
      throw createError('EEXEC', '', 'No test runner found. Install jest or similar');
    }

    try {
      let command = '';
      if (testRunner === 'jest') {
        command = 'npx jest';
        if (options.coverage) command += ' --coverage';
        if (options.watch) command += ' --watch';
        if (options.pattern) command += ` ${options.pattern}`;
      }

      const stdout = execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
      });

      const results = this.parseTestOutput(stdout, testRunner);
      const output = this.formatTests(results, testRunner, options);

      return {
        ok: results.failed === 0,
        command: 'test',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        testRunner,
        results,
      };
    } catch (error: any) {
      const stderr = error.stderr || error.stdout || '';
      const results = this.parseTestOutput(stderr, testRunner);
      const output = this.formatTests(results, testRunner, options);

      return {
        ok: results.failed === 0,
        command: 'test',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        testRunner,
        results,
      };
    }
  }

  private detectTestRunner(targetPath: string): string | null {
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (FileUtils.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
      
      if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
        return 'jest';
      }
      
      if (packageJson.scripts?.test) {
        if (packageJson.scripts.test.includes('jest')) return 'jest';
        if (packageJson.scripts.test.includes('mocha')) return 'mocha';
        if (packageJson.scripts.test.includes('pytest')) return 'pytest';
      }
    }
    
    return null;
  }

  private parseTestOutput(output: string, testRunner: string): any {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: [],
    };

    if (testRunner === 'jest') {
      // Jest outputs: "Tests: 10 passed, 10 total" or "Tests: 2 failed, 8 passed, 10 total"
      const passMatch = output.match(/Tests:\s+(?:\d+\s+\w+,\s+)*?(\d+)\s+passed/);
      const failMatch = output.match(/Tests:\s+(\d+)\s+failed/);
      const totalMatch = output.match(/Tests:\s+(?:.*?)(\d+)\s+total/);
      const skipMatch = output.match(/(?:(\d+)\s+skipped)/);

      if (passMatch) results.passed = parseInt(passMatch[1], 10);
      if (failMatch) results.failed = parseInt(failMatch[1], 10);
      if (totalMatch) results.total = parseInt(totalMatch[1], 10);
      if (skipMatch) results.skipped = parseInt(skipMatch[1], 10);
      if (results.total === 0) results.total = results.passed + results.failed + results.skipped;
      
      const timeMatch = output.match(/Time:\s+([0-9.]+)\s*s/);
      if (timeMatch) {
        results.duration = parseFloat(timeMatch[1]) * 1000;
      }
    }

    return results;
  }

  private formatTests(results: any, testRunner: string | null, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      if (results.failed === 0) {
        lines.push(`ok true  pass ${results.passed}  fail ${results.failed}  skip ${results.skipped}`);
      } else {
        lines.push(`ok false  pass ${results.passed}  fail ${results.failed}  skip ${results.skipped}`);
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: results.failed === 0,
        command: 'test',
        testRunner,
        ...results,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${results.failed === 0 ? 'true' : 'false'}`);
      lines.push(`runner: ${testRunner || 'none'}`);
      lines.push(`tests: ${results.total}  passed: ${results.passed}  failed: ${results.failed}  skipped: ${results.skipped}`);
      lines.push(`duration: ${results.duration}ms`);
      
      if (results.failed > 0) {
        lines.push('===');
        lines.push('failures:');
        results.failures.slice(0, 10).forEach((f: any) => {
          lines.push(`  ${f}`);
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
      } else if (arg === '--coverage') {
        options.coverage = true;
      } else if (arg === '--watch') {
        options.watch = true;
      }
    }

    return options;
  }
}
