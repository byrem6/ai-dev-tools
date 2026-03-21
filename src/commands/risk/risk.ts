import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface RiskHotspot {
  file: string;
  risk: number;
  factors: string[];
  lines: number;
}

export class RiskCommand extends Command {
  public getDescription(): string {
    return 'Code risk analysis';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('risk', args, async () => {
      const action = options.action || 'hotspot';
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      switch (action) {
        case 'hotspot':
          return this.findHotspots(targetPath, options);
        case 'file':
          if (!options.filePath) {
            throw createError('ENOENT', '', 'File path required for file analysis');
          }
          return this.analyzeFile(options.filePath, options);
        default:
          return this.findHotspots(targetPath, options);
      }
    });
  }

  private async findHotspots(targetPath: string, options: any): Promise<CommandResult> {
    const files = await fg.glob('**/*.{ts,js,tsx,jsx}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const hotspots: RiskHotspot[] = [];

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const risk = await this.calculateFileRisk(filePath);
      if (risk.risk > 0) {
        hotspots.push(risk);
      }
    }

    // Sort by risk score
    hotspots.sort((a, b) => b.risk - a.risk);

    const topHotspots = hotspots.slice(0, options.top || 20);

    return {
      ok: true,
      command: 'risk',
      action: 'hotspot',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(topHotspots)),
      content: this.formatHotspots(topHotspots, options),
      hotspots: topHotspots,
      totalFiles: files.length,
      riskyFiles: hotspots.length,
    };
  }

  private async analyzeFile(filePath: string, options: any): Promise<CommandResult> {
    if (!fs.existsSync(filePath)) {
      throw createError('ENOENT', filePath);
    }

    const risk = await this.calculateFileRisk(filePath);
    const details = await this.getFileDetails(filePath);

    return {
      ok: true,
      command: 'risk',
      action: 'file',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify({ risk, details })),
      content: this.formatFileRisk(risk, details, options),
      risk,
      details,
    };
  }

  private async calculateFileRisk(filePath: string): Promise<RiskHotspot> {
    const factors: string[] = [];
    let risk = 0;

    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const stats = FileUtils.getFileInfo(filePath);

    // Large file
    if (stats.totalLines > 500) {
      risk += 20;
      factors.push(`Large file (${stats.totalLines} lines)`);
    } else if (stats.totalLines > 300) {
      risk += 10;
      factors.push(`Moderate size (${stats.totalLines} lines)`);
    }

    // TODO comments
    const todoCount = (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
    if (todoCount > 5) {
      risk += 15;
      factors.push(`${todoCount} TODO/FIXME comments`);
    } else if (todoCount > 0) {
      risk += 5;
      factors.push(`${todoCount} TODO/FIXME comments`);
    }

    // Console.log statements
    const consoleCount = (content.match(/console\.log/g) || []).length;
    if (consoleCount > 10) {
      risk += 10;
      factors.push(`${consoleCount} console.log statements`);
    }

    // Any types
    const anyCount = (content.match(/:\s*any/g) || []).length;
    if (anyCount > 10) {
      risk += 15;
      factors.push(`${anyCount} 'any' type usages`);
    } else if (anyCount > 5) {
      risk += 8;
      factors.push(`${anyCount} 'any' type usages`);
    }

    // Nested callbacks
    const maxDepth = this.calculateNestingDepth(content);
    if (maxDepth > 5) {
      risk += 15;
      factors.push(`Deep nesting (${maxDepth} levels)`);
    } else if (maxDepth > 3) {
      risk += 8;
      factors.push(`Moderate nesting (${maxDepth} levels)`);
    }

    // Long lines
    const longLines = lines.filter(line => line.length > 120).length;
    if (longLines > stats.totalLines * 0.1) {
      risk += 10;
      factors.push(`${longLines} long lines (>120 chars)`);
    }

    // Function complexity
    const avgComplexity = this.calculateAvgComplexity(content);
    if (avgComplexity > 15) {
      risk += 20;
      factors.push(`High complexity (avg: ${avgComplexity.toFixed(1)})`);
    } else if (avgComplexity > 10) {
      risk += 10;
      factors.push(`Moderate complexity (avg: ${avgComplexity.toFixed(1)})`);
    }

    return {
      file: filePath,
      risk: Math.min(risk, 100),
      factors,
      lines: stats.totalLines,
    };
  }

  private async getFileDetails(filePath: string): Promise<any> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    return {
      path: filePath,
      lines: lines.length,
      size: Buffer.byteLength(content, 'utf8'),
      functions: (content.match(/function\s+\w+|=>\s*{|\w+\s*:\s*\([^)]*\)\s*=>/g) || []).length,
      imports: (content.match(/^import\s+/gm) || []).length,
      exports: (content.match(/export\s+/g) || []).length,
    };
  }

  private calculateNestingDepth(content: string): number {
    const lines = content.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      currentDepth += openBraces - closeBraces;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  private calculateAvgComplexity(content: string): number {
    const functions = content.match(/function\s+\w+|=>\s*{|\w+\s*:\s*\([^)]*\)\s*=>/g) || [];
    if (functions.length === 0) return 0;

    // Simplified complexity calculation
    const lines = content.split('\n');
    let complexity = 0;

    for (const line of lines) {
      complexity += (line.match(/if|for|while|case|catch|\?|&&|\|\|/g) || []).length;
    }

    return complexity / functions.length;
  }

  private formatHotspots(hotspots: RiskHotspot[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = ['ok true'];
      hotspots.forEach(h => {
        lines.push(`${h.risk}% ${h.file} (${h.lines} lines)`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'risk',
        action: 'hotspot',
        hotspots,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: hotspot', '---'];
      
      if (hotspots.length === 0) {
        lines.push('No risk hotspots found!');
        return lines.join('\n');
      }

      hotspots.forEach(h => {
        lines.push(`Risk: ${h.risk}%`);
        lines.push(`File: ${h.file}`);
        lines.push(`Lines: ${h.lines}`);
        lines.push('Factors:');
        h.factors.forEach(f => lines.push(`  - ${f}`));
        lines.push('---');
      });

      return lines.join('\n');
    }
  }

  private formatFileRisk(risk: RiskHotspot, details: any, options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\n${risk.risk}% ${risk.file}\n${risk.lines} lines\n${risk.factors.length} factors`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'risk',
        action: 'file',
        risk,
        details,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: file', '---'];
      lines.push(`File: ${risk.file}`);
      lines.push(`Risk Score: ${risk.risk}%`);
      lines.push(`Lines: ${risk.lines}`);
      lines.push('Risk Factors:');
      risk.factors.forEach(f => lines.push(`  - ${f}`));
      lines.push('---');
      lines.push('Details:');
      lines.push(`  Functions: ${details.functions}`);
      lines.push(`  Imports: ${details.imports}`);
      lines.push(`  Exports: ${details.exports}`);
      lines.push(`  Size: ${details.size} bytes`);

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      } else if (arg === 'hotspot' || arg === 'file') {
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
