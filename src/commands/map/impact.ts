import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface ImpactNode {
  file: string;
  symbol?: string;
  type: 'file' | 'symbol';
  line?: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ImpactAnalysis {
  target: string;
  symbol?: string;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  directDependents: ImpactNode[];
  indirectDependents: ImpactNode[];
  testFiles: string[];
  summary: string;
}

export class ImpactCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('impact', args, async () => {
      if (!options.target) {
        throw createError('ENOMATCH', '', 'Usage: adt impact <file|symbol> [options]');
      }

      const searchPath = options.path || process.cwd();
      return this.analyzeImpact(options.target, searchPath, options);
    });
  }

  private async analyzeImpact(target: string, searchPath: string, options: any): Promise<CommandResult> {
    if (!FileUtils.fileExists(searchPath)) {
      throw createError('ENOENT', searchPath);
    }

    const targetPath = path.resolve(searchPath, target);
    const isFile = FileUtils.fileExists(targetPath);
    const isSymbol = options.symbol || !isFile;

    let analysis: ImpactAnalysis;

    if (isSymbol) {
      analysis = await this.analyzeSymbolImpact(target, searchPath, options);
    } else {
      analysis = await this.analyzeFileImpact(targetPath, searchPath, options);
    }

    const output = this.formatImpact(analysis, options);

    return {
      ok: true,
      command: 'impact',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      analysis,
    };
  }

  private async analyzeSymbolImpact(symbolName: string, searchPath: string, options: any): Promise<ImpactAnalysis> {
    const depth = options.depth || 2;
    const directDependents: ImpactNode[] = [];
    const indirectDependents: ImpactNode[] = [];
    const testFiles: string[] = [];

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const symbolLower = symbolName.toLowerCase();

    for (const file of files.slice(0, 100)) {
      try {
        const content = FileUtils.readFile(file);
        const relativePath = path.relative(searchPath, file);
        const isTestFile = /test|spec/.test(relativePath);

        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const symbols = parser.extractSymbols();
          const symbolDef = symbols.find(s => s.name.toLowerCase() === symbolLower);

          if (symbolDef) {
            if (isTestFile) {
              testFiles.push(relativePath);
            }
          }

          const lines = content.split('\n');
          const usages: number[] = [];

          lines.forEach((line, index) => {
            if (line.match(new RegExp(`\\b${symbolName}\\b`))) {
              usages.push(index + 1);
            }
          });

          if (usages.length > 0) {
            const node: ImpactNode = {
              file: relativePath,
              symbol: symbolName,
              type: 'symbol',
              risk: this.calculateRisk(usages.length, isTestFile),
            };

            if (usages.length > 0 && usages.length <= 5) {
              directDependents.push(node);
            } else if (usages.length > 5) {
              indirectDependents.push(node);
            }
          }
        }
      } catch {
        // Skip files that can't be analyzed
      }
    }

    const risk = this.calculateOverallRisk(directDependents.length, indirectDependents.length, testFiles.length);

    return {
      target: symbolName,
      symbol: symbolName,
      risk,
      directDependents,
      indirectDependents,
      testFiles,
      summary: this.generateSummary(risk, directDependents.length, indirectDependents.length, testFiles.length),
    };
  }

  private async analyzeFileImpact(filePath: string, searchPath: string, options: any): Promise<ImpactAnalysis> {
    const depth = options.depth || 2;
    const directDependents: ImpactNode[] = [];
    const indirectDependents: ImpactNode[] = [];
    const testFiles: string[] = [];

    const targetName = path.basename(filePath, path.extname(filePath));
    const targetDir = path.dirname(filePath);

    const files = await fg.glob('**/*.{ts,tsx,js,jsx}', {
      cwd: searchPath,
      onlyFiles: true,
      absolute: true,
      ignore: this.configManager.getExcludeGlobs(),
    });

    for (const file of files.slice(0, 100)) {
      if (file === filePath) continue;

      try {
        const content = FileUtils.readFile(file);
        const relativePath = path.relative(searchPath, file);
        const isTestFile = /test|spec/.test(relativePath);

        const { ASTParser } = await import('../../parsers/typescript');
        const parser = new ASTParser(content);

        if (parser.isValid()) {
          const imports = parser.extractImports();
          const importsTarget = imports.some((imp: any) => {
            const importBasename = path.basename(imp.source, path.extname(imp.source));
            return importBasename === targetName || imp.resolvedPath === filePath;
          });

          if (importsTarget) {
            const node: ImpactNode = {
              file: relativePath,
              type: 'file',
              risk: this.calculateRisk(1, isTestFile),
            };

            if (isTestFile) {
              testFiles.push(relativePath);
            } else {
              directDependents.push(node);
            }
          }
        }
      } catch {
        // Skip files that can't be analyzed
      }
    }

    const risk = this.calculateOverallRisk(directDependents.length, indirectDependents.length, testFiles.length);

    return {
      target: path.relative(searchPath, filePath),
      risk,
      directDependents,
      indirectDependents,
      testFiles,
      summary: this.generateSummary(risk, directDependents.length, indirectDependents.length, testFiles.length),
    };
  }

  private calculateRisk(usageCount: number, isTestFile: boolean): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (isTestFile) return 'LOW';
    if (usageCount > 10) return 'HIGH';
    if (usageCount > 3) return 'MEDIUM';
    return 'LOW';
  }

  private calculateOverallRisk(direct: number, indirect: number, tests: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    const totalDeps = direct + indirect;
    const testCoverage = tests / (totalDeps || 1);

    if (totalDeps > 20 && testCoverage < 0.3) return 'HIGH';
    if (totalDeps > 10) return 'MEDIUM';
    return 'LOW';
  }

  private generateSummary(risk: string, direct: number, indirect: number, tests: number): string {
    const parts: string[] = [];
    parts.push(`risk: ${risk}`);
    if (direct > 0) parts.push(`${direct} direct dependents`);
    if (indirect > 0) parts.push(`${indirect} indirect`);
    if (tests > 0) parts.push(`${tests} test files`);
    return parts.join('  ');
  }

  private formatImpact(analysis: ImpactAnalysis, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`target: ${analysis.target}  risk: ${analysis.risk}`);
      
      if (analysis.symbol) {
        lines.push(`direct: ${analysis.directDependents.map(d => d.file).slice(0, 3).join(', ')}`);
      } else {
        lines.push(`direct: ${analysis.directDependents.map(d => d.file).slice(0, 3).join(', ')}`);
      }
      
      if (analysis.indirectDependents.length > 0) {
        lines.push(`indirect: ${analysis.indirectDependents.slice(0, 3).map(d => d.file).join(', ')}`);
      }
      
      if (analysis.testFiles.length > 0) {
        lines.push(`tests: ${analysis.testFiles.length} files`);
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'impact',
        ...analysis,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`target: ${analysis.target}${analysis.symbol ? ` → symbol: ${analysis.symbol}` : ''}`);
      lines.push(`risk: ${analysis.risk}  (${analysis.summary})`);
      lines.push('===');

      if (analysis.directDependents.length > 0) {
        lines.push(`direct-dependents (${analysis.directDependents.length}):`);
        analysis.directDependents.slice(0, 10).forEach(dep => {
          const riskMarker = dep.risk === 'HIGH' ? ' [HIGH]' : dep.risk === 'MEDIUM' ? ' [MEDIUM]' : '';
          lines.push(`  ${dep.file}${riskMarker}`);
        });
        if (analysis.directDependents.length > 10) {
          lines.push(`  ... ${analysis.directDependents.length - 10} more`);
        }
      }

      if (analysis.indirectDependents.length > 0) {
        lines.push('');
        lines.push(`indirect-dependents (${analysis.indirectDependents.length}):`);
        analysis.indirectDependents.slice(0, 10).forEach(dep => {
          lines.push(`  ${dep.file}`);
        });
        if (analysis.indirectDependents.length > 10) {
          lines.push(`  ... ${analysis.indirectDependents.length - 10} more`);
        }
      }

      if (analysis.testFiles.length > 0) {
        lines.push('');
        lines.push(`test-coverage (${analysis.testFiles.length}):`);
        analysis.testFiles.slice(0, 5).forEach(test => {
          lines.push(`  ${test}`);
        });
        if (analysis.testFiles.length > 5) {
          lines.push(`  ... ${analysis.testFiles.length - 5} more`);
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
      } else if (arg === '--symbol') {
        options.symbol = args[++i];
      } else if (arg === '--path') {
        options.path = args[++i];
      } else if (arg === '--depth') {
        options.depth = parseInt(args[++i], 10);
      } else if (!options.target) {
        options.target = arg;
      }
    }

    return options;
  }
}
