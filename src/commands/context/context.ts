import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ContextCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('context', args, async () => {
      const action = options.action || 'get';
      
      switch (action) {
        case 'get':
          return this.getContext(options);
        case 'set':
          return this.setContext(options);
        case 'decisions':
          return this.getDecisions(options);
        case 'conventions':
          return this.getConventions(options);
        case 'clear':
          return this.clearContext(options);
        default:
          return this.getContext(options);
      }
    });
  }

  private async getContext(options: any): Promise<CommandResult> {
    const context = await this.loadContext();
    
    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(context)),
      content: this.formatContext(context, options),
      context,
    };
  }

  private async setContext(options: any): Promise<CommandResult> {
    if (!options.key || !options.value) {
      return {
        ok: false,
        command: 'context',
        tokenEstimate: 30,
        content: 'Error: Key and value required. Usage: adt context set <key> <value>',
      };
    }

    const context = await this.loadContext();
    context[options.key] = options.value;
    await this.saveContext(context);
    
    return {
      ok: true,
      command: 'context',
      tokenEstimate: 20,
      content: this.formatSetContext(options.key, options.value, options),
    };
  }

  private async getDecisions(options: any): Promise<CommandResult> {
    const context = await this.loadContext();
    const decisions = context.decisions || [];
    
    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(decisions)),
      content: this.formatDecisions(decisions, options),
      decisions,
    };
  }

  private async getConventions(options: any): Promise<CommandResult> {
    const context = await this.loadContext();
    const conventions = context.conventions || {};
    
    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(conventions)),
      content: this.formatConventions(conventions, options),
      conventions,
    };
  }

  private async clearContext(options: any): Promise<CommandResult> {
    await this.saveContext({});
    
    return {
      ok: true,
      command: 'context',
      tokenEstimate: 15,
      content: this.formatClearContext(options),
    };
  }

  private async loadContext(): Promise<any> {
    const homeDir = os.homedir();
    const adtDir = path.join(homeDir, '.adt');
    const contextDir = path.join(adtDir, 'context');
    
    // Try to find project context
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);
    const contextFile = path.join(contextDir, `${projectName}.json`);
    
    if (fs.existsSync(contextFile)) {
      try {
        return JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      } catch {
        return {};
      }
    }
    
    return {};
  }

  private async saveContext(context: any): Promise<void> {
    const homeDir = os.homedir();
    const adtDir = path.join(homeDir, '.adt');
    const contextDir = path.join(adtDir, 'context');
    
    // Create directory if not exists
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    
    // Save project context
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);
    const contextFile = path.join(contextDir, `${projectName}.json`);
    
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2));
  }

  private formatContext(context: any, options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = [];
      lines.push('ok true');
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'decisions' && key !== 'conventions') {
          lines.push(`${key}: ${value}`);
        }
      });
      if (context.decisions && context.decisions.length > 0) {
        lines.push(`decisions: ${context.decisions.length}`);
      }
      if (context.conventions && Object.keys(context.conventions).length > 0) {
        lines.push(`conventions: ${Object.keys(context.conventions).length}`);
      }
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        context,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('command: context');
      lines.push('---');
      
      if (Object.keys(context).length === 0) {
        lines.push('No context stored for this project.');
        return lines.join('\n');
      }
      
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'decisions' && key !== 'conventions') {
          lines.push(`${key}: ${value}`);
        }
      });
      
      if (context.decisions && context.decisions.length > 0) {
        lines.push('---');
        lines.push('decisions:');
        context.decisions.forEach((decision: string) => {
          lines.push(`  - ${decision}`);
        });
      }
      
      if (context.conventions && Object.keys(context.conventions).length > 0) {
        lines.push('---');
        lines.push('conventions:');
        Object.entries(context.conventions).forEach(([key, value]) => {
          lines.push(`  ${key}: ${value}`);
        });
      }
      
      return lines.join('\n');
    }
  }

  private formatSetContext(key: string, value: string, options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\nset: ${key} = ${value}`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        action: 'set',
        key,
        value,
      }, null, 2);
    } else {
      return `ok: true\naction: set\nkey: ${key}\nvalue: ${value}`;
    }
  }

  private formatDecisions(decisions: string[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = ['ok true'];
      decisions.forEach(d => lines.push(d));
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        decisions,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', '---'];
      if (decisions.length === 0) {
        lines.push('No decisions recorded.');
      } else {
        decisions.forEach(d => lines.push(`  - ${d}`));
      }
      return lines.join('\n');
    }
  }

  private formatConventions(conventions: any, options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = ['ok true'];
      Object.entries(conventions).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        conventions,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', '---'];
      if (Object.keys(conventions).length === 0) {
        lines.push('No conventions recorded.');
      } else {
        Object.entries(conventions).forEach(([key, value]) => {
          lines.push(`  ${key}: ${value}`);
        });
      }
      return lines.join('\n');
    }
  }

  private formatClearContext(options: any): string {
    if (options.fmt === 'slim') {
      return 'ok true\ncleared';
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        action: 'clear',
      }, null, 2);
    } else {
      return 'ok: true\naction: clear';
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      } else if (arg === 'get' || arg === 'set' || arg === 'decisions' || arg === 'conventions' || arg === 'clear') {
        options.action = arg;
      } else if (!options.key && arg !== 'set') {
        options.key = arg;
      } else if (!options.value && arg !== 'set') {
        options.value = arg;
      } else if (options.action === 'set' && !options.key) {
        options.key = arg;
      } else if (options.action === 'set' && options.key && !options.value) {
        options.value = arg;
      }
    }

    return options;
  }
}
