import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { GitUtils } from '../../utils/git';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export class AICommand extends Command {
  public getDescription(): string {
    return 'AI-powered code analysis';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'slim');

    return this.runWithLogging('ai', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.runAIMode(targetPath, options);
    });
  }

  private async runAIMode(targetPath: string, options: any): Promise<CommandResult> {
    const goal = options.goal || '';
    
    if (!goal) {
      return this.provideAISuggestions(targetPath, options);
    }

    const analysis = await this.analyzeForGoal(targetPath, goal, options);
    const plan = this.generatePlan(analysis, goal);
    
    const output = this.formatAIAnalysis(analysis, plan, options);

    return {
      ok: true,
      command: 'ai',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      goal,
      analysis,
      plan,
      suggestions: analysis.suggestions || [],
    };
  }

  private async provideAISuggestions(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.config.excludeByDefault,
    });

    const suggestions: string[] = [];
    
    // Check for common issues
    const packageJsonPath = path.join(targetPath, 'package.json');
    if (FileUtils.fileExists(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      if (!pkg.scripts?.test) {
        suggestions.push('Add test script to package.json');
      }
      
      if (!pkg.scripts?.lint && !pkg.scripts?.format) {
        suggestions.push('Add lint/format scripts');
      }
      
      if (!pkg.devDependencies?.typescript && !pkg.dependencies?.typescript) {
        suggestions.push('Install TypeScript for type safety');
      }
    }

    const hasTests = files.some((f: string) => f.includes('.test.') || f.includes('.spec.'));
    if (!hasTests && files.length > 5) {
      suggestions.push('Add test files for core functionality');
    }

    const hasGit = GitUtils.isGitRepository(targetPath);
    if (!hasGit) {
      suggestions.push('Initialize git repository: git init');
    }

    const output = this.formatSuggestions(suggestions, files.length, options);

    return {
      ok: true,
      command: 'ai',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      suggestions,
      totalFiles: files.length,
    };
  }

  private async analyzeForGoal(targetPath: string, goal: string, options: any): Promise<any> {
    const analysis: any = {
      goal,
      targetPath,
      files: [],
      issues: [],
      suggestions: [],
    };

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.config.excludeByDefault,
    });

    for (const file of files.slice(0, 50)) {
      try {
        const content = FileUtils.readFile(path.join(targetPath, file));
        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();
          
          symbols.forEach(sym => {
            if (sym.type === 'function' || sym.type === 'method') {
              const complexity = this.estimateComplexity(sym);
              if (complexity > 10) {
                analysis.issues.push({
                  file,
                  type: 'complexity',
                  symbol: sym.name,
                  line: sym.line,
                  complexity,
                });
              }
            }
          });

          analysis.files.push({
            file,
            symbols: symbols.length,
          });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    analysis.suggestions = this.generateSuggestions(analysis, goal);

    return analysis;
  }

  private generatePlan(analysis: any, goal: string): any[] {
    const plan: any[] = [];

    if (goal.includes('refactor') || goal.includes('simplify')) {
      const highComplexity = analysis.issues
        .filter((i: any) => i.complexity > 10)
        .sort((a: any, b: any) => b.complexity - a.complexity)
        .slice(0, 5);

      highComplexity.forEach((issue: any) => {
        plan.push({
          action: 'refactor',
          target: `${issue.file}:${issue.line}`,
          priority: 'high',
          reason: `High complexity (${issue.complexity})`,
        });
      });
    }

    if (goal.includes('test') || goal.includes('coverage')) {
      plan.push({
        action: 'add-tests',
        priority: 'medium',
        reason: 'Improve test coverage',
      });
    }

    if (goal.includes('type') || goal.includes('safety')) {
      plan.push({
        action: 'enable-typecheck',
        priority: 'high',
        reason: 'Add type safety',
      });
    }

    return plan;
  }

  private estimateComplexity(symbol: any): number {
    // Simple complexity estimation based on AST properties
    let complexity = 1;
    
    if (symbol.async) complexity += 1;
    if (symbol.params && symbol.params.length > 3) complexity += 1;
    if (symbol.end - symbol.line > 50) complexity += 2;
    
    return complexity;
  }

  private generateSuggestions(analysis: any, goal: string): string[] {
    const suggestions: string[] = [];

    if (analysis.issues.length > 0) {
      const highComplexity = analysis.issues.filter((i: any) => i.complexity > 10);
      if (highComplexity.length > 0) {
        suggestions.push(`Refactor ${highComplexity.length} high-complexity functions`);
      }
    }

    if (analysis.files.length > 50) {
      suggestions.push('Consider modularization - project has many files');
    }

    if (goal.includes('performance')) {
      suggestions.push('Add caching for frequently accessed data');
      suggestions.push('Optimize database queries');
      suggestions.push('Use lazy loading for heavy modules');
    }

    if (goal.includes('security')) {
      suggestions.push('Review dependencies for vulnerabilities');
      suggestions.push('Add input validation');
      suggestions.push('Implement rate limiting');
    }

    return suggestions;
  }

  private formatAIAnalysis(analysis: any, plan: any[], options: any): string {
    const fmt = options.fmt || 'slim';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`goal: ${analysis.goal}`);
      lines.push(`files: ${analysis.files.length}`);
      
      if (analysis.issues.length > 0) {
        lines.push(`issues: ${analysis.issues.length}`);
        analysis.issues.slice(0, 5).forEach((issue: any) => {
          lines.push(`  ${issue.file}:${issue.line}  complexity:${issue.complexity}`);
        });
      }

      if (plan.length > 0) {
        lines.push(`plan:`);
        plan.slice(0, 5).forEach((p: any, i: number) => {
          lines.push(`  ${i + 1}. ${p.action}  priority:${p.priority}`);
        });
      }

      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'ai',
        ...analysis,
        plan,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`goal: ${analysis.goal}`);
      lines.push(`files analyzed: ${analysis.files.length}`);
      lines.push('===');

      if (analysis.issues.length > 0) {
        lines.push(`issues found: ${analysis.issues.length}`);
        analysis.issues.slice(0, 5).forEach((issue: any) => {
          lines.push(`  ${issue.file}:${issue.line}  complexity:${issue.complexity}`);
        });
      }

      if (plan.length > 0) {
        lines.push('');
        lines.push('suggested actions:');
        plan.slice(0, 5).forEach((p: any, i: number) => {
          lines.push(`  ${i + 1}. ${p.action} (${p.priority})`);
          lines.push(`     ${p.reason}`);
        });
      }

      return lines.join('\n');
    }
  }

  private formatSuggestions(suggestions: string[], fileCount: number, options: any): string {
    const fmt = options.fmt || 'slim';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`files: ${fileCount}`);
      lines.push(`suggestions: ${suggestions.length}`);
      suggestions.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'ai',
        suggestions,
        totalFiles: fileCount,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`files: ${fileCount}`);
      lines.push('===');
      lines.push('suggestions:');
      suggestions.forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`);
      });
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
      } else if (arg === '--goal') {
        options.goal = args[++i];
      } else if (!options.goal) {
        options.goal = arg;
      }
    }

    return options;
  }
}
