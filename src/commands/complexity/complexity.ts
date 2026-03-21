import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface ComplexityMetric {
  file: string;
  cyclomatic: number;
  cognitive: number;
  lines: number;
  functions: number;
}

export class ComplexityCommand extends Command {
  public getDescription(): string {
    return 'Code complexity analysis';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('complexity', args, async () => {
      let action = options.action || 'hotspot';
      let targetPath = options.path || options.filePath || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const stats = fs.statSync(targetPath);
      
      if (stats.isDirectory()) {
        if (action === 'file') {
          action = 'hotspot';
        }
      } else if (stats.isFile()) {
        if (action === 'hotspot' || action === 'debt') {
          action = 'file';
          options.filePath = targetPath;
        }
      }

      switch (action) {
        case 'hotspot':
          return this.findComplexHotspots(targetPath, options);
        case 'file':
          if (!options.filePath) {
            throw createError('ENOENT', '', 'File path required for file analysis');
          }
          return this.analyzeComplexity(options.filePath, options);
        case 'debt':
          return this.calculateDebt(targetPath, options);
        default:
          return this.findComplexHotspots(targetPath, options);
      }
    });
  }

  private async findComplexHotspots(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*.{ts,js,tsx,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const metrics: ComplexityMetric[] = [];

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const metric = await this.calculateComplexity(filePath);
      metrics.push(metric);
    }

    // Sort by cyclomatic complexity
    metrics.sort((a, b) => b.cyclomatic - a.cyclomatic);

    const topComplex = metrics.slice(0, options.top || 20);

    return {
      ok: true,
      command: 'complexity',
      action: 'hotspot',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(topComplex)),
      content: this.formatComplexHotspots(topComplex, options),
      metrics: topComplex,
      totalFiles: files.length,
    };
  }

  private async analyzeComplexity(filePath: string, options: any): Promise<CommandResult> {
    if (!fs.existsSync(filePath)) {
      throw createError('ENOENT', filePath);
    }

    const metric = await this.calculateComplexity(filePath);
    const details = await this.getComplexityDetails(filePath);

    return {
      ok: true,
      command: 'complexity',
      action: 'file',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify({ metric, details })),
      content: this.formatComplexityAnalysis(metric, details, options),
      metric,
      details,
    };
  }

  private async calculateDebt(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*.{ts,js,tsx,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    let totalComplexity = 0;
    let totalLines = 0;
    let totalFunctions = 0;
    const complexFiles: ComplexityMetric[] = [];

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const metric = await this.calculateComplexity(filePath);
      totalComplexity += metric.cyclomatic;
      totalLines += metric.lines;
      totalFunctions += metric.functions;

      if (metric.cyclomatic > 15) {
        complexFiles.push(metric);
      }
    }

    const avgComplexity = totalFunctions > 0 ? totalComplexity / totalFunctions : 0;
    const debt = this.calculateTechDebt(totalComplexity, totalLines, complexFiles.length);

    return {
      ok: true,
      command: 'complexity',
      action: 'debt',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify({ avgComplexity, debt, complexFiles })),
      content: this.formatDebtReport(avgComplexity, debt, complexFiles, options),
      summary: {
        avgComplexity,
        totalComplexity,
        totalLines,
        totalFunctions,
        complexFiles: complexFiles.length,
        debt,
      },
    };
  }

  private async calculateComplexity(filePath: string): Promise<ComplexityMetric> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const cyclomatic = this.calculateCyclomaticComplexity(content);
    const cognitive = this.calculateCognitiveComplexity(content);
    const functions = this.countFunctions(content);

    return {
      file: filePath,
      cyclomatic,
      cognitive,
      lines: lines.length,
      functions,
    };
  }

  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    const decisionKeywords = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\?/g,
      /\&\&/g,
      /\|\|/g,
    ];

    for (const keyword of decisionKeywords) {
      const matches = content.match(keyword);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private calculateCognitiveComplexity(content: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Increase nesting
      if (/\b(if|for|while|catch|case)\b/.test(trimmed)) {
        nestingLevel++;
        complexity += nestingLevel;
      }

      // Decrease nesting
      if (/^\s*}/.test(trimmed)) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }

      // Ternary operator
      if (/\?/.test(trimmed) && !/\?./.test(trimmed)) {
        complexity += nestingLevel + 1;
      }

      // Logical operators
      const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
      complexity += logicalOps * (nestingLevel + 1);
    }

    return complexity;
  }

  private countFunctions(content: string): number {
    const patterns = [
      /function\s+\w+/g,
      /\w+\s*:\s*\([^)]*\)\s*=>/g,
      /=>\s*{/g,
      /class\s+\w+/g,
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return Math.max(1, count);
  }

  private async getComplexityDetails(filePath: string): Promise<any> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const functions: Array<{ name: string; line: number; complexity: number }> = [];
    let currentFunction: { name: string; line: number; complexity: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const functionMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s+)?\(?|{)/);

      if (functionMatch) {
        if (currentFunction) {
          functions.push(currentFunction);
        }
        const funcComplexity = this.calculateCyclomaticComplexity(
          lines.slice(i, Math.min(i + 50, lines.length)).join('\n')
        );
        currentFunction = {
          name: functionMatch[1],
          line: i + 1,
          complexity: funcComplexity,
        };
      }
    }

    if (currentFunction) {
      functions.push(currentFunction);
    }

    return {
      path: filePath,
      lines: lines.length,
      functions: functions.sort((a, b) => b.complexity - a.complexity).slice(0, 10),
      maxNesting: this.calculateMaxNesting(content),
      avgFunctionLength: this.calculateAvgFunctionLength(content),
    };
  }

  private calculateMaxNesting(content: string): number {
    const lines = content.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
    }

    return maxNesting;
  }

  private calculateAvgFunctionLength(content: string): number {
    const functions = content.split(/function\s+\w+|\w+\s*:\s*\([^)]*\)\s*=>/);
    if (functions.length <= 1) return 0;

    const lengths = functions.map(f => f.split('\n').length).filter(l => l > 0);
    return lengths.reduce((a, b) => a + b, 0) / lengths.length;
  }

  private calculateTechDebt(totalComplexity: number, totalLines: number, complexFiles: number): string {
    const avgComplexity = totalComplexity / Math.max(1, totalLines / 50); // Rough estimate
    const complexityRatio = complexFiles / Math.max(1, totalLines / 500);

    let debtMinutes = 0;

    // High complexity files
    debtMinutes += complexFiles * 30; // 30 min per complex file

    // Overall complexity
    if (avgComplexity > 15) {
      debtMinutes += (avgComplexity - 15) * 10;
    }

    // Convert to hours/days
    const debtHours = debtMinutes / 60;
    const debtDays = debtHours / 8;

    if (debtDays > 1) {
      return `${debtDays.toFixed(1)} days`;
    } else if (debtHours > 1) {
      return `${debtHours.toFixed(1)} hours`;
    } else {
      return `${debtMinutes.toFixed(0)} minutes`;
    }
  }

  private formatComplexHotspots(metrics: ComplexityMetric[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = ['ok true'];
      metrics.forEach(m => {
        lines.push(`${m.cyclomatic} ${m.file}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'complexity',
        action: 'hotspot',
        metrics,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: hotspot', '---'];

      metrics.forEach(m => {
        lines.push(`File: ${m.file}`);
        lines.push(`  Cyclomatic: ${m.cyclomatic}`);
        lines.push(`  Cognitive: ${m.cognitive}`);
        lines.push(`  Lines: ${m.lines}`);
        lines.push(`  Functions: ${m.functions}`);
        lines.push('---');
      });

      return lines.join('\n');
    }
  }

  private formatComplexityAnalysis(metric: ComplexityMetric, details: any, options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\n${metric.cyclomatic} ${metric.file}\n${metric.lines} lines\n${metric.functions} functions`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'complexity',
        action: 'file',
        metric,
        details,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: file', '---'];
      lines.push(`File: ${metric.file}`);
      lines.push(`Cyclomatic Complexity: ${metric.cyclomatic}`);
      lines.push(`Cognitive Complexity: ${metric.cognitive}`);
      lines.push(`Lines: ${metric.lines}`);
      lines.push(`Functions: ${metric.functions}`);
      lines.push('---');
      lines.push('Top Functions:');
      details.functions.forEach((f: any) => {
        lines.push(`  ${f.name}:${f.line} - ${f.complexity}`);
      });

      return lines.join('\n');
    }
  }

  private formatDebtReport(avgComplexity: number, debt: string, complexFiles: ComplexityMetric[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = ['ok true'];
      lines.push(`avg complexity: ${avgComplexity.toFixed(1)}`);
      lines.push(`tech debt: ${debt}`);
      lines.push(`complex files: ${complexFiles.length}`);
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'complexity',
        action: 'debt',
        avgComplexity,
        debt,
        complexFiles,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: debt', '---'];
      lines.push(`Average Complexity: ${avgComplexity.toFixed(1)}`);
      lines.push(`Estimated Technical Debt: ${debt}`);
      lines.push(`Complex Files: ${complexFiles.length}`);
      lines.push('---');

      if (complexFiles.length > 0) {
        lines.push('Top Complex Files:');
        complexFiles.slice(0, 10).forEach(f => {
          lines.push(`  ${f.file} - ${f.cyclomatic}`);
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
      } else if (arg === 'hotspot' || arg === 'file' || arg === 'debt') {
        options.action = arg;
      } else if (arg === '--path' && args[i + 1]) {
        options.path = args[++i];
      } else if (arg === '--top' && args[i + 1]) {
        options.top = parseInt(args[++i], 10);
      } else if (!arg.startsWith('--') && !options.filePath) {
        options.filePath = arg;
      }
    }

    return options;
  }
}
