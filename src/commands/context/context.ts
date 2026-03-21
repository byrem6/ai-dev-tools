import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { TokenUtils } from '../../utils/token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ContextCommand extends Command {
  public getDescription(): string {
    return 'Project context management';
  }

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
        case 'track':
          return this.trackDecision(options);
        case 'history':
          return this.getHistory(options);
        case 'suggest':
          return this.suggestNext(options);
        case 'search':
          return this.searchContext(options);
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
        if (key !== 'decisions' && key !== 'conventions' && key !== 'history') {
          lines.push(`${key}: ${value}`);
        }
      });
      if (context.history && context.history.length > 0) {
        lines.push(`history: ${context.history.length} entries`);
      }
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
        if (key !== 'decisions' && key !== 'conventions' && key !== 'history') {
          lines.push(`${key}: ${value}`);
        }
      });
      
      if (context.history && context.history.length > 0) {
        lines.push('---');
        lines.push(`history: ${context.history.length} entries`);
      }
      
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

  private async trackDecision(options: any): Promise<CommandResult> {
    if (!options.decision) {
      return {
        ok: false,
        command: 'context',
        tokenEstimate: 30,
        content: 'Error: Decision text required. Usage: adt context track "<decision>" [--reason "<reason>"]',
      };
    }

    const context = await this.loadContext();
    if (!context.decisions) {
      context.decisions = [];
    }
    if (!context.history) {
      context.history = [];
    }

    const entry = {
      decision: options.decision,
      reason: options.reason || '',
      timestamp: new Date().toISOString(),
      command: options.command || '',
    };

    context.decisions.push(options.decision);
    context.history.push(entry);
    await this.saveContext(context);

    return {
      ok: true,
      command: 'context',
      tokenEstimate: 25,
      content: this.formatTrackDecision(entry, options),
      entry,
    };
  }

  private async getHistory(options: any): Promise<CommandResult> {
    const context = await this.loadContext();
    const history = context.history || [];

    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(history)),
      content: this.formatHistory(history, options),
      history,
    };
  }

  private async suggestNext(options: any): Promise<CommandResult> {
    const context = await this.loadContext();
    const recentEvents = this.sessionManager.getEvents().slice(-5);
    const suggestions: string[] = [];

    const lastCommand = recentEvents[recentEvents.length - 1];
    if (lastCommand) {
      switch (lastCommand.command) {
        case 'grep':
          suggestions.push('Try: adt refs <symbol> to find all usages');
          suggestions.push('Try: adt def <symbol> to see definition');
          break;
        case 'read':
          suggestions.push('Try: adt outline <file> for file structure');
          suggestions.push('Try: adt symbols <file> for symbol list');
          break;
        case 'complexity':
          suggestions.push('Try: adt refactor <file> --auto for suggestions');
          suggestions.push('Try: adt deps <file> for dependencies');
          break;
        case 'git-status':
          if (lastCommand.success) {
            suggestions.push('Try: adt git-diff to see changes');
            suggestions.push('Try: adt git-log for recent commits');
          }
          break;
      }
    }

    if (context.decisions && context.decisions.length > 0) {
      const lastDecision = context.history?.[context.history.length - 1];
      if (lastDecision?.decision.includes('test')) {
        suggestions.push('Run: adt test to verify changes');
      }
      if (lastDecision?.decision.includes('refactor')) {
        suggestions.push('Check: adt lint to ensure code quality');
      }
    }

    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(suggestions.join('\n')),
      content: this.formatSuggestions(suggestions, options),
      suggestions,
    };
  }

  private async searchContext(options: any): Promise<CommandResult> {
    if (!options.query) {
      return {
        ok: false,
        command: 'context',
        tokenEstimate: 20,
        content: 'Error: Search query required. Usage: adt context search "<query>"',
      };
    }

    const context = await this.loadContext();
    const results: any[] = [];
    const query = options.query.toLowerCase();

    if (context.decisions) {
      context.decisions.forEach((decision: string, idx: number) => {
        if (decision.toLowerCase().includes(query)) {
          results.push({ type: 'decision', value: decision, idx });
        }
      });
    }

    if (context.conventions) {
      Object.entries(context.conventions).forEach(([key, value]) => {
        if (key.toLowerCase().includes(query) || String(value).toLowerCase().includes(query)) {
          results.push({ type: 'convention', key, value });
        }
      });
    }

    if (context.history) {
      context.history.forEach((entry: any, idx: number) => {
        if (entry.decision?.toLowerCase().includes(query) || entry.reason?.toLowerCase().includes(query)) {
          results.push({ type: 'history', entry, idx });
        }
      });
    }

    return {
      ok: true,
      command: 'context',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(results)),
      content: this.formatSearchResults(results, options),
      results,
    };
  }

  private formatTrackDecision(entry: any, options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\ntracked: ${entry.decision.substring(0, 50)}...`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'context',
        action: 'track',
        entry,
      }, null, 2);
    } else {
      const lines = ['ok: true', 'action: track', `decision: ${entry.decision}`];
      if (entry.reason) {
        lines.push(`reason: ${entry.reason}`);
      }
      return lines.join('\n');
    }
  }

  private formatHistory(history: any[], options: any): string {
    if (options.fmt === 'slim') {
      const lines = ['ok true', `count: ${history.length}`];
      history.slice(0, 10).forEach((entry: any) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        lines.push(`${time}  ${entry.decision.substring(0, 40)}...`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, history }, null, 2);
    } else {
      const lines = ['ok: true', '---', `Total decisions: ${history.length}`];
      history.slice(0, 20).forEach((entry: any, idx: number) => {
        const time = new Date(entry.timestamp).toLocaleString();
        lines.push(`${idx + 1}. [${time}] ${entry.decision}`);
        if (entry.reason) {
          lines.push(`   Reason: ${entry.reason}`);
        }
      });
      return lines.join('\n');
    }
  }

  private formatSuggestions(suggestions: string[], options: any): string {
    if (options.fmt === 'slim') {
      return `ok true\n${suggestions.length} suggestions\n${suggestions.join('\n')}`;
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, suggestions }, null, 2);
    } else {
      const lines = ['ok: true', '---', 'Suggested next actions:'];
      suggestions.forEach((s, idx) => {
        lines.push(`${idx + 1}. ${s}`);
      });
      return lines.join('\n');
    }
  }

  private formatSearchResults(results: any[], options: any): string {
    if (options.fmt === 'slim') {
      const lines = ['ok true', `count: ${results.length}`];
      results.slice(0, 10).forEach((r: any) => {
        const value = r.type === 'convention' ? r.key : r.decision || r.value;
        lines.push(`${r.type}: ${value?.substring(0, 50)}...`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({ ok: true, results }, null, 2);
    } else {
      const lines = ['ok: true', '---', `Found ${results.length} matches:`];
      results.slice(0, 20).forEach((r: any) => {
        const value = r.type === 'convention' ? `${r.key}: ${r.value}` : r.decision || r.value;
        lines.push(`[${r.type}] ${value}`);
      });
      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      } else if (['get', 'set', 'decisions', 'conventions', 'clear', 'track', 'history', 'suggest', 'search'].includes(arg)) {
        options.action = arg;
      } else if (arg === '--decision' && args[i + 1]) {
        options.decision = args[++i];
      } else if (arg === '--reason' && args[i + 1]) {
        options.reason = args[++i];
      } else if (arg === '--command' && args[i + 1]) {
        options.command = args[++i];
      } else if (arg === '--query' && args[i + 1]) {
        options.query = args[++i];
      } else if (options.action === 'search' && !options.query && !arg.startsWith('--')) {
        options.query = arg;
      } else if (options.action === 'track' && !options.decision && !arg.startsWith('--')) {
        options.decision = arg;
      } else if (!options.key && arg !== 'set' && !arg.startsWith('--')) {
        options.key = arg;
      } else if (!options.value && arg !== 'set' && !arg.startsWith('--')) {
        options.value = arg;
      } else if (options.action === 'set' && !options.key && !arg.startsWith('--')) {
        options.key = arg;
      } else if (options.action === 'set' && options.key && !options.value && !arg.startsWith('--')) {
        options.value = arg;
      }
    }

    return options;
  }
}
