import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface PatternMatch {
  file: string;
  line: number;
  col: number;
  text: string;
}

interface Template {
  name: string;
  pattern: string;
  template: string;
  createdAt: string;
}

export class PatternCommand extends Command {
  public getDescription(): string {
    return 'Code pattern matching';
  }

  private templatesDir = path.join(process.cwd(), '.adt', 'templates');

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('pattern', args, async () => {
      if (!options.filePath && !options.action) {
        throw createError('ENOENT', '');
      }

      if (options.action === 'find' && options.filePath) {
        if (!FileUtils.fileExists(options.filePath)) {
          throw createError('ENOENT', options.filePath);
        }
        if (!options.pattern) {
          throw createError('ENOMATCH', 'pattern', 'Pattern is required for find action');
        }
        return this.findPattern(options.filePath, options.pattern, options.context || 0);
      }

      if (options.action === 'save' && options.templateName) {
        if (!options.pattern) {
          throw createError('ENOMATCH', 'pattern', 'Pattern is required for save action');
        }
        return this.saveTemplate(
          options.templateName,
          options.pattern,
          options.template || '',
          options.filePath
        );
      }

      if (options.action === 'list') {
        return this.listTemplates();
      }

      if (options.action === 'duplicate' && options.filePath) {
        if (!FileUtils.fileExists(options.filePath)) {
          throw createError('ENOENT', options.filePath);
        }
        return this.findDuplicates(options.filePath, options.threshold || 0.8);
      }

      if (options.action === 'similar' && options.filePath) {
        if (!FileUtils.fileExists(options.filePath)) {
          throw createError('ENOENT', options.filePath);
        }
        return this.findSimilar(options.filePath, options.threshold || 0.7);
      }

      throw createError('ENOMATCH', 'pattern', 'Invalid pattern command. Use: find, save, list, duplicate, or similar');
    });
  }

  private async findPattern(
    filePath: string,
    pattern: string,
    contextLines: number
  ): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const matches: PatternMatch[] = [];

    const regex = new RegExp(pattern, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      regex.lastIndex = 0;
      const match = regex.exec(line);

      if (match) {
        matches.push({
          file: filePath,
          line: i + 1,
          col: match.index + 1,
          text: line.trim(),
        });
      }
    }

    let output = `Pattern: ${pattern}\n`;
    output += `Matches: ${matches.length}\n`;
    output += `===\n`;

    for (const match of matches) {
      output += `${match.file}:${match.line}:${match.col}: ${match.text}\n`;
    }

    return {
      ok: true,
      command: 'pattern',
      action: 'find',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      pattern,
      matchCount: matches.length,
      matches,
    };
  }

  private async findDuplicates(
    filePath: string,
    threshold: number
  ): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const blocks: Array<{ start: number; end: number; content: string; hash: string }> = [];

    const blockSize = 5;
    for (let i = 0; i < lines.length - blockSize; i += blockSize) {
      const block = lines.slice(i, i + blockSize).join('\n');
      const hash = this.simpleHash(block);
      blocks.push({ start: i + 1, end: i + blockSize, content: block, hash });
    }

    const duplicates: Array<{ block1: typeof blocks[0]; block2: typeof blocks[0]; similarity: number }> = [];

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const similarity = this.calculateSimilarity(blocks[i].content, blocks[j].content);
        if (similarity >= threshold) {
          duplicates.push({ block1: blocks[i], block2: blocks[j], similarity });
        }
      }
    }

    let output = `Duplicate Analysis\n`;
    output += `Threshold: ${threshold}\n`;
    output += `Duplicates found: ${duplicates.length}\n`;
    output += `===\n`;

    for (const dup of duplicates.slice(0, 20)) {
      output += `Similarity: ${(dup.similarity * 100).toFixed(1)}%\n`;
      output += `  Block 1: Lines ${dup.block1.start}-${dup.block1.end}\n`;
      output += `  Block 2: Lines ${dup.block2.start}-${dup.block2.end}\n`;
      output += `\n`;
    }

    return {
      ok: true,
      command: 'pattern',
      action: 'duplicate',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      threshold,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 20),
    };
  }

  private async findSimilar(
    filePath: string,
    threshold: number
  ): Promise<CommandResult> {
    if (!FileUtils.fileExists(filePath)) {
      throw createError('ENOENT', filePath);
    }

    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    
    // Find function/method blocks using better regex
    const functions: Array<{ name: string; start: number; end: number; content: string }> = [];
    
    // Match various function patterns
    const patterns = [
      /(?:function\s+(\w+)\s*\(|export\s+function\s+(\w+)\s*\()/g,
      /(?:const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s+)?\([^)]*\)\s*=>|=\s*async\s+\([^)]*\)\s*=>)/g,
      /(\w+)\s*\([^)]*\)\s*{/g,  // Method definition
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g,  // Class method
    ];

    let braceLevel = 0;
    let currentFunction: { name: string; start: number; lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Count braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      // Try to match function start
      if (!currentFunction && braceLevel === 0) {
        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(trimmed);
          if (match) {
            const funcName = match[1] || match[2] || 'anonymous';
            currentFunction = {
              name: funcName,
              start: i + 1,
              lines: [line],
            };
            braceLevel = openBraces - closeBraces;
            break;
          }
        }
      } else if (currentFunction) {
        currentFunction.lines.push(line);
        braceLevel += openBraces - closeBraces;
        
        // Function ended
        if (braceLevel === 0) {
          functions.push({
            name: currentFunction.name,
            start: currentFunction.start,
            end: i + 1,
            content: currentFunction.lines.join('\n'),
          });
          currentFunction = null;
        }
      }
    }

    // Compare functions for similarity
    const similar: Array<{ fn1: typeof functions[0]; fn2: typeof functions[0]; similarity: number }> = [];
    
    for (let i = 0; i < functions.length; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        const similarity = this.calculateSimilarity(functions[i].content, functions[j].content);
        if (similarity >= threshold) {
          similar.push({ fn1: functions[i], fn2: functions[j], similarity });
        }
      }
    }

    // Sort by similarity
    similar.sort((a, b) => b.similarity - a.similarity);

    let output = `Similar Functions\n`;
    output += `File: ${filePath}\n`;
    output += `Threshold: ${threshold}\n`;
    output += `Total functions: ${functions.length}\n`;
    output += `Similar pairs found: ${similar.length}\n`;
    output += `===\n`;

    for (const sim of similar.slice(0, 20)) {
      output += `Similarity: ${(sim.similarity * 100).toFixed(1)}%\n`;
      output += `  ${sim.fn1.name} (lines ${sim.fn1.start}-${sim.fn1.end}, ${sim.fn1.end - sim.fn1.start + 1} lines)\n`;
      output += `  ${sim.fn2.name} (lines ${sim.fn2.start}-${sim.fn2.end}, ${sim.fn2.end - sim.fn2.start + 1} lines)\n`;
      output += `\n`;
    }

    return {
      ok: true,
      command: 'pattern',
      action: 'similar',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      threshold,
      totalFunctions: functions.length,
      similarCount: similar.length,
      similar: similar.slice(0, 20),
    };
  }

  private async saveTemplate(
    name: string,
    pattern: string,
    template: string,
    filePath?: string
  ): Promise<CommandResult> {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }

    const templateFile = path.join(this.templatesDir, `${name}.json`);
    const templateData: Template = {
      name,
      pattern,
      template,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(templateFile, JSON.stringify(templateData, null, 2));

    let output = `Template saved: ${name}\n`;
    output += `Pattern: ${pattern}\n`;
    output += `File: ${templateFile}\n`;

    return {
      ok: true,
      command: 'pattern',
      action: 'save',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      template: templateData,
      path: templateFile,
    };
  }

  private async listTemplates(): Promise<CommandResult> {
    if (!fs.existsSync(this.templatesDir)) {
      return {
        ok: true,
        command: 'pattern',
        action: 'list',
        tokenEstimate: 0,
        content: 'No templates found',
        templates: [],
      };
    }

    const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json'));
    const templates: Template[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.templatesDir, file), 'utf-8');
      templates.push(JSON.parse(content));
    }

    let output = `Templates: ${templates.length}\n`;
    output += `===\n`;

    for (const tmpl of templates) {
      output += `- ${tmpl.name}: ${tmpl.pattern}\n`;
    }

    return {
      ok: true,
      command: 'pattern',
      action: 'list',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      templates,
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private parseArgs(args: string[]): {
    filePath?: string;
    action?: string;
    pattern?: string;
    template?: string;
    templateName?: string;
    context?: number;
    threshold?: number;
    fmt?: OutputFormat;
  } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (i === 0 && !arg.startsWith('--')) {
        options.action = arg;
      } else if (!arg.startsWith('--') && i > 0) {
        options.filePath = arg;
      } else if (arg === '--pattern' && nextArg) {
        options.pattern = nextArg;
        i++;
      } else if (arg === '--template' && nextArg) {
        options.template = nextArg;
        i++;
      } else if (arg === '--name' && nextArg) {
        options.templateName = nextArg;
        i++;
      } else if (arg === '--context' && nextArg) {
        options.context = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--threshold' && nextArg) {
        options.threshold = parseFloat(nextArg);
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
