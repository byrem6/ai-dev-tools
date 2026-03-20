import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

interface CheckResult {
  name: string;
  ok: boolean;
  version?: string;
  path?: string;
  tip?: string;
  fix?: string;
}

interface CategoryResult {
  passed: boolean;
  items: CheckResult[];
}

export class DoctorCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('doctor', args, async () => {
      try {
        const installation = this.checkInstallation();
        const project = this.checkProject();
        const configFiles = this.checkConfigFiles();
        const context = this.checkContext();

        const allPassed = installation.passed && project.passed && configFiles.passed;

        const output = this.formatOutput(
          installation,
          project,
          configFiles,
          context,
          allPassed,
          options
        );

        const result: CommandResult = {
          ok: allPassed,
          command: 'doctor',
          tokenEstimate: TokenUtils.estimateTokens(output),
          content: output,
          installation,
          project,
          configFiles,
          context,
          status: allPassed ? 'READY' : 'NOT READY',
        };

        if (!allPassed) {
          process.exitCode = 1;
        }

        return result;
      } catch (error: any) {
        console.error('Doctor command error:', error.message);
        console.error('Stack:', error.stack);
        throw error;
      }
    });
  }

  private checkInstallation(): CategoryResult {
    const items: CheckResult[] = [];

    const adtCheck = this.checkAdt();
    items.push(adtCheck);

    const nodeCheck = this.checkNode();
    items.push(nodeCheck);

    const gitCheck = this.checkGit();
    items.push(gitCheck);

    const allPassed = items.every(item => item.ok);

    return { passed: allPassed, items };
  }

  private checkAdt(): CheckResult {
    try {
      const adtPath = execSync('which adt', { encoding: 'utf-8' }).trim();
      const version = this.getAdtVersion();

      return {
        name: 'adt',
        ok: true,
        version,
        path: adtPath,
      };
    } catch {
      return {
        name: 'adt',
        ok: false,
        tip: 'adt is not installed globally',
        fix: 'npm install -g ai-dev-tools',
      };
    }
  }

  private checkNode(): CheckResult {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major >= 18) {
      return {
        name: 'node',
        ok: true,
        version,
      };
    }

    return {
      name: 'node',
      ok: false,
      version,
      tip: `Node.js v${major} is too old`,
      fix: 'Upgrade Node.js to v18 or later: https://nodejs.org',
    };
  }

  private checkGit(): CheckResult {
    try {
      const gitPath = execSync('which git', { encoding: 'utf-8' }).trim();
      const version = execSync('git --version', { encoding: 'utf-8' }).trim();

      return {
        name: 'git',
        ok: true,
        version,
        path: gitPath,
      };
    } catch {
      return {
        name: 'git',
        ok: false,
        tip: 'git is not installed',
        fix: 'Install git from https://git-scm.com',
      };
    }
  }

  private checkProject(): CategoryResult {
    const items: CheckResult[] = [];

    const gitRepoCheck = this.checkGitRepo();
    items.push(gitRepoCheck);

    const packageJsonCheck = this.checkPackageJson();
    items.push(packageJsonCheck);

    const gitignoreCheck = this.checkGitignore();
    items.push(gitignoreCheck);

    const allPassed = items.every(item => item.ok);

    return { passed: allPassed, items };
  }

  private checkGitRepo(): CheckResult {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return {
        name: 'git-repo',
        ok: true,
        path: '.git',
      };
    } catch {
      return {
        name: 'git-repo',
        ok: false,
        tip: 'not a git repository',
        fix: 'run `git init` or navigate to a git project',
      };
    }
  }

  private checkPackageJson(): CheckResult {
    const exists = fs.existsSync(path.join(process.cwd(), 'package.json'));

    if (exists) {
      return {
        name: 'package.json',
        ok: true,
      };
    }

    return {
      name: 'package.json',
      ok: false,
      tip: 'package.json not found',
      fix: 'run `npm init` to create package.json',
    };
  }

  private checkGitignore(): CheckResult {
    const exists = fs.existsSync(path.join(process.cwd(), '.gitignore'));

    if (exists) {
      return {
        name: '.gitignore',
        ok: true,
      };
    }

    return {
      name: '.gitignore',
      ok: false,
      tip: '.gitignore not found',
      fix: 'create .gitignore to exclude files from git',
    };
  }

  private checkConfigFiles(): CategoryResult {
    const items: CheckResult[] = [];

    const configFiles = [
      { name: 'CLAUDE.md', path: 'CLAUDE.md' },
      { name: '.claude/instructions.md', path: '.claude/instructions.md' },
      { name: '.cursorrules', path: '.cursorrules' },
      { name: '.opencode/config.json', path: '.opencode/config.json' },
      { name: '.github/copilot-instructions.md', path: '.github/copilot-instructions.md' },
    ];

    for (const config of configFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), config.path));
      items.push({
        name: config.name,
        ok: exists,
        path: exists ? config.path : undefined,
      });
    }

    const atLeastOne = items.some(item => item.ok);

    return { passed: atLeastOne, items };
  }

  private checkContext(): CategoryResult {
    const items: CheckResult[] = [];
    const homeDir = os.homedir();
    const projectName = path.basename(process.cwd());

    const contextDir = path.join(homeDir, '.adt', 'context', projectName);
    const sessionsDir = path.join(homeDir, '.adt', 'sessions');
    const backupsDir = path.join(homeDir, '.adt', 'backups');

    const contextExists = fs.existsSync(contextDir);
    items.push({
      name: 'context-dir',
      ok: contextExists,
      path: contextExists ? contextDir : undefined,
      tip: contextExists ? undefined : 'will be created on first context set',
    });

    const sessionsExists = fs.existsSync(sessionsDir);
    items.push({
      name: 'sessions-dir',
      ok: sessionsExists,
      path: sessionsExists ? sessionsDir : undefined,
      tip: sessionsExists ? undefined : 'will be created on first session',
    });

    const backupsExists = fs.existsSync(backupsDir);
    items.push({
      name: 'backups-dir',
      ok: backupsExists,
      path: backupsExists ? backupsDir : undefined,
      tip: backupsExists ? undefined : '[WARN] will be created on first patch',
    });

    return { passed: true, items };
  }

  private getAdtVersion(): string {
    try {
      const pkgPath = path.join(__dirname, '../../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return `v${pkg.version}`;
    } catch {
      return 'unknown';
    }
  }

  private formatOutput(
    installation: CategoryResult,
    project: CategoryResult,
    configFiles: CategoryResult,
    context: CategoryResult,
    allPassed: boolean,
    options: any
  ): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return this.formatSlim(installation, project, configFiles, context, allPassed);
    } else if (fmt === 'json') {
      return this.formatJson(installation, project, configFiles, context, allPassed);
    } else {
      return this.formatNormal(installation, project, configFiles, context, allPassed);
    }
  }

  private formatSlim(
    installation: CategoryResult,
    project: CategoryResult,
    configFiles: CategoryResult,
    context: CategoryResult,
    allPassed: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`ok ${allPassed ? 'true' : 'false'}`);

    installation.items.forEach(item => {
      if (item.ok) {
        const version = item.version ? ` ${item.version}` : '';
        lines.push(`✓ ${item.name}${version}`);
      } else {
        const tip = item.tip ?? 'NOT FOUND';
        lines.push(`✗ ${item.name}  ${tip}`);
        if (item.fix) {
          lines.push(`tip: ${item.fix}`);
        }
      }
    });

    project.items.forEach(item => {
      if (item.ok) {
        lines.push(`${item.name}`);
      } else {
        const tip = item.tip ?? 'NOT FOUND';
        lines.push(`✗ ${item.name}  ${tip}`);
      }
    });

    const foundConfigs = configFiles.items.filter(i => i.ok);
    if (foundConfigs.length > 0) {
      foundConfigs.forEach(f => lines.push(f.name));
    }

    if (context.items.filter(i => i.ok).length === context.items.length) {
      lines.push('context initialized');
    }

    return lines.join('\n');
  }

  private formatNormal(
    installation: CategoryResult,
    project: CategoryResult,
    configFiles: CategoryResult,
    context: CategoryResult,
    allPassed: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`ok: ${allPassed ? 'true' : 'false'}`);
    lines.push('===');

    lines.push('INSTALLATION');
    installation.items.forEach(item => {
      if (item.ok) {
        const version = item.version ? `  ${item.version}` : '';
        const path = item.path ? `  ${item.path}` : '';
        lines.push(`  ✓  ${item.name.padEnd(10)}${version}${path}`);
      } else {
        lines.push(`  ✗  ${item.name.padEnd(10)}${item.tip || ''}`);
        if (item.fix) {
          lines.push(`     fix: ${item.fix}`);
        }
      }
    });

    lines.push('');
    lines.push('PROJECT');
    project.items.forEach(item => {
      if (item.ok) {
        const path = item.path ? `  ${item.path}` : '';
        lines.push(`  ✓  ${item.name.padEnd(15)}${path}`);
      } else {
        lines.push(`  ✗  ${item.name.padEnd(15)}${item.tip || ''}`);
        if (item.fix) {
          lines.push(`     fix: ${item.fix}`);
        }
      }
    });

    lines.push('');
    const foundCount = configFiles.items.filter(i => i.ok).length;
    lines.push(`CONFIG FILES  (${foundCount} of ${configFiles.items.length} present)`);
    configFiles.items.forEach(item => {
      if (item.ok) {
        lines.push(`  ✓  ${item.name}`);
      } else {
        lines.push(`  -  ${item.name.padEnd(35)}[not found]`);
      }
    });

    lines.push('');
    lines.push('ADT CONTEXT');
    context.items.forEach(item => {
      if (item.ok) {
        const path = item.path ? `  ${item.path}` : '';
        lines.push(`  ✓  ${item.name.padEnd(15)}${path}`);
      } else {
        const tip = item.tip || '[not found]';
        lines.push(`  ✗  ${item.name.padEnd(15)}${tip}`);
      }
    });

    lines.push('---');

    if (allPassed) {
      lines.push('status: READY');
    } else {
      const errorCount =
        installation.items.filter(i => !i.ok).length +
        project.items.filter(i => !i.ok).length +
        (configFiles.passed ? 0 : 1);
      lines.push(`status: NOT READY  (${errorCount} errors)`);
    }

    const missingConfigs = configFiles.items.filter(i => !i.ok);
    if (missingConfigs.length > 0 && missingConfigs.length < configFiles.items.length) {
      lines.push("tip: run `adt init` to generate missing config files");
    }

    return lines.join('\n');
  }

  private formatJson(
    installation: CategoryResult,
    project: CategoryResult,
    configFiles: CategoryResult,
    context: CategoryResult,
    allPassed: boolean
  ): string {
    const warnings: string[] = [];
    context.items.forEach(item => {
      if (!item.ok && item.tip) {
        warnings.push(`${item.name}: ${item.tip}`);
      }
    });

    return JSON.stringify({
      ok: allPassed,
      status: allPassed ? 'READY' : 'NOT READY',
      checks: {
        installation: {
          passed: installation.passed,
          items: installation.items,
        },
        project: {
          passed: project.passed,
          items: project.items,
        },
        configFiles: {
          passed: configFiles.passed,
          foundCount: configFiles.items.filter(i => i.ok).length,
          items: configFiles.items,
        },
        context: {
          passed: context.passed,
          warnings,
        },
      },
    }, null, 2);
  }

  protected parseArgs(args: string[]): any {
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
