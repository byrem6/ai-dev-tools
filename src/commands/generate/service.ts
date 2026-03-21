import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface GenerateOptions {
  type: string;
  name: string;
  fields?: string;
  extends?: string;
  implements?: string;
  dryRun?: boolean;
  fromPattern?: boolean;
  fmt?: OutputFormat;
  path?: string;
}

export class GenerateServiceCommand extends Command {
  public getDescription(): string {
    return 'Generate service template';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt generate-service <name> [options]',
      description: 'Generate a service class template',
      examples: [
        'adt generate-service PaymentService',
        'adt generate-service UserService --extends BaseService',
        'adt generate-service AuthService --implements IAuthService',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('generate service', args, async () => {
      if (!options.name) {
        throw createError('ENOENT', 'Service name is required');
      }

      const targetPath = options.path || path.join(process.cwd(), 'src/services');
      const fileName = `${options.name}.service.ts`;
      const filePath = path.join(targetPath, fileName);

      if (!options.dryRun) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        if (fs.existsSync(filePath) && !options.dryRun) {
          throw createError('EEXIST', filePath);
        }
      }

      const content = this.generateServiceContent(options);
      const lines = content.split('\n').length;

      if (!options.dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(filePath, lines, options.dryRun);
      }

      return this.formatNormal(filePath, content, options.dryRun);
    });
  }

  private generateServiceContent(options: GenerateOptions): string {
    const className = `${options.name}Service`;
    const extendsClause = options.extends ? ` extends ${options.extends}` : '';
    const implementsClause = options.implements ? ` implements ${options.implements}` : '';

    return `import { Injectable } from '../decorators';
import { logger } from '../utils/logger';

@Injectable()
export class ${className}${extendsClause}${implementsClause} {
  constructor() {}

  async create(dto: any): Promise<any> {
    try {
      const entity = new ${className}();
      Object.assign(entity, dto);
      return await this.repository.save(entity);
    } catch (err) {
      logger.error('${className}.create failed', err);
      throw err;
    }
  }

  async findById(id: string): Promise<any> {
    try {
      return await this.repository.findOne(id);
    } catch (err) {
      logger.error('${className}.findById failed', err);
      throw err;
    }
  }

  async findAll(opts?: any): Promise<any[]> {
    try {
      return await this.repository.find();
    } catch (err) {
      logger.error('${className}.findAll failed', err);
      throw err;
    }
  }

  async update(id: string, dto: any): Promise<any> {
    try {
      const entity = await this.findById(id);
      if (!entity) {
        throw new Error('${className} not found');
      }
      Object.assign(entity, dto);
      return await this.repository.save(entity);
    } catch (err) {
      logger.error('${className}.update failed', err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const entity = await this.findById(id);
      if (!entity) {
        throw new Error('${className} not found');
      }
      await this.repository.remove(entity);
    } catch (err) {
      logger.error('${className}.delete failed', err);
      throw err;
    }
  }
}
`;
  }

  private formatSlim(filePath: string, lines: number, dryRun?: boolean): CommandResult {
    const status = dryRun ? '[dry-run]' : 'created';
    const output = `ok true  ${filePath}  ${status}  ${lines} lines`;

    return {
      ok: true,
      command: 'generate',
      type: 'service',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      file: filePath,
      lines,
      dryRun,
    };
  }

  private formatNormal(filePath: string, content: string, dryRun?: boolean): CommandResult {
    const status = dryRun ? 'preview' : 'generated';
    const lines = content.split('\n').length;

    const output = `ok: true
${status}: ${filePath}
template: service  lines: ${lines}
---
${content}`;

    return {
      ok: true,
      command: 'generate',
      type: 'service',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      file: filePath,
      lines,
      dryRun,
    };
  }

  private parseArgs(args: string[]): GenerateOptions {
    const options: GenerateOptions = {
      type: 'service',
      name: '',
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fields' && nextArg) {
        options.fields = nextArg;
        i++;
      } else if (arg === '--extends' && nextArg) {
        options.extends = nextArg;
        i++;
      } else if (arg === '--implements' && nextArg) {
        options.implements = nextArg;
        i++;
      } else if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--from-pattern') {
        options.fromPattern = true;
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
