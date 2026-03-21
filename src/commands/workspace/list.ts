import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface WorkspacePackage {
  name: string;
  path: string;
  version?: string;
}

export class WorkspaceListCommand extends Command {
  public getDescription(): string {
    return 'List workspace packages';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt workspace-list [path]',
      description: 'List all packages in a monorepo workspace',
      examples: [
        'adt workspace-list',
        'adt workspace-list packages/',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('workspace list', args, async () => {
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const packages = await this.getWorkspacePackages(targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(packages);
      }

      return this.formatNormal(packages);
    });
  }

  private async getWorkspacePackages(targetPath: string): Promise<WorkspacePackage[]> {
    const packages: WorkspacePackage[] = [];

    // Check for package.json with workspaces
    const rootPackageJson = path.join(targetPath, 'package.json');
    if (fs.existsSync(rootPackageJson)) {
      try {
        const content = fs.readFileSync(rootPackageJson, 'utf-8');
        const pkg = JSON.parse(content);

        if (pkg.workspaces) {
          // npm/yarn workspaces
          const workspaceGlobs = Array.isArray(pkg.workspaces) ? pkg.workspaces : [pkg.workspaces];
          for (const glob of workspaceGlobs) {
            const packageDirs = FileUtils.findFiles(targetPath, path.join(glob, 'package.json'));

            for (const pkgJsonPath of packageDirs) {
              const pkgDir = path.dirname(pkgJsonPath);
              const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
              const pkgData = JSON.parse(pkgContent);

              packages.push({
                name: pkgData.name || path.basename(pkgDir),
                path: pkgDir,
                version: pkgData.version,
              });
            }
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }

    // Check for pnpm workspace.yaml
    const workspaceYaml = path.join(targetPath, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspaceYaml) && packages.length === 0) {
      const packageJsons = FileUtils.findFiles(targetPath, '**/package.json');

      for (const pkgJsonPath of packageJsons) {
        const pkgDir = path.dirname(pkgJsonPath);
        if (pkgDir === targetPath) continue;

        try {
          const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
          const pkgData = JSON.parse(pkgContent);

          packages.push({
            name: pkgData.name || path.basename(pkgDir),
            path: pkgDir,
            version: pkgData.version,
          });
        } catch (error) {
          // Ignore parse errors
        }
      }
    }

    // Fallback: Check for common monorepo structures
    if (packages.length === 0) {
      const commonDirs = ['packages', 'apps', 'services', 'packages/*'];
      for (const dir of commonDirs) {
        const dirPath = path.join(targetPath, dir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          const packageJsons = FileUtils.findFiles(dirPath, 'package.json');

          for (const pkgJsonPath of packageJsons) {
            const pkgDir = path.dirname(pkgJsonPath);
            try {
              const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
              const pkgData = JSON.parse(pkgContent);

              packages.push({
                name: pkgData.name || path.basename(pkgDir),
                path: pkgDir,
                version: pkgData.version,
              });
            } catch (error) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    return packages;
  }

  private formatSlim(packages: WorkspacePackage[]): CommandResult {
    const lines = packages.map(pkg =>
      `${pkg.path.padEnd(30)} ${pkg.name.padEnd(20)} ${pkg.version || 'N/A'}`
    );

    const output = [
      ...lines,
      '---',
      `${packages.length} packages  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'workspace',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: packages.length,
    };
  }

  private formatNormal(packages: WorkspacePackage[]): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `packages: ${packages.length}`,
      `===`
    ];

    for (const pkg of packages) {
      sections.push(`${pkg.path}`);
      sections.push(`  name: ${pkg.name}`);
      sections.push(`  version: ${pkg.version || 'N/A'}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'workspace',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: packages.length,
    };
  }

  private parseArgs(args: string[]): { path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.path = arg;
      }
    }

    return options;
  }
}
