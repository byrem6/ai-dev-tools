import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface Suggestion {
  type: 'command' | 'refactor' | 'test' | 'docs' | 'security';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  command?: string;
  reason: string;
}

export class SmartCommand extends Command {
  public getDescription(): string {
    return 'Smart suggestions';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('smart', args, async () => {
      const action = options.action || 'suggest';
      const targetPath = options.path || process.cwd();

      switch (action) {
        case 'suggest':
          return this.generateSuggestions(targetPath, options);
        case 'analyze':
          return this.analyzeCodebase(targetPath, options);
        case 'plan':
          return this.createPlan(options.goal, targetPath, options);
        case 'review':
          return this.reviewChanges(targetPath, options);
        default:
          return this.generateSuggestions(targetPath, options);
      }
    });
  }

  private async generateSuggestions(targetPath: string, options: any): Promise<CommandResult> {
    const suggestions: Suggestion[] = [];
    const sessionEvents = this.sessionManager.getEvents();
    const context = await this.loadContext();

    if (sessionEvents.length === 0) {
      suggestions.push({
        type: 'command',
        priority: 'high',
        title: 'Explore the codebase',
        description: 'Start by understanding the project structure',
        command: 'adt map . --fmt normal',
        reason: 'No commands run yet - need to establish context',
      });
    }

    const lastEvents = sessionEvents.slice(-5);
    const lastCommand = lastEvents[lastEvents.length - 1];

    if (lastCommand) {
      if (lastCommand.command === 'grep' && lastCommand.success) {
        suggestions.push({
          type: 'command',
          priority: 'high',
          title: 'Find symbol references',
          description: 'Get all usages of the symbol you found',
          command: 'adt refs <symbol> src/',
          reason: 'After grep, refs provides complete usage context',
        });
      }

      if (lastCommand.command === 'read' && lastCommand.success) {
        suggestions.push({
          type: 'command',
          priority: 'medium',
          title: 'Analyze file structure',
          description: 'Get an outline of the file contents',
          command: `adt outline ${lastCommand.args[0]} --fmt normal`,
          reason: 'After reading a file, outline shows the structure',
        });
      }

      if (lastCommand.command === 'git-status') {
        suggestions.push({
          type: 'command',
          priority: 'high',
          title: 'Review changes',
          description: 'See what has changed in the working directory',
          command: 'adt git-diff --fmt normal',
          reason: 'After status, diff shows the actual changes',
        });
      }
    }

    if (fs.existsSync(path.join(targetPath, '.git'))) {
      const hasUncommitted = this.hasUncommittedChanges(targetPath);
      if (hasUncommitted) {
        suggestions.push({
          type: 'command',
          priority: 'medium',
          title: 'Review or commit changes',
          description: 'You have uncommitted changes',
          command: 'adt git-diff --fmt normal',
          reason: 'Uncommitted changes detected - review before continuing',
        });
      }
    }

    const complexity = await this.checkComplexity(targetPath);
    if (complexity.highComplexityFiles > 0) {
      suggestions.push({
        type: 'refactor',
        priority: 'medium',
        title: 'Simplify complex code',
        description: `Found ${complexity.highComplexityFiles} files with high complexity`,
        command: 'adt complexity . --top 10 --fmt normal',
        reason: 'High complexity increases maintenance burden',
      });
    }

    const testStatus = await this.checkTests(targetPath);
    if (!testStatus.hasTests) {
      suggestions.push({
        type: 'test',
        priority: 'high',
        title: 'Add test coverage',
        description: 'No tests found in the project',
        command: 'adt test --init',
        reason: 'Tests prevent regressions and document behavior',
      });
    } else if (testStatus.lowCoverage) {
      suggestions.push({
        type: 'test',
        priority: 'medium',
        title: 'Improve test coverage',
        description: 'Test coverage is below 70%',
        command: 'adt test --coverage',
        reason: 'Low coverage indicates untested code paths',
      });
    }

    const docs = await this.checkDocumentation(targetPath);
    if (!docs.hasReadme) {
      suggestions.push({
        type: 'docs',
        priority: 'high',
        title: 'Create README',
        description: 'No README.md found',
        command: 'adt doc readme --generate',
        reason: 'README helps new contributors understand the project',
      });
    }

    return {
      ok: true,
      command: 'smart',
      action: 'suggest',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(suggestions)),
      content: this.formatSuggestions(suggestions, options),
      suggestions,
    };
  }

  private async analyzeCodebase(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*.{ts,js,tsx,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.get('excludeByDefault'),
    });

    const analysis = {
      totalFiles: files.length,
      languages: {} as any,
      complexity: await this.checkComplexity(targetPath),
      tests: await this.checkTests(targetPath),
      documentation: await this.checkDocumentation(targetPath),
      dependencies: await this.analyzeDependencies(targetPath),
      health: await this.calculateHealthScore(targetPath),
    };

    analysis.languages = this.categorizeFiles(files);

    return {
      ok: true,
      command: 'smart',
      action: 'analyze',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(analysis)),
      content: this.formatAnalysis(analysis, options),
      analysis,
    };
  }

  private async createPlan(goal: string, targetPath: string, options: any): Promise<CommandResult> {
    if (!goal) {
      throw createError('ENOMATCH', '', 'Goal required. Usage: adt smart plan "<goal>"');
    }

    const steps: any[] = [];
    const analysis = await this.analyzeCodebase(targetPath, { fmt: 'json' });

    const goalLower = goal.toLowerCase();

    if (goalLower.includes('refactor') || goalLower.includes('clean')) {
      steps.push({
        step: 1,
        action: 'Analyze complexity',
        command: 'adt complexity . --fmt normal',
        reason: 'Identify areas needing refactoring',
      });
      steps.push({
        step: 2,
        action: 'Find duplicate code',
        command: 'adt duplicate src --lines 5 --fmt normal',
        reason: 'Duplicate code should be extracted',
      });
      steps.push({
        step: 3,
        action: 'Check for unused code',
        command: 'adt unused src --check both --fmt normal',
        reason: 'Remove dead code to simplify',
      });
    }

    if (goalLower.includes('test') || goalLower.includes('coverage')) {
      steps.push({
        step: 1,
        action: 'Run tests',
        command: 'adt test --coverage',
        reason: 'Check current test status',
      });
      steps.push({
        step: 2,
        action: 'Find untested files',
        command: 'adt files src --ext ts --exec "!test/**/*" --fmt slim',
        reason: 'Identify files without tests',
      });
      steps.push({
        step: 3,
        action: 'Generate test scaffolding',
        command: 'adt test --scaffold src/',
        reason: 'Create test stubs for missing coverage',
      });
    }

    if (goalLower.includes('document') || goalLower.includes('docs')) {
      steps.push({
        step: 1,
        action: 'Generate documentation',
        command: 'adt doc generate --all',
        reason: 'Create base documentation',
      });
      steps.push({
        step: 2,
        action: 'Check for undocumented symbols',
        command: 'adt symbols src --filter "!documented" --fmt normal',
        reason: 'Find symbols needing docs',
      });
    }

    if (steps.length === 0) {
      steps.push({
        step: 1,
        action: 'Analyze codebase',
        command: 'adt smart analyze --fmt normal',
        reason: 'Understand current state before planning',
      });
      steps.push({
        step: 2,
        action: 'Set context',
        command: `adt context track "Goal: ${goal}"`,
        reason: 'Record the goal for tracking',
      });
      steps.push({
        step: 3,
        action: 'Get suggestions',
        command: 'adt smart suggest --fmt normal',
        reason: 'Get actionable next steps',
      });
    }

    return {
      ok: true,
      command: 'smart',
      action: 'plan',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(steps)),
      content: this.formatPlan(goal, steps, options),
      goal,
      steps,
    };
  }

  private async reviewChanges(targetPath: string, options: any): Promise<CommandResult> {
    const issues: any[] = [];

    const hasChanges = this.hasUncommittedChanges(targetPath);
    if (!hasChanges) {
      return {
        ok: true,
        command: 'smart',
        action: 'review',
        tokenEstimate: 30,
        content: 'No changes to review',
        issues: [],
      };
    }

    const complexity = await this.checkComplexity(targetPath);
    if (complexity.highComplexityFiles > 0) {
      issues.push({
        type: 'complexity',
        severity: 'warning',
        message: `${complexity.highComplexityFiles} files with high complexity`,
      });
    }

    const tests = await this.checkTests(targetPath);
    if (tests.hasTests) {
      issues.push({
        type: 'test',
        severity: 'info',
        message: 'Run tests to ensure changes don\'t break anything',
        command: 'adt test',
      });
    }

    return {
      ok: true,
      command: 'smart',
      action: 'review',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(issues)),
      content: this.formatReview(issues, options),
      issues,
    };
  }

  private async loadContext(): Promise<any> {
    try {
      const { ContextCommand } = await import('../context/context');
      const contextCmd = new ContextCommand(this.formatManager, this.configManager, this.sessionManager);
      const result = await contextCmd.execute('get');
      return result.context || {};
    } catch {
      return {};
    }
  }

  private hasUncommittedChanges(targetPath: string): boolean {
    try {
      const gitDir = path.join(targetPath, '.git');
      if (!fs.existsSync(gitDir)) return false;

      const status = require('child_process')
        .execSync('git status --porcelain', { cwd: targetPath, encoding: 'utf-8' });
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async checkComplexity(targetPath: string): Promise<any> {
    try {
      const { ComplexityCommand } = await import('../complexity/complexity');
      const complexityCmd = new ComplexityCommand(this.formatManager, this.configManager, this.sessionManager);
      const result = await complexityCmd.execute('hotspot', '--path', targetPath, '--top', '100', '--fmt', 'json');
      const metrics = result.metrics || [];
      const highComplexity = metrics.filter((m: any) => m.cyclomatic > 15);
      return {
        highComplexityFiles: highComplexity.length,
        totalFiles: metrics.length,
      };
    } catch {
      return { highComplexityFiles: 0, totalFiles: 0 };
    }
  }

  private async checkTests(targetPath: string): Promise<any> {
    const testFiles = await fg.glob('**/*.test.{ts,js}', {
      cwd: targetPath,
      onlyFiles: true,
    });

    const hasTests = testFiles.length > 0;
    const lowCoverage = false;

    return { hasTests, lowCoverage, testCount: testFiles.length };
  }

  private async checkDocumentation(targetPath: string): Promise<any> {
    const hasReadme = fs.existsSync(path.join(targetPath, 'README.md'));
    const hasChangelog = fs.existsSync(path.join(targetPath, 'CHANGELOG.md'));

    return { hasReadme, hasChangelog };
  }

  private async analyzeDependencies(targetPath: string): Promise<any> {
    const pkgPath = path.join(targetPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { hasPackageJson: false, dependencies: 0, devDependencies: 0 };
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        hasPackageJson: true,
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
      };
    } catch {
      return { hasPackageJson: true, dependencies: 0, devDependencies: 0 };
    }
  }

  private async calculateHealthScore(targetPath: string): Promise<number> {
    let score = 0;

    const docs = await this.checkDocumentation(targetPath);
    if (docs.hasReadme) score += 20;
    if (docs.hasChangelog) score += 10;

    const tests = await this.checkTests(targetPath);
    if (tests.hasTests) score += 30;

    const complexity = await this.checkComplexity(targetPath);
    if (complexity.highComplexityFiles === 0) score += 20;

    const deps = await this.analyzeDependencies(targetPath);
    if (deps.hasPackageJson) score += 20;

    return Math.min(score, 100);
  }

  private categorizeFiles(files: string[]): any {
    const categories: any = {};
    files.forEach(file => {
      const ext = path.extname(file).substring(1);
      categories[ext] = (categories[ext] || 0) + 1;
    });
    return categories;
  }

  private formatSuggestions(suggestions: Suggestion[], options: any): string {
    if (options.fmt === 'slim') {
      const lines = ['ok true', `suggestions: ${suggestions.length}`];
      suggestions.forEach((s, i) => {
        lines.push(`${i + 1}. [${s.priority}] ${s.title}`);
        if (s.command) lines.push(`   ${s.command}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, suggestions }, null, 2);
    } else {
      const lines = ['ok: true', '---', `AI Suggestions (${suggestions.length}):`];
      suggestions.forEach((s, i) => {
        lines.push(`${i + 1}. [${s.type}:${s.priority}] ${s.title}`);
        lines.push(`   ${s.description}`);
        if (s.command) lines.push(`   $ ${s.command}`);
        lines.push(`   → ${s.reason}`);
      });
      return lines.join('\n');
    }
  }

  private formatAnalysis(analysis: any, options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\nfiles: ${analysis.totalFiles}\nhealth: ${analysis.health}/100`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, analysis }, null, 2);
    } else {
      const lines = [
        'ok: true',
        '---',
        'Codebase Analysis',
        `Total Files: ${analysis.totalFiles}`,
        `Health Score: ${analysis.health}/100`,
        '---',
        'Languages:',
      ];
      Object.entries(analysis.languages).forEach(([ext, count]: [string, any]) => {
        lines.push(`  .${ext}: ${count} files`);
      });
      lines.push('---');
      lines.push(`Tests: ${analysis.tests.hasTests ? 'Yes' : 'No'}`);
      lines.push(`Documentation: ${analysis.documentation.hasReadme ? 'Yes' : 'No'}`);
      return lines.join('\n');
    }
  }

  private formatPlan(goal: string, steps: any[], options: any): string {
    if (options.fmt === 'slim') {
      const lines = ['ok true', `goal: ${goal}`, `steps: ${steps.length}`];
      steps.forEach(s => {
        lines.push(`${s.step}. ${s.action}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, goal, steps }, null, 2);
    } else {
      const lines = [
        'ok: true',
        '---',
        `Plan: ${goal}`,
        '---',
      ];
      steps.forEach(s => {
        lines.push(`${s.step}. ${s.action}`);
        lines.push(`   $ ${s.command}`);
        lines.push(`   ${s.reason}`);
      });
      return lines.join('\n');
    }
  }

  private formatReview(issues: any[], options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\nissues: ${issues.length}`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, issues }, null, 2);
    } else {
      const lines = ['ok: true', '---', 'Change Review'];
      if (issues.length === 0) {
        lines.push('No issues found');
      } else {
        issues.forEach(issue => {
          lines.push(`[${issue.severity}] ${issue.message}`);
        });
      }
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      } else if (arg === '--path' && args[i + 1]) {
        options.path = args[++i];
      } else if (['suggest', 'analyze', 'plan', 'review'].includes(arg)) {
        options.action = arg;
      } else if (arg === '--goal' && args[i + 1]) {
        options.goal = args[++i];
      } else if (options.action === 'plan' && !options.goal && !arg.startsWith('--')) {
        options.goal = arg;
      }
    }

    return options;
  }
}
