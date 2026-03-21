import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface GenerateTestOptions {
  type: string;
  name: string;
  dryRun?: boolean;
  fmt?: OutputFormat;
  path?: string;
}

export class GenerateTestCommand extends Command {
  public getDescription(): string {
    return 'Generate test template';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt generate-test <name> [options]',
      description: 'Generate a test file template for a class/service',
      examples: [
        'adt generate-test UserService',
        'adt generate-test PaymentService --dry-run',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('generate test', args, async () => {
      if (!options.name) {
        throw createError('ENOENT', 'Test name is required');
      }

      const targetPath = options.path || path.join(process.cwd(), 'tests');
      const fileName = `${options.name}.test.ts`;
      const filePath = path.join(targetPath, fileName);

      if (!options.dryRun) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        if (fs.existsSync(filePath)) {
          throw createError('EEXIST', filePath);
        }
      }

      const content = this.generateTestContent(options.name);
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

  private generateTestContent(name: string): string {
    const className = name;
    const instanceName = name.charAt(0).toLowerCase() + name.slice(1);

    return `import { ${className} } from '../src/${className}';

describe('${className}', () => {
  let ${instanceName}: ${className};

  beforeEach(() => {
    ${instanceName} = new ${className}();
  });

  describe('constructor', () => {
    it('should create instance successfully', () => {
      expect(${instanceName}).toBeInstanceOf(${className});
    });
  });

  describe('create', () => {
    it('should create ${className} successfully', async () => {
      const mockDTO = { name: 'Test', description: 'Test Description' };
      const result = await ${instanceName}.create(mockDTO);
      expect(result).toBeDefined();
      expect(result).toMatchObject(mockDTO);
    });

    it('should handle null input gracefully', async () => {
      const result = await ${instanceName}.create(null as any);
      expect(result).toBeNull();
    });

    it('should handle empty input', async () => {
      const result = await ${instanceName}.create({});
      expect(result).toBeDefined();
    });

    it('should throw appropriate error for invalid input', async () => {
      jest.spyOn(${instanceName}['repository'], 'save').mockRejectedValue(new Error('Invalid input'));
      await expect(${instanceName}.create({})).rejects.toThrow('Invalid input');
    });
  });

  describe('findById', () => {
    it('should find ${className} by id', async () => {
      const result = await ${instanceName}.findById('1');
      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should return null for non-existent id', async () => {
      const result = await ${instanceName}.findById('999');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all ${className} records', async () => {
      const result = await ${instanceName}.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no records exist', async () => {
      const result = await ${instanceName}.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update ${className} successfully', async () => {
      const updateDTO = { name: 'Updated Name' };
      const result = await ${instanceName}.update('1', updateDTO);
      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');
    });

    it('should throw error for non-existent id', async () => {
      await expect(${instanceName}.update('999', {})).rejects.toThrow('${className} not found');
    });
  });

  describe('delete', () => {
    it('should delete ${className} successfully', async () => {
      await expect(${instanceName}.delete('1')).resolves.not.toThrow();
    });

    it('should throw error for non-existent id', async () => {
      await expect(${instanceName}.delete('999')).rejects.toThrow('${className} not found');
    });
  });
});
`;
  }

  private formatSlim(filePath: string, lines: number, dryRun?: boolean): CommandResult {
    const status = dryRun ? '[dry-run]' : 'created';
    const output = `ok true  ${filePath}  ${status}  ${lines} lines`;

    return {
      ok: true,
      command: 'generate',
      type: 'test',
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
template: test  lines: ${lines}
---
${content}`;

    return {
      ok: true,
      command: 'generate',
      type: 'test',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      file: filePath,
      lines,
      dryRun,
    };
  }

  private parseArgs(args: string[]): GenerateTestOptions {
    const options: GenerateTestOptions = {
      type: 'test',
      name: '',
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--path' && nextArg) {
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
