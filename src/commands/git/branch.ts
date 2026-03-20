import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class GitBranchCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git-branch', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath);
      }

      const action = options.action || 'list';
      
      switch (action) {
        case 'list':
          return this.listBranches(targetPath, options);
        case 'create':
          return this.createBranch(targetPath, options);
        case 'delete':
          return this.deleteBranch(targetPath, options);
        case 'switch':
          return this.switchBranch(targetPath, options);
        default:
          return this.listBranches(targetPath, options);
      }
    });
  }

  private async listBranches(repoPath: string, options: any): Promise<CommandResult> {
    const currentBranch = GitUtils.getCurrentBranch(repoPath) || '';
    const branches = GitUtils.getBranches(repoPath) || [];
    
    const output = this.formatBranchList(branches, currentBranch, options);

    return {
      ok: true,
      command: 'git-branch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branches,
      current: currentBranch,
      total: branches.length,
    };
  }

  private async createBranch(repoPath: string, options: any): Promise<CommandResult> {
    if (!options.name) {
      throw createError('ENOMATCH', '', 'Branch name required');
    }

    const success = GitUtils.createBranch(repoPath, options.name, options.from);
    
    const output = this.formatBranchCreate(options.name, options.from, success, options);

    return {
      ok: success,
      command: 'git-branch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branch: options.name,
      from: options.from || 'HEAD',
      created: success,
    };
  }

  private async deleteBranch(repoPath: string, options: any): Promise<CommandResult> {
    if (!options.name) {
      throw createError('ENOMATCH', '', 'Branch name required');
    }

    const success = GitUtils.deleteBranch(repoPath, options.name, options.force);
    
    const output = this.formatBranchDelete(options.name, options.force, success, options);

    return {
      ok: success,
      command: 'git-branch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branch: options.name,
      force: options.force,
      deleted: success,
    };
  }

  private async switchBranch(repoPath: string, options: any): Promise<CommandResult> {
    if (!options.name) {
      throw createError('ENOMATCH', '', 'Branch name required');
    }

    const success = GitUtils.switchBranch(repoPath, options.name);
    
    const output = this.formatBranchSwitch(options.name, success, options);

    return {
      ok: success,
      command: 'git-branch',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branch: options.name,
      switched: success,
    };
  }

  private formatBranchList(branches: any[], currentBranch: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      branches.forEach(branch => {
        const prefix = branch.name === currentBranch ? '* ' : '  ';
        lines.push(`${prefix}${branch.name}`);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-branch',
        current: currentBranch,
        branches,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`current: ${currentBranch}`);
      lines.push('===');

      branches.forEach(branch => {
        const prefix = branch.name === currentBranch ? '* ' : '  ';
        lines.push(`${prefix}${branch.name}`);
      });

      return lines.join('\n');
    }
  }

  private formatBranchCreate(name: string, from: string, success: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok ${success}  created branch: ${name}  from: ${from || 'HEAD'}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: success,
        command: 'git-branch',
        action: 'create',
        branch: name,
        from: from || 'HEAD',
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${success}`);
      lines.push(`created branch: ${name}`);
      lines.push(`from: ${from || 'HEAD'}`);
      return lines.join('\n');
    }
  }

  private formatBranchDelete(name: string, force: boolean, success: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok ${success}  deleted branch: ${name}${force ? '  [forced]' : ''}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: success,
        command: 'git-branch',
        action: 'delete',
        branch: name,
        force,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${success}`);
      lines.push(`deleted branch: ${name}`);
      if (force) lines.push(`force: true`);
      return lines.join('\n');
    }
  }

  private formatBranchSwitch(name: string, success: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok ${success}  switched to: ${name}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: success,
        command: 'git-branch',
        action: 'switch',
        branch: name,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${success}`);
      lines.push(`switched to: ${name}`);
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = { action: 'list' };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === 'list') {
        options.action = 'list';
      } else if (arg === 'create') {
        options.action = 'create';
      } else if (arg === 'delete') {
        options.action = 'delete';
      } else if (arg === 'switch') {
        options.action = 'switch';
      } else if (arg === '--force') {
        options.force = true;
      } else if (arg === '--from') {
        options.from = args[++i];
      } else if (!options.name) {
        options.name = arg;
      }
    }

    return options;
  }
}
