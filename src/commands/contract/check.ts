import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface MissingMethod {
  methodName: string;
  interface: string;
  interfaceFile: string;
  interfaceLine: number;
}

export class ContractCheckCommand extends Command {
  public getDescription(): string {
    return 'Check interface implementation';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt contract-check <className> [path]',
      description: 'Check if a class implements all interface methods',
      examples: [
        'adt contract-check UserService src/',
        'adt contract-check PaymentController --fmt slim',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('contract check', args, async () => {
      if (!options.className) {
        throw createError('ENOENT', 'Class name is required');
      }

      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const missing = await this.checkContract(options.className, targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(options.className, missing);
      }

      return this.formatNormal(options.className, missing);
    });
  }

  private async checkContract(className: string, targetPath: string): Promise<MissingMethod[]> {
    const missing: MissingMethod[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    // Find interface definition
    let interfaceFile = '';
    let interfaceMethods: string[] = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match interface definition
        const interfaceMatch = line.match(/export\s+interface\s+(I\w+)\s*{/);
        if (interfaceMatch && interfaceMatch[1].toLowerCase().includes(className.toLowerCase())) {
          interfaceFile = file;
          // Extract methods from interface
          interfaceMethods = this.extractMethodsFromInterface(lines, i);
          break;
        }
      }

      if (interfaceMethods.length > 0) break;
    }

    if (interfaceMethods.length === 0) {
      return missing;
    }

    // Find class implementation
    let classMethods: string[] = [];
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const classMatch = line.match(/export\s+class\s+(\w+)\s+implements\s+(\w+)/);
        if (classMatch && classMatch[1] === className) {
          classMethods = this.extractMethodsFromClass(lines, i);
          break;
        }
      }

      if (classMethods.length > 0) break;
    }

    // Find missing methods
    for (const method of interfaceMethods) {
      if (!classMethods.includes(method)) {
        missing.push({
          methodName: method,
          interface: interfaceFile,
          interfaceFile,
          interfaceLine: 0,
        });
      }
    }

    return missing;
  }

  private extractMethodsFromInterface(lines: string[], startLine: number): string[] {
    const methods: string[] = [];
    const braceRegex = /^\s*(\w+)\s*\(/;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '}') break;

      const match = line.match(braceRegex);
      if (match) {
        methods.push(match[1]);
      }
    }

    return methods;
  }

  private extractMethodsFromClass(lines: string[], startLine: number): string[] {
    const methods: string[] = [];
    const braceRegex = /^\s*(\w+)\s*\(/;

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '}') break;

      const match = line.match(braceRegex);
      if (match && !line.includes('private')) {
        methods.push(match[1]);
      }
    }

    return methods;
  }

  private formatSlim(className: string, missing: MissingMethod[]): CommandResult {
    if (missing.length === 0) {
      const output = `ok true   ${className}  implements interface  all methods present`;
      return {
        ok: true,
        command: 'contract',
        action: 'check',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        className,
        missing,
      };
    }

    const lines = missing.map(m =>
      `MISSING: ${m.methodName}  (:${m.interfaceFile})`
    );

    const output = [
      `ok false  ${className}  ${missing.length} methods missing`,
      ...lines
    ].join('\n');

    return {
      ok: false,
      command: 'contract',
      action: 'check',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      className,
      missing,
    };
  }

  private formatNormal(className: string, missing: MissingMethod[]): CommandResult {
    const sections: string[] = [];

    if (missing.length === 0) {
      const output = `ok: true\n${className}  implements interface  all methods present`;
      return {
        ok: true,
        command: 'contract',
        action: 'check',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        className,
        missing,
      };
    }

    sections.push(`ok: false`);
    sections.push(`class: ${className}`);
    sections.push(`missing: ${missing.length} methods`);
    sections.push(`===`);

    for (const m of missing) {
      sections.push(`✗  ${m.methodName}  ${m.interfaceFile}`);
    }

    const output = sections.join('\n');

    return {
      ok: false,
      command: 'contract',
      action: 'check',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      className,
      missing,
    };
  }

  private parseArgs(args: string[]): { className?: string; path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.className = arg;
      }
    }

    return options;
  }
}
