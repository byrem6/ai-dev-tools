import { execSync, ExecSyncOptions } from 'child_process';
import * as path from 'path';

export class GitUtils {
  private static getGitCommand(): string {
    const isWindows = process.platform === 'win32';
    return isWindows ? 'git.exe' : 'git';
  }

  static exec(command: string, dir: string = process.cwd()): string {
    try {
      const fullCommand = `${this.getGitCommand()} ${command}`;

      if (process.platform === 'win32') {
        // Windows: Use shell for better compatibility
        return execSync(`cmd /c "${fullCommand}"`, {
          cwd: dir,
          encoding: 'utf-8',
        }) as string;
      } else {
        // Unix: Direct execution
        return execSync(fullCommand, {
          cwd: dir,
          encoding: 'utf-8',
        }) as string;
      }
    } catch (error) {
      throw new Error(`Git command failed: ${command}`);
    }
  }

  static isGitRepository(dir: string = process.cwd()): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: dir,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  static getGitRoot(dir: string = process.cwd()): string | null {
    try {
      const root = execSync('git rev-parse --show-toplevel', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
      return root;
    } catch {
      return null;
    }
  }

  static getCurrentBranch(dir: string = process.cwd()): string | null {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();
      return branch;
    } catch {
      return null;
    }
  }

