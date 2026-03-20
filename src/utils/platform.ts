import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export type Platform = 'linux' | 'darwin' | 'win32';
export type Shell = 'bash' | 'zsh' | 'powershell' | 'cmd' | 'unknown';

export class PlatformUtils {
  static getPlatform(): Platform {
    return process.platform as Platform;
  }

  static isWindows(): boolean {
    return process.platform === 'win32';
  }

  static isLinux(): boolean {
    return process.platform === 'linux';
  }

  static isMac(): boolean {
    return process.platform === 'darwin';
  }

  static getShell(): Shell {
    if (this.isWindows()) {
      if (process.env.ComSpec) {
        return 'cmd';
      }
      if (process.env.PSModulePath) {
        return 'powershell';
      }
      return 'cmd';
    }

    if (process.env.SHELL) {
      const shell = process.env.SHELL;
      if (shell.includes('zsh')) {
        return 'zsh';
      }
      if (shell.includes('bash')) {
        return 'bash';
      }
    }

    return 'bash';
  }

  static getShellPath(): string {
    const shell = this.getShell();
    
    switch (shell) {
      case 'bash':
        return process.env.SHELL || '/bin/bash';
      case 'zsh':
        return process.env.SHELL || '/bin/zsh';
      case 'powershell':
        return 'pwsh';
      case 'cmd':
        return process.env.ComSpec || 'cmd.exe';
      default:
        return '/bin/bash';
    }
  }

  static getPathSeparator(): string {
    return path.sep;
  }

  static getLineEnding(): string {
    return this.isWindows() ? '\r\n' : '\n';
  }

  static getHomeDir(): string {
    return os.homedir();
  }

  static getTempDir(): string {
    return os.tmpdir();
  }

  static getCwd(): string {
    return process.cwd();
  }

  static getNodeVersion(): string {
    return process.version;
  }

  static getNpmVersion(): string {
    try {
      return execSync('npm --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  static getGitVersion(): string {
    try {
      return execSync('git --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  static getPlatformInfo(): {
    platform: Platform;
    arch: string;
    shell: Shell;
    nodeVersion: string;
    npmVersion: string;
    gitVersion: string;
    homeDir: string;
    cwd: string;
    separator: string;
    lineEnding: string;
  } {
    return {
      platform: this.getPlatform(),
      arch: os.arch(),
      shell: this.getShell(),
      nodeVersion: this.getNodeVersion(),
      npmVersion: this.getNpmVersion(),
      gitVersion: this.getGitVersion(),
      homeDir: this.getHomeDir(),
      cwd: this.getCwd(),
      separator: this.getPathSeparator(),
      lineEnding: this.getLineEnding(),
    };
  }

  static isWSL(): boolean {
    if (!this.isLinux()) {
      return false;
    }

    try {
      const procVersion = execSync('cat /proc/version', { encoding: 'utf-8' });
      return procVersion.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  static isCI(): boolean {
    return (
      process.env.CI === 'true' ||
      process.env.CONTINUOUS_INTEGRATION === 'true' ||
      process.env.GITHUB_ACTIONS !== undefined ||
      process.env.TRAVIS !== undefined ||
      process.env.JENKINS_URL !== undefined ||
      process.env.CIRCLECI !== undefined
    );
  }
}
