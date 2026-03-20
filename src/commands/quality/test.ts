import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { execSync } from 'child_process';
import * as path from 'path';

export class TestCommand extends Command {
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
      const match = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
      if (match) {
        results.passed = parseInt(match[1], 10);
        results.failed = parseInt(match[2], 10);
        results.total = results.passed + results.failed;
      }
      
      const timeMatch = output.match(/Time:\s+([0-9.]+)s/);
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
