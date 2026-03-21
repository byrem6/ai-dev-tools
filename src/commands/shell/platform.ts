import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { PlatformUtils } from '../../utils/platform';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as path from 'path';

export class PlatformCommand extends Command {
  public getDescription(): string {
    return 'Show platform information';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('platform', args, async () => {
      return this.showPlatform(options);
    });
  }

  private async showPlatform(options: any): Promise<CommandResult> {
    const platform = PlatformUtils.getPlatformInfo();
    
    const nodeVersion = process.version;
    const npmVersion = this.getNpmVersion();
    const gitVersion = this.getGitVersion();
    
    const output = this.formatPlatform(platform, nodeVersion, npmVersion, gitVersion, options);

    return {
      ok: true,
      command: 'platform',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      platform,
      nodeVersion,
      npmVersion,
      gitVersion,
    };
  }

  private getNpmVersion(): string {
    try {
      const { execSync } = require('child_process');
      return execSync('npm --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'not installed';
    }
  }

  private getGitVersion(): string {
    try {
      const { execSync } = require('child_process');
      return execSync('git --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'not installed';
    }
  }

  private formatPlatform(platform: any, nodeVersion: string, npmVersion: string, gitVersion: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`os: ${platform.platform}  shell: ${platform.shell}  arch: ${platform.arch}`);
      lines.push(`node: ${nodeVersion}  npm: ${npmVersion}  git: ${gitVersion}`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'platform',
        platform,
        nodeVersion,
        npmVersion,
        gitVersion,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push('===');
      lines.push(`OS: ${platform.platform} (${platform.arch})`);
      lines.push(`Shell: ${platform.shell}`);
      lines.push(`Node.js: ${nodeVersion}`);
      lines.push(`npm: ${npmVersion}`);
      lines.push(`Git: ${gitVersion}`);

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      }
    }

    return options;
  }
}
