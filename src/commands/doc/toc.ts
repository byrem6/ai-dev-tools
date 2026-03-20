import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

interface Section {
  number: string;
  title: string;
  line: number;
  level: number;
}

export class TocCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('toc', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.generateToc(options.filePath, options.autoGenerate);
    });
  }

  private async generateToc(filePath: string, autoGenerate?: boolean): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const sections: Section[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        sections.push({
          number: String(sections.length + 1),
          title,
          line: i + 1,
          level,
        });
      }
    }

    const totalTokens = TokenUtils.estimateTokens(content);
    const estimatedReadTime = Math.ceil(totalTokens / 200);

    let output = `sections: ${sections.length}\n`;
    output += `estimatedReadTime: ${estimatedReadTime} min\n`;
    output += `tokenEstimate: ${totalTokens} (full file)\n`;
    output += `===\n`;

    for (const section of sections) {
      const indent = '  '.repeat(section.level - 1);
      output += `${section.number.padStart(2, '0')}. ${indent}${section.title} (${section.line})\n`;
    }

    if (autoGenerate) {
      const tocContent = this.generateTocMarkdown(sections);
      return {
        ok: true,
        command: 'toc',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        file: filePath,
        sections,
        totalTokens,
        estimatedReadTime,
        generatedToc: tocContent,
      };
    }

    return {
      ok: true,
      command: 'toc',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      sections,
      totalTokens,
      estimatedReadTime,
    };
  }

  private generateTocMarkdown(sections: Section[]): string {
    let toc = '\n## Table of Contents\n\n';

    for (const section of sections) {
      const indent = '  '.repeat(section.level - 1);
      const anchor = section.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      toc += `${indent}- [${section.title}](#${anchor})\n`;
    }

    return toc;
  }

  private parseArgs(args: string[]): {
    filePath: string;
    autoGenerate?: boolean;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--auto-generate') {
        options.autoGenerate = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
