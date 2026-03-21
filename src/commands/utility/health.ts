import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { GitUtils } from '../../utils/git';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface HealthIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  fix?: string;
}

interface HealthScore {
  overall: number;
  categories: {
    structure: number;
    documentation: number;
    testing: number;
    dependencies: number;
    git: number;
    codeQuality: number;
  };
}

export class HealthCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('health', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.checkHealth(targetPath, options);
    });
  }

  private async checkHealth(targetPath: string, options: any): Promise<CommandResult> {
    const issues: HealthIssue[] = [];
    const scores: HealthScore = {
      overall: 0,
      categories: {
        structure: 0,
        documentation: 0,
        testing: 0,
        dependencies: 0,
        git: 0,
        codeQuality: 0,
      },
    };

    await this.checkStructure(targetPath, issues, scores);
    await this.checkDocumentation(targetPath, issues, scores);
    await this.checkTesting(targetPath, issues, scores);
    await this.checkDependencies(targetPath, issues, scores);
    await this.checkGit(targetPath, issues, scores);
    await this.checkCodeQuality(targetPath, issues, scores);

    scores.overall = this.calculateOverallScore(scores.categories);

    const output = this.formatHealthResults(issues, scores, options);

    return {
      ok: true,
      command: 'health',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      issues,
      score: scores,
      recommendation: this.getRecommendation(scores.overall),
    };
  }

  private async checkStructure(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const hasSrc = FileUtils.isDirectory(path.join(targetPath, 'src'));
    const hasTest = FileUtils.isDirectory(path.join(targetPath, 'test'));
    const hasDist = FileUtils.isDirectory(path.join(targetPath, 'dist'));
    const hasPackageJson = FileUtils.fileExists(path.join(targetPath, 'package.json'));
    const hasReadme = FileUtils.fileExists(path.join(targetPath, 'README.md'));
    const hasGitignore = FileUtils.fileExists(path.join(targetPath, '.gitignore'));

    if (!hasPackageJson) {
      issues.push({
        type: 'error',
        category: 'structure',
        message: 'Missing package.json',
        fix: 'Run: npm init -y',
      });
      scores.categories.structure -= 20;
    } else {
      scores.categories.structure += 20;
    }

    if (!hasSrc && !hasTest) {
      issues.push({
        type: 'warning',
        category: 'structure',
        message: 'No src or test directory found',
        fix: 'Create: mkdir src test',
      });
      scores.categories.structure -= 10;
    } else if (hasSrc) {
      scores.categories.structure += 15;
    } else {
      scores.categories.structure += 5;
    }

    if (hasTest) {
      scores.categories.structure += 15;
    }

    if (!hasReadme) {
      issues.push({
        type: 'warning',
        category: 'structure',
        message: 'Missing README.md',
        fix: 'Create: echo "# Project" > README.md',
      });
      scores.categories.structure -= 10;
    } else {
      scores.categories.structure += 10;
    }

    if (!hasGitignore) {
      issues.push({
        type: 'info',
        category: 'structure',
        message: 'Missing .gitignore',
        fix: 'Create: echo "node_modules\\ndist" > .gitignore',
      });
      scores.categories.structure -= 5;
    } else {
      scores.categories.structure += 5;
    }

    scores.categories.structure = Math.max(0, Math.min(100, scores.categories.structure));
  }

  private async checkDocumentation(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const hasReadme = FileUtils.fileExists(path.join(targetPath, 'README.md'));
    const hasChangelog = FileUtils.fileExists(path.join(targetPath, 'CHANGELOG.md'));
    const hasContributing = FileUtils.fileExists(path.join(targetPath, 'CONTRIBUTING.md'));
    const hasDocsDir = FileUtils.isDirectory(path.join(targetPath, 'docs'));

    if (!hasReadme) {
      scores.categories.documentation -= 30;
    } else {
      const readmeContent = FileUtils.readFile(path.join(targetPath, 'README.md'));
      if (readmeContent.length < 200) {
        issues.push({
          type: 'warning',
          category: 'documentation',
          message: 'README.md is too brief',
          fix: 'Add: Installation, Usage, and Contributing sections',
        });
        scores.categories.documentation += 20;
      } else {
        scores.categories.documentation += 40;
      }
    }

    if (!hasChangelog) {
      issues.push({
        type: 'info',
        category: 'documentation',
        message: 'Missing CHANGELOG.md',
        fix: 'Create: echo "# Changelog" > CHANGELOG.md',
      });
      scores.categories.documentation -= 10;
    } else {
      scores.categories.documentation += 20;
    }

    if (hasContributing) {
      scores.categories.documentation += 15;
    }

    if (hasDocsDir) {
      scores.categories.documentation += 15;
    }

    scores.categories.documentation = Math.max(0, Math.min(100, scores.categories.documentation));
  }

  private async checkTesting(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const testFiles = await fg.glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: ['**/node_modules/**'],
    });

    const sourceFiles = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
    });

    if (testFiles.length === 0) {
      issues.push({
        type: 'error',
        category: 'testing',
        message: 'No test files found',
        fix: 'Create test files: *.test.ts or *.spec.ts',
      });
      scores.categories.testing = 0;
    } else {
      const coverage = (testFiles.length / Math.max(sourceFiles.length, 1)) * 100;
      scores.categories.testing = Math.min(100, coverage);

      if (coverage < 20) {
        issues.push({
          type: 'warning',
          category: 'testing',
          message: `Low test coverage: ${coverage.toFixed(1)}%`,
          fix: 'Add more test files',
        });
      }
    }

    const packageJsonPath = path.join(targetPath, 'package.json');
    if (FileUtils.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      if (!packageJson.scripts?.test) {
        issues.push({
          type: 'warning',
          category: 'testing',
          message: 'No test script in package.json',
          fix: 'Add: "scripts": { "test": "jest" }',
        });
        scores.categories.testing -= 10;
      }
    }

    scores.categories.testing = Math.max(0, Math.min(100, scores.categories.testing));
  }

  private async checkDependencies(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const packageJsonPath = path.join(targetPath, 'package.json');
    
    if (!FileUtils.fileExists(packageJsonPath)) {
      scores.categories.dependencies = 0;
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};

    if (Object.keys(deps).length === 0 && Object.keys(devDeps).length === 0) {
      issues.push({
        type: 'info',
        category: 'dependencies',
        message: 'No dependencies found',
      });
      scores.categories.dependencies = 50;
    } else {
      scores.categories.dependencies = 80;
    }

    const hasLockFile = 
      FileUtils.fileExists(path.join(targetPath, 'package-lock.json')) ||
      FileUtils.fileExists(path.join(targetPath, 'yarn.lock')) ||
      FileUtils.fileExists(path.join(targetPath, 'pnpm-lock.yaml'));

    if (!hasLockFile) {
      issues.push({
        type: 'warning',
        category: 'dependencies',
        message: 'No lock file found',
        fix: 'Run: npm install (or yarn install)',
      });
      scores.categories.dependencies -= 20;
    } else {
      scores.categories.dependencies = 100;
    }

    scores.categories.dependencies = Math.max(0, Math.min(100, scores.categories.dependencies));
  }

  private async checkGit(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const isGitRepo = GitUtils.isGitRepository(targetPath);

    if (!isGitRepo) {
      issues.push({
        type: 'warning',
        category: 'git',
        message: 'Not a git repository',
        fix: 'Run: git init',
      });
      scores.categories.git = 0;
      return;
    }

    scores.categories.git = 50;

    const hasGitignore = FileUtils.fileExists(path.join(targetPath, '.gitignore'));
    if (hasGitignore) {
      scores.categories.git += 20;
    }

    try {
      const branch = GitUtils.getCurrentBranch(targetPath);
      if (branch) {
        scores.categories.git += 15;
      }
    } catch {
      // Ignore errors
    }

    try {
      const status = GitUtils.getStatus(targetPath);
      if (status && status.staged && status.staged.length > 0) {
        issues.push({
          type: 'info',
          category: 'git',
          message: `${status.staged.length} staged files`,
        });
      }

      if (status && status.untracked && status.untracked.length > 5) {
        issues.push({
          type: 'warning',
          category: 'git',
          message: `${status.untracked.length} untracked files`,
          fix: 'Run: git add . && git commit',
        });
      }
    } catch {
      // Ignore errors
    }

    scores.categories.git = Math.max(0, Math.min(100, scores.categories.git));
  }

  private async checkCodeQuality(targetPath: string, issues: HealthIssue[], scores: HealthScore): Promise<void> {
    const packageJsonPath = path.join(targetPath, 'package.json');
    
    if (!FileUtils.fileExists(packageJsonPath)) {
      scores.categories.codeQuality = 0;
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    if (packageJson.scripts?.lint) {
      scores.categories.codeQuality += 25;
    } else {
      issues.push({
        type: 'info',
        category: 'codeQuality',
        message: 'No lint script',
        fix: 'Add: "lint": "eslint src/**/*.ts"',
      });
    }

    if (packageJson.scripts?.format) {
      scores.categories.codeQuality += 25;
    } else {
      issues.push({
        type: 'info',
        category: 'codeQuality',
        message: 'No format script',
        fix: 'Add: "format": "prettier --write src/**/*.ts"',
      });
    }

    const hasEslint = FileUtils.fileExists(path.join(targetPath, '.eslintrc.js')) ||
                      FileUtils.fileExists(path.join(targetPath, '.eslintrc.json'));
    if (hasEslint) {
      scores.categories.codeQuality += 25;
    }

    const hasPrettier = FileUtils.fileExists(path.join(targetPath, '.prettierrc')) ||
                        FileUtils.fileExists(path.join(targetPath, 'prettier.config.js'));
    if (hasPrettier) {
      scores.categories.codeQuality += 25;
    }

    const hasTsConfig = FileUtils.fileExists(path.join(targetPath, 'tsconfig.json'));
    if (hasTsConfig) {
      scores.categories.codeQuality += 10;
    }

    scores.categories.codeQuality = Math.max(0, Math.min(100, scores.categories.codeQuality));
  }

  private calculateOverallScore(categories: HealthScore['categories']): number {
    const values = Object.values(categories);
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  private getRecommendation(score: number): string {
    if (score >= 90) {
      return 'Excellent! Project health is very good.';
    } else if (score >= 75) {
      return 'Good! Minor improvements suggested.';
    } else if (score >= 50) {
      return 'Fair. Several areas need attention.';
    } else {
      return 'Poor. Major improvements needed.';
    }
  }

  private formatHealthResults(issues: HealthIssue[], scores: HealthScore, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`score: ${scores.overall}/100`);
      lines.push(`issues: ${issues.length}`);
      
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');
      
      if (errors.length > 0) {
        lines.push(`errors: ${errors.length}`);
      }
      if (warnings.length > 0) {
        lines.push(`warnings: ${warnings.length}`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({ ok: true, issues, score: scores }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: health`);
      lines.push(`===`);
      lines.push(`Overall Score: ${scores.overall}/100`);
      lines.push(``);
      
      lines.push(`Category Scores:`);
      lines.push(`  Structure:     ${scores.categories.structure}/100`);
      lines.push(`  Documentation: ${scores.categories.documentation}/100`);
      lines.push(`  Testing:       ${scores.categories.testing}/100`);
      lines.push(`  Dependencies:  ${scores.categories.dependencies}/100`);
      lines.push(`  Git:           ${scores.categories.git}/100`);
      lines.push(`  Code Quality:  ${scores.categories.codeQuality}/100`);
      lines.push(``);
      
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');
      const infos = issues.filter(i => i.type === 'info');

      if (errors.length > 0) {
        lines.push(`Errors (${errors.length}):`);
        for (const issue of errors) {
          lines.push(`  [${issue.category}] ${issue.message}`);
          if (issue.fix) {
            lines.push(`    Fix: ${issue.fix}`);
          }
        }
        lines.push(``);
      }

      if (warnings.length > 0) {
        lines.push(`Warnings (${warnings.length}):`);
        for (const issue of warnings.slice(0, 10)) {
          lines.push(`  [${issue.category}] ${issue.message}`);
          if (issue.fix) {
            lines.push(`    Fix: ${issue.fix}`);
          }
        }
        if (warnings.length > 10) {
          lines.push(`  ... and ${warnings.length - 10} more`);
        }
        lines.push(``);
      }

      if (infos.length > 0 && options.verbose) {
        lines.push(`Info (${infos.length}):`);
        for (const issue of infos.slice(0, 5)) {
          lines.push(`  [${issue.category}] ${issue.message}`);
        }
        lines.push(``);
      }

      lines.push(`Recommendation: ${this.getRecommendation(scores.overall)}`);

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
