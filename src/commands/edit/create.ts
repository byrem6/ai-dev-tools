import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { HashUtils } from '../../utils/hash';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class CreateCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('create', args, async () => {
      if (!options.target) {
        throw createError('ENOMATCH', '', 'Usage: adt create <path> [options]');
      }

      return this.performCreate(options.target, options);
    });
  }

  private async performCreate(targetPath: string, options: any): Promise<CommandResult> {
    const resolvedPath = path.resolve(targetPath);
    const parentDir = path.dirname(resolvedPath);

    if (FileUtils.fileExists(resolvedPath)) {
      if (!options.overwrite) {
        throw createError('EEXIST', resolvedPath, 'Use --overwrite to replace existing file');
      }
    }

    if (!FileUtils.fileExists(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    let content = '';
    let template = options.template || options.t;

    if (options.content) {
      content = options.content;
    } else if (template) {
      content = this.getTemplateContent(template, resolvedPath);
    } else {
      content = '';
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');

    const stats = fs.statSync(resolvedPath);
    const info = FileUtils.getFileInfo(resolvedPath);
    const size = content.length;

    const output = this.formatCreateOutput(resolvedPath, template, size, info.totalLines, options);

    return {
      ok: true,
      command: 'create',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      path: resolvedPath,
      template,
      size,
      lines: info.totalLines,
    };
  }

  private getTemplateContent(template: string, targetPath: string): string {
    const basename = path.basename(targetPath, path.extname(targetPath));
    const ext = path.extname(targetPath);

    switch (template) {
      case 'class':
        return `export class ${basename} {
  constructor() {}

  // Add methods here
}
`;

      case 'interface':
        return `export interface ${basename} {
  // Add properties here
}
`;

      case 'type':
        return `export type ${basename} = {
  // Add properties here
};
`;

      case 'function':
        return `export function ${basename}(): void {
  // Add implementation here
}
`;

      case 'react-component':
        return `import React from 'react';

interface ${basename}Props {
  // Add props here
}

export const ${basename}: React.FC<${basename}Props> = (props) => {
  return (
    <div>
      {/* Add JSX here */}
    </div>
  );
};

export default ${basename};
`;

      case 'react-hook':
        return `import { useState, useEffect } from 'react';

export function use${basename}() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Add effect here
  }, []);

  return state;
}
`;

      case 'express-controller':
        return `import { Request, Response } from 'express';

export class ${basename}Controller {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Add implementation here
      res.json({ data: [] });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Add implementation here
      res.json({ data: {} });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      // Add implementation here
      res.status(201).json({ data: {} });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Add implementation here
      res.json({ data: {} });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Add implementation here
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
`;

      case 'jest-test':
        return `import { ${basename} } from './${basename}';

describe('${basename}', () => {
  it('should work correctly', () => {
    // Add test implementation here
    expect(true).toBe(true);
  });
});
`;

      case 'empty':
      default:
        return '';
    }
  }

  private formatCreateOutput(targetPath: string, template: string, size: number, lines: number, options: any): string {
    const fmt = options.fmt || 'normal';
    const relativePath = path.relative(process.cwd(), targetPath);

    if (fmt === 'slim') {
      return `ok true  ${relativePath}  ${lines} lines  ${size} bytes`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'create',
        path: relativePath,
        template,
        size,
        sizeHuman: `${size} bytes`,
        lines,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`created: ${relativePath}`);
      if (template) {
        lines.push(`template: ${template}  size: ${size} bytes  lines: ${lines}`);
      } else {
        lines.push(`size: ${size} bytes  lines: ${lines}`);
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
      } else if (arg === '-t' || arg === '--template') {
        options.template = args[++i];
      } else if (arg === '--content') {
        options.content = args[++i];
      } else if (arg === '--overwrite') {
        options.overwrite = true;
      } else if (!options.target) {
        options.target = arg;
      }
    }

    return options;
  }
}
