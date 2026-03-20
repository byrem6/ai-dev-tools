import { Command } from './command';
import { FormatManager } from './format';
import { ConfigManager } from './config';
import { SessionManager } from './session';
import { OutputFormat } from '../types';

export class CLI {
  private formatManager: FormatManager;
  private configManager: ConfigManager;
  private sessionManager: SessionManager;
  private commands: Map<string, Command>;

  constructor() {
    this.configManager = new ConfigManager();
    this.formatManager = new FormatManager(this.configManager.getDefaultFormat());
    this.sessionManager = new SessionManager(this.configManager);
    this.commands = new Map();

    this.setupExitHandlers();
  }

  private setupExitHandlers(): void {
    process.on('exit', () => {
      this.sessionManager.close();
    });

    process.on('SIGINT', () => {
      this.sessionManager.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.sessionManager.close();
      process.exit(0);
    });
  }

  registerCommand(name: string, command: Command): void {
    this.commands.set(name, command);
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      return this.showHelp();
    }

    const commandName = args[0];
    const commandArgs = args.slice(1);

    const command = this.getCommand(commandName);
    
    if (!command) {
      return this.showHelp();
    }

    const result = await command.execute(...commandArgs);
    return this.formatManager.output(result);
  }

  private showHelp(): string {
    const commandList = Array.from(this.commands.keys()).sort();
    const helpLines = ['AI Dev Tools (adt) - Token-efficient CLI for AI agents', '', 'Usage: adt <command> [options] [--fmt slim|normal|json]', '', 'Available commands:'];
    
    // AI-optimized: Show most important commands first
    const priority = {
      'read': 1, 'grep': 1, 'quick': 1, 'ai': 1, 'batch': 1,
      'symbols': 2, 'def': 2, 'sig': 2, 'verify': 2, 'patch': 2,
      'map': 2, 'stats': 2, 'deps': 2, 'impact': 2,
      'git-status': 3, 'git-log': 3, 'git-diff': 3,
      'exec': 3, 'platform': 3, 'lint': 3, 'test': 3,
    };
    
    const sortedCommands = commandList.sort((a, b) => {
      const aPriority = priority[a as keyof typeof priority] || 99;
      const bPriority = priority[b as keyof typeof priority] || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.localeCompare(b);
    });
    
    const maxLen = Math.max(...sortedCommands.map(c => c.length));
    sortedCommands.forEach(cmd => {
      helpLines.push(`  ${cmd.padEnd(maxLen)}  ${this.getCommandDescription(cmd)}`);
    });
    
    helpLines.push('', 'For more information:');
    helpLines.push('  adt <command> --help');
    helpLines.push('  https://github.com/anomalyco/opencode');
    
    return helpLines.join('\n');
  }

  private getCommandDescription(commandName: string): string {
    const descriptions: Record<string, string> = {
      read: 'Smart file reader',
      peek: 'Quick file profile',
      outline: 'File structure TOC',
      grep: 'Project-wide search',
      where: 'Find files and symbols',
      refs: 'Find symbol references',
      symbols: 'List symbols in file',
      sig: 'Show function signature',
      def: 'Go to symbol definition',
      body: 'Extract function body',
      callers: 'Find who calls this',
      callees: 'Find what this calls',
      verify: 'Verify line content',
      patch: 'Line-based file editing',
      replace: 'String/regex replace',
      create: 'Create file/directory',
      delete: 'Safe delete with backup',
      move: 'Move and update imports',
      copy: 'Copy file/directory',
      rename: 'Project-wide rename',
      map: 'Project structure overview',
      tree: 'Directory tree visualization',
      stats: 'Code statistics',
      deps: 'Dependency analysis',
      impact: 'Change impact analysis',
    };
    
    return descriptions[commandName] || '';
  }

  getFormatManager(): FormatManager {
    return this.formatManager;
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }
}