  static getStatus(dir: string = process.cwd()): any {
    try {
      const output = execSync('git status --porcelain', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      lines.forEach((line: string) => {
        const status = line.substring(0, 2);

        if (status.trim() === '') {
          return;
        }

        const statusCode = status.charAt(0);
        const statusIndex = status.charAt(1);
        // Handle both "M  path" (staged) and " M path" (unstaged) — separator may vary on Windows git
        const file = line.substring(2).trimStart();
        if (statusCode !== ' ' && statusCode !== '?') {
          staged.push(`${statusCode} ${file}`);
        }

        if (statusIndex !== ' ' && statusCode !== '?') {
          unstaged.push(`${statusIndex} ${file}`);
        }

        if (statusCode === '?') {
          untracked.push(`? ${file}`);
        }
      });

      return { staged, unstaged, untracked };
    } catch {
      return null;
    }
  }

  static getDiff(dir: string = process.cwd(), cached: boolean = false): string | null {
    try {
      const args = cached ? ['--staged'] : [];
      const output = execSync(`git diff ${args.join(' ')}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return output;
    } catch {
      return null;
    }
  }

  static getLog(dir: string = process.cwd(), limit: number = 20): any[] {
    try {
      const output = execSync(
        `git log --format="%H|%h|%an|%ae|%ad|%s" -${limit}`,
        {
          cwd: dir,
          encoding: 'utf-8',
        }
      );

      const lines = output.trim().split('\n');
      const commits: any[] = [];

      lines.forEach((line) => {
        const parts = line.split('|');
        if (parts.length >= 6) {
          commits.push({
            hash: parts[0],
            hashShort: parts[1],
            author: { name: parts[2], email: parts[3] },
            date: parts[4],
            message: parts.slice(5).join('|'),
          });
        }
      });

      return commits;
    } catch {
      return [];
    }
  }

  static getBlame(dir: string, file: string, lines?: {start: number, end: number}): any[] | null {
    try {
      const output = execSync(`git blame ${file}`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      const blames: any[] = [];

      lines.forEach((line) => {
        const match = line.match(/^(\w+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+\d+\)\s+(.*)$/);
        if (match) {
          blames.push({
            hash: match[1],
            author: match[2].trim(),
            date: match[3],
            content: match[4],
          });
        }
      });

      return blames;
    } catch {
      return null;
    }
  }

  static stashSave(dir: string, message: string = 'WIP'): any {
    try {
      const branch = this.getCurrentBranch(dir) || 'HEAD';
      const cmd = `git stash save "${message}"`;
      const output = execSync(cmd, {
        cwd: dir,
        encoding: 'utf-8',
      });

      return {
        ok: true,
        stash: {
          stash: `stash@{0}`,
          branch,
          message,
          date: new Date().toISOString().split('T')[0],
        },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashList(dir: string): any {
    try {
      const output = execSync('git stash list', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      const stashes = lines.map((line) => {
        const match = line.match(/^stash@\{(\d+)\}:\s+On\s+(\S+)\s+(.+)$/);
        if (match) {
          return {
            index: parseInt(match[1]),
            stash: `stash@{${match[1]}}`,
            branch: match[2],
            message: match[3],
            date: new Date().toISOString().split('T')[0],
          };
        }
        return null;
      }).filter(Boolean);

      return { ok: true, stashes };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashPop(dir: string, index: string = '0'): any {
    try {
      execSync(`git stash pop stash@{${index}}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashApply(dir: string, index: string = '0'): any {
    try {
      execSync(`git stash apply stash@{${index}}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashDrop(dir: string, index: string = '0'): any {
    try {
      execSync(`git stash drop stash@{${index}}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashShow(dir: string, index: string = '0'): any {
    try {
      const diff = execSync(`git stash show -p stash@{${index}}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true, diff };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static stashClear(dir: string): any {
    try {
      execSync('git stash clear', {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static reset(dir: string, mode: string, target: string): any {
    try {
      const modeFlag = mode === 'soft' ? '--soft' : mode === 'hard' ? '--hard' : '--mixed';
      execSync(`git reset ${modeFlag} ${target}`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const status = this.getStatus(dir);
      const files = [
        ...(status?.staged || []),
        ...(status?.unstaged || []),
      ];

      return { ok: true, files };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static checkMergeConflicts(dir: string, branch: string): any {
    try {
      const output = execSync(`git merge --no-commit --no-ff ${branch}`, {
        cwd: dir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      execSync('git merge --abort', {
        cwd: dir,
        stdio: 'ignore',
      });

      return {
        ok: true,
        conflicts: [],
        risk: 'low',
      };
    } catch (error: any) {
      const conflicts: string[] = [];
      if (error.message.includes('CONFLICT')) {
        const match = error.message.match(/CONFLICT \(content\): Merge conflict in (.+)/g);
        if (match) {
          conflicts.push(...match.map((m: string) => m.replace(/CONFLICT \(content\): Merge conflict in /, '')));
        }
      }

      try {
        execSync('git merge --abort', {
          cwd: dir,
          stdio: 'ignore',
        });
      } catch {
        // Ignore abort errors
      }

      return {
        ok: true,
        conflicts,
        risk: conflicts.length > 0 ? 'high' : 'low',
      };
    }
  }

  static merge(dir: string, branch: string, mode: string): any {
    try {
      const args: string[] = [];
      if (mode === 'no-ff') args.push('--no-ff');
      if (mode === 'squash') args.push('--squash');

      const output = execSync(`git merge ${args.join(' ')} ${branch}`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const log = this.getLog(dir, 1);
      const hash = log[0]?.hash;

      return {
        ok: true,
        hash,
        commits: 1,
        files: 0,
        conflicts: [],
      };
    } catch (error: any) {
      const conflicts: string[] = [];
      if (error.message.includes('CONFLICT')) {
        const match = error.message.match(/CONFLICT \(content\): Merge conflict in (.+)/g);
        if (match) {
          conflicts.push(...match.map((m: string) => m.replace(/CONFLICT \(content\): Merge conflict in /, '')));
        }
      }

      if (conflicts.length > 0) {
        return {
          ok: true,
          conflicts,
          error: 'Merge conflicts',
        };
      }

      return { ok: false, error: error.message };
    }
  }

  static listTags(dir: string): any {
    try {
      const output = execSync('git tag -l', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const tags = output.trim().split('\n')
        .filter((s: string) => Boolean(s))
        .map((name: string) => {
          try {
            const commit = execSync(`git rev-list -n 1 ${name}`, {
              cwd: dir,
              encoding: 'utf-8',
            }).trim();
            return { name, commit: { hash: commit }, message: '' };
          } catch {
            return { name, commit: null, message: '' };
          }
        });

      return { ok: true, tags };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static createTag(dir: string, name: string, message?: string, commit?: string): any {
    try {
      const args = [];
      if (message) {
        args.push('-a');
        args.push('-m');
        args.push(message);
      } else {
        args.push('-a');
      }
      if (commit) {
        args.push(commit);
      }

      execSync(`git tag ${args.join(' ')} ${name}`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const tagCommit = commit || execSync('git rev-parse HEAD', {
        cwd: dir,
        encoding: 'utf-8',
      }).trim();

      return {
        ok: true,
        tag: { name, commit: tagCommit, message: message || '' },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static deleteTag(dir: string, name: string): any {
    try {
      execSync(`git tag -d ${name}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static pushTag(dir: string, name?: string, all: boolean = false): any {
    try {
      if (all) {
        execSync('git push --tags', {
          cwd: dir,
          encoding: 'utf-8',
        });
      } else if (name) {
        execSync(`git push origin ${name}`, {
          cwd: dir,
          encoding: 'utf-8',
        });
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static resetOld(dir: string = process.cwd(), mode: 'soft' | 'mixed' | 'hard' = 'soft', target: string = 'HEAD'): boolean {
    try {
      execSync(`git reset --${mode} ${target}`, {
        cwd: dir,
      });
      return true;
    } catch {
      return false;
    }
  }

  static stashOld(dir: string, message?: string): boolean {
    try {
      const msg = message ? `"${message}"` : '';
      execSync(`git stash save ${msg}`, {
        cwd: dir,
      });
      return true;
    } catch {
      return false;
    }
  }

  static stashListOld(dir: string): any[] {
    try {
      const output = execSync('git stash list', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      return lines.map((line: string) => {
        const match = line.match(/^stash@{\d+}:\s+(.+)$/);
        return match ? match[1] : line;
      });
    } catch {
      return [];
    }
  }

  static checkCherryPickConflicts(dir: string, commitHash: string): any {
    try {
      const output = execSync(`git cherry-pick --no-commit --no-ff ${commitHash}`, {
        cwd: dir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      execSync('git cherry-pick --abort', {
        cwd: dir,
        stdio: 'ignore',
      });

      return {
        ok: true,
        conflicts: [],
        risk: 'low',
      };
    } catch (error: any) {
      const conflicts: string[] = [];
      if (error.message.includes('CONFLICT')) {
        const match = error.message.match(/CONFLICT \(content\): Merge conflict in (.+)/g);
        if (match) {
          conflicts.push(...match.map((m: string) => m.replace(/CONFLICT \(content\): Merge conflict in /, '')));
        }
      }

      try {
        execSync('git cherry-pick --abort', {
          cwd: dir,
          stdio: 'ignore',
        });
      } catch {
        // Ignore abort errors
      }

      return {
        ok: true,
        conflicts,
        risk: conflicts.length > 0 ? 'high' : 'low',
      };
    }
  }

  static cherryPick(dir: string, commitHash: string, options: any = {}): any {
    try {
      const args: string[] = [];
      if (options.commit) {
        args.push('--allow-empty');
      }

      const output = execSync(`git cherry-pick ${args.join(' ')} ${commitHash}`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const log = this.getLog(dir, 1);
      const newCommit = log[0]?.hash;

      return {
        ok: true,
        newCommit,
        conflicts: [],
      };
    } catch (error: any) {
      const conflicts: string[] = [];
      if (error.message.includes('CONFLICT')) {
        const match = error.message.match(/CONFLICT \(content\): Merge conflict in (.+)/g);
        if (match) {
          conflicts.push(...match.map((m: string) => m.replace(/CONFLICT \(content\): Merge conflict in /, '')));
        }
      }

      if (conflicts.length > 0) {
        return {
          ok: true,
          conflicts,
          error: 'Cherry-pick conflicts',
        };
      }

      return { ok: false, error: error.message };
    }
  }

  static getBranches(dir: string): any {
    try {
      const output = execSync('git branch -a', {
        cwd: dir,
        encoding: 'utf-8',
      });

      const current = this.getCurrentBranch(dir);
      const lines = output.trim().split('\n');
      const branches: any[] = [];

      lines.forEach((line) => {
        const isCurrent = line.startsWith('*');
        const name = line.replace(/^\*?\s*/, '').trim();
        if (name && !name.startsWith('HEAD')) {
          branches.push({
            name,
            current: isCurrent,
            remote: name.startsWith('remotes/'),
          });
        }
      });

      return { ok: true, current, branches };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static createBranch(dir: string, name: string, from: string = 'HEAD'): any {
    try {
      execSync(`git branch ${name} ${from}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true, name };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static deleteBranch(dir: string, name: string, force: boolean = false): any {
    try {
      const forceFlag = force ? '-D' : '-d';
      execSync(`git branch ${forceFlag} ${name}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static switchBranch(dir: string, name: string): any {
    try {
      execSync(`git checkout ${name}`, {
        cwd: dir,
        encoding: 'utf-8',
      });
      return { ok: true, branch: name };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  static commit(dir: string, message: string, amend: boolean = false): any {
    try {
      const args = amend ? ['--amend'] : [];
      execSync(`git commit ${args.join(' ')} -m "${message}"`, {
        cwd: dir,
        encoding: 'utf-8',
      });

      const log = this.getLog(dir, 1);
      return { ok: true, commit: log[0] };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}
