import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface FieldDefinition {
  name: string;
  type: string;
  optional?: boolean;
}

interface GenerateModelOptions {
  type: string;
  name: string;
  fields?: string;
  dryRun?: boolean;
  fmt?: OutputFormat;
  path?: string;
}

export class GenerateModelCommand extends Command {
  public getDescription(): string {
    return 'Generate model template';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt generate-model <name> [options]',
      description: 'Generate a model/interface class with fields',
      examples: [
        'adt generate-model User --fields "name:string,age:number"',
        'adt generate-model Order --fields "id:string,total:number" --dry-run',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('generate model', args, async () => {
      if (!options.name) {
        throw createError('ENOENT', 'Model name is required');
      }

      const targetPath = options.path || path.join(process.cwd(), 'src/models');
      const fileName = `${options.name}.ts`;
      const filePath = path.join(targetPath, fileName);

      if (!options.dryRun) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        if (fs.existsSync(filePath)) {
          throw createError('EEXIST', filePath);
        }
      }

      const fields = this.parseFields(options.fields);
      const content = this.generateModelContent(options.name, fields);
      const lines = content.split('\n').length;

      if (!options.dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(filePath, lines, options.dryRun);
      }

      return this.formatNormal(filePath, content, fields, options.dryRun);
    });
  }

  private parseFields(fieldsStr?: string): FieldDefinition[] {
    if (!fieldsStr) {
      return [];
    }

    return fieldsStr.split(',').map((field, index) => {
      const parts = field.trim().split(':');
      if (parts.length < 2) {
        throw new Error(`Invalid field format at position ${index + 1}: "${field}". Expected "name:type"`);
      }

      const name = parts[0].trim();
      const type = parts[1].trim();
      const optional = type.endsWith('?');

      if (!name) {
        throw new Error(`Field name is required at position ${index + 1}`);
      }

      return {
        name,
        type: optional ? type.slice(0, -1).trim() : type,
        optional,
      };
    });
  }

  private generateModelContent(name: string, fields: FieldDefinition[]): string {
    const className = name;
    const interfaceName = `I${className}`;

    let content = `export interface ${interfaceName} {\n`;
    content += `  id: string;\n`;
    content += `  createdAt: Date;\n`;
    content += `  updatedAt: Date;\n`;

    for (const field of fields) {
      const optional = field.optional ? '?' : '';
      content += `  ${field.name}${optional}: ${field.type};\n`;
    }

    content += `}\n\n`;
    content += `export class ${className} implements ${interfaceName} {\n`;
    content += `  id: string;\n`;
    content += `  createdAt: Date;\n`;
    content += `  updatedAt: Date;\n`;

    for (const field of fields) {
      content += `  ${field.name}: ${field.type}${field.optional ? ' | undefined' : ''};\n`;
    }

    content += `\n`;
    content += `  constructor(data: Partial<${interfaceName}>) {\n`;
    content += `    this.id = data.id || '';\n`;
    content += `    this.createdAt = data.createdAt || new Date();\n`;
    content += `    this.updatedAt = data.updatedAt || new Date();\n`;

    for (const field of fields) {
      const defaultValue = this.getDefaultValue(field.type);
      content += `    this.${field.name} = data.${field.name} ?? ${defaultValue};\n`;
    }

    content += `  }\n`;
    content += `}\n`;

    return content;
  }

  private getDefaultValue(type: string): string {
    const typeMap: Record<string, string> = {
      string: "''",
      number: '0',
      boolean: 'false',
      Date: 'new Date()',
      any: 'null',
      object: '{}',
      'string[]': '[]',
      'number[]': '[]',
    };

    return typeMap[type] || 'null';
  }

  private formatSlim(filePath: string, lines: number, dryRun?: boolean): CommandResult {
    const status = dryRun ? '[dry-run]' : 'created';
    const output = `ok true  ${filePath}  ${status}  ${lines} lines`;

    return {
      ok: true,
      command: 'generate',
      type: 'model',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      file: filePath,
      lines,
      dryRun,
    };
  }

  private formatNormal(filePath: string, content: string, fields: FieldDefinition[], dryRun?: boolean): CommandResult {
    const status = dryRun ? 'preview' : 'generated';
    const lines = content.split('\n').length;

    const output = `ok: true
${status}: ${filePath}
template: model  lines: ${lines}  fields: ${fields.length}
---
${content}`;

    return {
      ok: true,
      command: 'generate',
      type: 'model',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      file: filePath,
      lines,
      fields,
      dryRun,
    };
  }

  private parseArgs(args: string[]): GenerateModelOptions {
    const options: GenerateModelOptions = {
      type: 'model',
      name: '',
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fields' && nextArg) {
        options.fields = nextArg;
        i++;
      } else if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.name = arg;
      }
    }

    return options;
  }
}
