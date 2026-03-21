import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface UnusedImport {
  file: string;
  line: number;
  importName: string;
  type: 'default' | 'named' | 'namespace';
}

interface UnusedExport {
  file: string;
  exportName: string;
  type: 'function' | 'class' | 'variable' | 'type';
}

export class UnusedCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('unused', args, async () => {
      const targetPath = options.path || process.cwd();
      
      if (!FileUtils.fileExists(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      return this.findUnused(targetPath, options);
    });
  }

  private async findUnused(targetPath: string, options: any): Promise<CommandResult> {
    const checkType = options.check || 'both';
    const extension = options.ext || 'ts,tsx,js,jsx';

    const patterns = extension.split(',').map((ext: string) => `**/*.${ext.trim()}`);

    const files = await fg.glob(patterns, {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.adt/**',
        '**/*.d.ts',
      ],
    });

    const unusedImports: UnusedImport[] = [];
    const unusedExports: UnusedExport[] = [];

    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      
      try {
        const content = FileUtils.readFile(fullPath);
        
        if (checkType === 'imports' || checkType === 'both') {
          const fileUnusedImports = await this.findUnusedImports(fullPath, content, file);
          unusedImports.push(...fileUnusedImports);
        }
        
        if (checkType === 'exports' || checkType === 'both') {
          const fileUnusedExports = await this.findUnusedExports(
            fullPath, 
            content, 
            file, 
            files,
            targetPath
          );
          unusedExports.push(...fileUnusedExports);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    const output = this.formatUnusedResults(unusedImports, unusedExports, checkType, options);

    return {
      ok: true,
      command: 'unused',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      unusedImports,
      unusedExports,
      totalUnusedImports: unusedImports.length,
      totalUnusedExports: unusedExports.length,
      checkType,
    };
  }

  private async findUnusedImports(
    fullPath: string, 
    content: string, 
    filePath: string
  ): Promise<UnusedImport[]> {
    const unused: UnusedImport[] = [];
    const lines = content.split('\n');

    const { ASTParser } = await import('../../parsers/typescript');
    const parser = new ASTParser(content);

    if (!parser.isValid()) {
      return unused;
    }

    const imports = parser.extractImports();
    const symbols = parser.extractSymbols();

    for (const imp of imports) {
      const isUsed = this.isImportUsed(imp, symbols);
      
      if (!isUsed) {
        const importLine = this.findImportLine(imp, lines);
        unused.push({
          file: filePath,
          line: importLine,
          importName: imp.source || 'unknown',
          type: this.getImportType(imp),
        });
      }
    }

    return unused;
  }

  private isImportUsed(imp: any, symbols: any[]): boolean {
    const importName = imp.name;
    const importedNames = this.extractImportedNames(imp);

    for (const symbol of symbols) {
      if (importedNames.includes(symbol.name)) {
        return true;
      }
    }

    return false;
  }

  private extractImportedNames(imp: any): string[] {
    const names: string[] = [];

    if (imp.specifiers) {
      for (const spec of imp.specifiers) {
        if (spec.type === 'ImportDefaultSpecifier') {
          names.push(spec.local || spec.name || '');
        } else if (spec.type === 'ImportSpecifier') {
          names.push(spec.local || spec.name || '');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          names.push(spec.local || spec.name || '');
        }
      }
    }

    return names;
  }

  private getImportType(imp: any): 'default' | 'named' | 'namespace' {
    if (!imp.specifiers || imp.specifiers.length === 0) {
      return 'named';
    }

    for (const spec of imp.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier') {
        return 'namespace';
      }
      if (spec.type === 'ImportDefaultSpecifier') {
        return 'default';
      }
    }

    return 'named';
  }

  private findImportLine(imp: any, lines: string[]): number {
    const importStatement = this.buildImportStatement(imp);
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(importStatement) || 
          lines[i].includes('import') && 
          lines[i].includes(imp.source?.value)) {
        return i + 1;
      }
    }

    return 0;
  }

  private buildImportStatement(imp: any): string {
    if (imp.source && imp.source.value) {
      return imp.source.value;
    }
    return '';
  }

  private async findUnusedExports(
    fullPath: string,
    content: string,
    filePath: string,
    allFiles: string[],
    targetPath: string
  ): Promise<UnusedExport[]> {
    const unused: UnusedExport[] = [];

    const { ASTParser } = await import('../../parsers/typescript');
    const parser = new ASTParser(content);

    if (!parser.isValid()) {
      return unused;
    }

    const exports = parser.extractExports();
    const exportedSymbols = this.getExportedSymbols(exports);

    for (const symbol of exportedSymbols) {
      const isUsed = await this.isExportUsed(
        symbol.name,
        filePath,
        allFiles,
        targetPath
      );

      if (!isUsed && !symbol.name.startsWith('_')) {
        unused.push({
          file: filePath,
          exportName: symbol.name,
          type: this.getExportType(symbol),
        });
      }
    }

    return unused;
  }

  private getExportedSymbols(exports: any[]): any[] {
    const symbols: any[] = [];

    for (const exp of exports) {
      if (exp.specifiers) {
        for (const spec of exp.specifiers) {
          if (spec.exported) {
            symbols.push({
              name: spec.exported.name,
              type: 'variable',
            });
          }
          if (spec.local) {
            symbols.push({
              name: spec.local.name,
              type: 'variable',
            });
          }
        }
      }
    }

    return symbols;
  }

  private getExportType(symbol: any): 'function' | 'class' | 'variable' | 'type' {
    return symbol.type || 'variable';
  }

  private async isExportUsed(
    exportName: string,
    currentFile: string,
    allFiles: string[],
    targetPath: string
  ): Promise<boolean> {
    for (const file of allFiles) {
      if (file === currentFile) continue;

      const fullPath = path.join(targetPath, file);
      
      try {
        const content = FileUtils.readFile(fullPath);
        
        if (this.contentReferencesExport(content, exportName)) {
          return true;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return false;
  }

  private contentReferencesExport(content: string, exportName: string): boolean {
    const importRegex = new RegExp(`import.*\\b${exportName}\\b.*from`, 'g');
    const requireRegex = new RegExp(`require\\(.*['"].*${exportName}['"]`, 'g');
    const usageRegex = new RegExp(`\\b${exportName}\\b`, 'g');

    const hasImport = importRegex.test(content) || requireRegex.test(content);
    const hasUsage = usageRegex.test(content);

    return hasImport && hasUsage;
  }

  private formatUnusedResults(
    unusedImports: UnusedImport[],
    unusedExports: UnusedExport[],
    checkType: string,
    options: any
  ): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      
      if (checkType === 'imports' || checkType === 'both') {
        lines.push(`unused imports: ${unusedImports.length}`);
        for (const imp of unusedImports.slice(0, 50)) {
          lines.push(`${imp.file}:${imp.line}  ${imp.importName}`);
        }
      }
      
      if (checkType === 'exports' || checkType === 'both') {
        lines.push(`unused exports: ${unusedExports.length}`);
        for (const exp of unusedExports.slice(0, 50)) {
          lines.push(`${exp.file}  ${exp.exportName}`);
        }
      }
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        unusedImports,
        unusedExports,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`command: unused`);
      lines.push(`===`);

      if (checkType === 'imports' || checkType === 'both') {
        lines.push(`Unused Imports (${unusedImports.length}):`);
        for (const imp of unusedImports.slice(0, 50)) {
          lines.push(`  ${imp.file}:${imp.line}  ${imp.type}  ${imp.importName}`);
        }
      }

      if (checkType === 'exports' || checkType === 'both') {
        lines.push(``);
        lines.push(`Unused Exports (${unusedExports.length}):`);
        for (const exp of unusedExports.slice(0, 50)) {
          lines.push(`  ${exp.file}  ${exp.type}  ${exp.exportName}`);
        }
      }

      if (unusedImports.length === 0 && unusedExports.length === 0) {
        lines.push(`No unused imports or exports found`);
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
      } else if (arg === '--check') {
        options.check = args[++i];
      } else if (arg === '--ext') {
        options.ext = args[++i];
      } else if (arg === '--limit') {
        options.limit = parseInt(args[++i], 10);
      } else if (!arg.startsWith('-')) {
        options.path = arg;
      }
    }

    return options;
  }
}
