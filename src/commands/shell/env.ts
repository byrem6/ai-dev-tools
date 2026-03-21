import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class EnvCommand extends Command {
  public getDescription(): string {
    return 'Environment variables';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('env', args, async () => {
      const action = options.action || 'list';
      
      switch (action) {
        case 'list':
          return this.listEnv(options);
        case 'get':
          return this.getEnv(options);
        case 'check':
          return this.checkEnv(options);
        case 'load':
          return this.loadEnv(options);
        default:
          return this.listEnv(options);
      }
    });
  }

  private async listEnv(options: any): Promise<CommandResult> {
    const envVars = Object.keys(process.env).sort();
    
    const output = this.formatEnvList(envVars, options);

    return {
      ok: true,
      command: 'env',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      variables: envVars,
      total: envVars.length,
    };
  }

  private async getEnv(options: any): Promise<CommandResult> {
    if (!options.keys || options.keys.length === 0) {
      throw createError('ENOMATCH', '', 'Variable names required');
    }

    const values: any = {};
    options.keys.forEach((key: string) => {
      values[key] = process.env[key] || null;
    });
    
    const output = this.formatEnvGet(values, options);

    return {
      ok: true,
      command: 'env',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      values,
    };
  }

  private async checkEnv(options: any): Promise<CommandResult> {
    if (!options.keys || options.keys.length === 0) {
      throw createError('ENOMATCH', '', 'Variable names to check required');
    }

    const missing: string[] = [];
    const present: string[] = [];

    options.keys.forEach((key: string) => {
      if (process.env[key]) {
        present.push(key);
      } else {
        missing.push(key);
      }
    });
    
    const allPresent = missing.length === 0;
    const output = this.formatEnvCheck(present, missing, options);

    return {
      ok: allPresent,
      command: 'env',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      present,
      missing,
      allPresent,
    };
  }

  private async loadEnv(options: any): Promise<CommandResult> {
    if (!options.file) {
      throw createError('ENOMATCH', '', 'Env file path required');
    }

    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    const envPath = resolve(process.cwd(), options.file);
    
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      const loaded: any = {};
      
      lines.forEach((line: string) => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            loaded[key] = valueParts.join('=');
            process.env[key] = loaded[key];
          }
        }
      });

      const output = this.formatEnvLoad(Object.keys(loaded), options.file, options);

      return {
        ok: true,
        command: 'env',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        file: options.file,
        loaded: Object.keys(loaded),
      };
    } catch (error: any) {
      throw createError('ENOENT', envPath);
    }
  }

  private formatEnvList(vars: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return vars.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'env',
        variables: vars,
        total: vars.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`total: ${vars.length}`);
      lines.push('===');
      vars.slice(0, 50).forEach(v => lines.push(`${v}=${process.env[v] || ''}`));
      return lines.join('\n');
    }
  }

  private formatEnvGet(values: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      Object.keys(values).forEach(key => {
        lines.push(`${key}=${values[key] || '<not set>'}`);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'env',
        values,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push('===');
      Object.keys(values).forEach(key => {
        lines.push(`${key}=${values[key] || '<not set>'}`);
      });
      return lines.join('\n');
    }
  }

  private formatEnvCheck(present: string[], missing: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok ${missing.length === 0 ? 'true' : 'false'}`);
      
      present.forEach(key => lines.push(`✓ ${key}`));
      missing.forEach(key => lines.push(`✗ ${key}  [MISSING]`));
      
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: missing.length === 0,
        command: 'env',
        present,
        missing,
        allPresent: missing.length === 0,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${missing.length === 0 ? 'true' : 'false'}`);
      
      if (present.length > 0) {
        lines.push('present:');
        present.forEach(key => lines.push(`  ✓ ${key}`));
      }
      
      if (missing.length > 0) {
        lines.push('missing:');
        missing.forEach(key => lines.push(`  ✗ ${key}`));
      }
      
      return lines.join('\n');
    }
  }

  private formatEnvLoad(loaded: string[], file: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true  loaded: ${loaded.length} variables  from: ${file}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'env',
        file,
        loaded,
        total: loaded.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`file: ${file}`);
      lines.push(`loaded: ${loaded.length} variables`);
      lines.push('===');
      loaded.slice(0, 20).forEach(v => lines.push(`  ${v}`));
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = { action: 'list' };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt') {
        options.fmt = args[++i];
      } else if (arg === 'list') {
        options.action = 'list';
      } else if (arg === 'get') {
        options.action = 'get';
      } else if (arg === 'check') {
        options.action = 'check';
      } else if (arg === 'load') {
        options.action = 'load';
      } else if (arg === '--file') {
        options.file = args[++i];
      } else if (!options.keys) {
        options.keys = [];
        options.keys.push(arg);
      } else if (arg.startsWith('--')) {
        // Skip flags
      } else {
        options.keys.push(arg);
      }
    }

    return options;
  }
}
