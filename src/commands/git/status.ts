import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { GitUtils } from '../../utils/git';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as path from 'path';

export class GitStatusCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('git status', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const isRepo = GitUtils.isGitRepository(targetPath);
      if (!isRepo) {
        throw createError('EGIT', targetPath, 'Initialize git repository with: git init');
      }

      return this.showStatus(targetPath, options);
    });
  }

  private async showStatus(repoPath: string, options: any): Promise<CommandResult> {
    const branchName = GitUtils.getCurrentBranch(repoPath) || 'main';
    const status = GitUtils.getStatus(repoPath) || { staged: [], unstaged: [], untracked: [] };
    
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    const conflicts: string[] = [];

    status.split('\n').forEach((line: string) => {
      if (line.match(/^[ADMRU].\s/)) {
        const file = line.substring(3).trim();
        if (line.startsWith('UU') || line.startsWith('AA') || line.startsWith('DD')) {
          conflicts.push(file);
        } else {
          staged.push(`${line[0]}  ${file}`);
        }
      } else if (line.match(/^.[ADMRU]\s/)) {
        const file = line.substring(3).trim();
        unstaged.push(`${line[1]}  ${file}`);
      } else if (line.startsWith('??')) {
        const file = line.substring(3).trim();
        untracked.push(`?  ${file}`);
      }
    });

    const output = this.formatStatus(branchName, staged, unstaged, untracked, conflicts, options);

    return {
      ok: true,
      command: 'git-status',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      branch: branchName,
      staged,
      unstaged,
      untracked,
      conflicts,
      clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    };
  }

  private formatStatus(branchName: string, staged: string[], unstaged: string[], untracked: string[], conflicts: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`branch: ${branchName}  ahead:0  behind:0`);
      
      staged.forEach(s => lines.push(s));
      unstaged.forEach(u => lines.push(u));
      untracked.forEach(u => lines.push(u));
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'git-status',
        branch: branchName,
        ahead: 0,
        behind: 0,
        staged,
        unstaged,
        untracked,
        conflicts,
        clean: staged.length === 0 && unstaged.length === 0,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`branch: ${branchName}  ahead: 0  behind: 0`);
      
      if (conflicts.length > 0) {
        lines.push(`conflicts: ${conflicts.length}`);
      }
      
      if (staged.length > 0 || unstaged.length > 0 || untracked.length > 0 || conflicts.length > 0) {
        lines.push('===');
        
        if (staged.length > 0) {
          lines.push('staged:');
          staged.forEach(s => lines.push(`  ${s}`));
        }
        
        if (unstaged.length > 0) {
          lines.push('unstaged:');
          unstaged.forEach(u => lines.push(`  ${u}`));
        }
        
        if (untracked.length > 0) {
          lines.push('untracked:');
          untracked.forEach(u => lines.push(`  ${u}`));
        }
        
        if (conflicts.length > 0) {
          lines.push('conflicts:');
          conflicts.forEach(c => lines.push(`  ${c}`));
        }
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
      }
    }

    return options;
  }
}
