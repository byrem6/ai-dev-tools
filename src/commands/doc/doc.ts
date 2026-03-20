import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class DocCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('doc', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      if (options.action === 'coverage') {
        return this.checkCoverage(options.filePath);
      }

      if (options.action === 'stale') {
        return this.checkStale(options.filePath, options.check);
      }

      throw createError('ENOMATCH', 'doc', 'Invalid doc command. Use: coverage or stale');
    });
  }

  private async checkCoverage(filePath: string): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const commands = this.extractCommands(lines);
    const coverage: any = {};

    for (const cmd of commands) {
      coverage[cmd] = {
        hasUsage: this.hasUsageExample(lines, cmd),
        hasOptions: this.hasOptions(lines, cmd),
        hasFormats: this.hasOutputFormats(lines, cmd),
        hasTokens: this.hasTokenEstimate(lines, cmd),
      };
    }

    const totalCommands = Object.keys(coverage).length;
    const fullyDocumented = Object.values(coverage).filter(
      (c: any) => c.hasUsage && c.hasOptions && c.hasFormats && c.hasTokens
    ).length;

    let output = `Documentation Coverage Report\n`;
    output += `File: ${filePath}\n`;
    output += `Commands: ${totalCommands}\n`;
    output += `Fully documented: ${fullyDocumented} (${Math.round(fullyDocumented / totalCommands * 100)}%)\n`;
    output += `===\n`;

    for (const [cmd, cov] of Object.entries(coverage)) {
      const c = cov as any;
      const status = c.hasUsage && c.hasOptions && c.hasFormats && c.hasTokens ? '✓' : '✗';
      output += `\n${status} ${cmd}\n`;

      if (!c.hasUsage) output += `  - Missing: Usage example\n`;
      if (!c.hasOptions) output += `  - Missing: Options list\n`;
      if (!c.hasFormats) output += `  - Missing: Output formats\n`;
      if (!c.hasTokens) output += `  - Missing: Token estimate\n`;
    }

    return {
      ok: true,
      command: 'doc',
      action: 'coverage',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      totalCommands,
      fullyDocumented,
      coverage,
    };
  }

  private async checkStale(filePath: string, check?: string): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const issues: string[] = [];

    if (check === 'v5-features' || !check) {
      const v5Features = ['smart', 'nextStart', 'max-tokens'];
      for (const feature of v5Features) {
        if (!content.includes(feature)) {
          issues.push(`Missing v5 feature: ${feature}`);
        }
      }
    }

    const outdatedPatterns = [
      /~~tokens/g,
      /\[WIP\]/g,
      /TODO.*document/gi,
    ];

    for (const pattern of outdatedPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        issues.push(`Found ${matches.length} outdated pattern(s): ${pattern.source}`);
      }
    }

    const missingExamples: string[] = [];
    const commands = this.extractCommands(lines);

    for (const cmd of commands) {
      if (!this.hasUsageExample(lines, cmd)) {
        missingExamples.push(cmd);
      }
    }

    if (missingExamples.length > 0) {
      issues.push(`Commands without examples: ${missingExamples.join(', ')}`);
    }

    let output = `Stale Content Check\n`;
    output += `File: ${filePath}\n`;
    output += `Issues found: ${issues.length}\n`;
    output += `===\n`;

    for (const issue of issues) {
      output += `- ${issue}\n`;
    }

    if (issues.length === 0) {
      output += `\n✓ No stale content detected\n`;
    }

    return {
      ok: true,
      command: 'doc',
      action: 'stale',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      issues,
      check,
    };
  }

  private extractCommands(lines: string[]): string[] {
    const commands: string[] = [];
    const commandRegex = /`adt\s+(\w+)/g;

    for (const line of lines) {
      let match;
      while ((match = commandRegex.exec(line)) !== null) {
        const cmd = match[1];
        if (!commands.includes(cmd)) {
          commands.push(cmd);
        }
      }
    }

    return commands;
  }

  private hasUsageExample(lines: string[], command: string): boolean {
    const regex = new RegExp(`\\\`\\\`\\\`.*adt\\s+${command}`, 's');
    return lines.some(line => regex.test(line));
  }

  private hasOptions(lines: string[], command: string): boolean {
    const cmdSection = lines.findIndex(line => line.includes(`### \`adt ${command}`));
    if (cmdSection === -1) return false;

    const nextSection = lines.findIndex((line, i) => i > cmdSection && line.startsWith('###'));
    const section = lines.slice(cmdSection, nextSection === -1 ? cmdSection + 20 : nextSection);

    return section.some(line => line.includes('--'));
  }

  private hasOutputFormats(lines: string[], command: string): boolean {
    const cmdSection = lines.findIndex(line => line.includes(`### \`adt ${command}`));
    if (cmdSection === -1) return false;

    const nextSection = lines.findIndex((line, i) => i > cmdSection && line.startsWith('###'));
    const section = lines.slice(cmdSection, nextSection === -1 ? cmdSection + 20 : nextSection);

    return section.some(line => line.includes('--fmt'));
  }

  private hasTokenEstimate(lines: string[], command: string): boolean {
    const cmdSection = lines.findIndex(line => line.includes(`### \`adt ${command}`));
    if (cmdSection === -1) return false;

    const nextSection = lines.findIndex((line, i) => i > cmdSection && line.startsWith('###'));
    const section = lines.slice(cmdSection, nextSection === -1 ? cmdSection + 20 : nextSection);

    return section.some(line => line.includes('~tokens') || line.includes('tokenEstimate'));
  }

  private parseArgs(args: string[]): {
    filePath: string;
    action?: string;
    check?: string;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === 'coverage' || arg === 'stale') {
        options.action = arg;
      } else if (arg === '--check' && nextArg) {
        options.check = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
