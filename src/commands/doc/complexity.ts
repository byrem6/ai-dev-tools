import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';

export class ComplexityCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('complexity', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.analyzeComplexity(options.filePath, options.bySection);
    });
  }

  private async analyzeComplexity(filePath: string, bySection?: boolean): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');

    if (!bySection) {
      const complexity = this.calculateOverallComplexity(content, lines);
      let output = `File: ${filePath}\n`;
      output += `Total lines: ${lines.length}\n`;
      output += `Total tokens: ${TokenUtils.estimateTokens(content)}\n`;
      output += `Complexity: ${complexity.level}\n`;
      output += `Score: ${complexity.score}\n`;
      output += `Factors:\n`;

      for (const [factor, value] of Object.entries(complexity.factors)) {
        output += `  - ${factor}: ${value}\n`;
      }

      return {
        ok: true,
        command: 'complexity',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        file: filePath,
        complexity,
      };
    }

    const sections = this.identifySections(lines);
    const sectionComplexities: any[] = [];

    for (const section of sections) {
      const sectionContent = lines.slice(section.start - 1, section.end).join('\n');
      const complexity = this.calculateOverallComplexity(sectionContent, lines);

      sectionComplexities.push({
        section: section.title,
        startLine: section.start,
        endLine: section.end,
        lines: section.end - section.start + 1,
        complexity: complexity.level,
        score: complexity.score,
      });
    }

    let output = `Section Complexity Analysis\n`;
    output += `File: ${filePath}\n`;
    output += `Sections: ${sections.length}\n`;
    output += `===\n`;

    for (const sc of sectionComplexities) {
      output += `\n${sc.section} (${sc.startLine}-${sc.endLine})\n`;
      output += `  Complexity: ${sc.complexity}\n`;
      output += `  Score: ${sc.score}\n`;
      output += `  Lines: ${sc.lines}\n`;
    }

    return {
      ok: true,
      command: 'complexity',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      sections: sectionComplexities,
    };
  }

  private calculateOverallComplexity(content: string, lines: string[]): {
    level: string;
    score: number;
    factors: { [key: string]: number };
  } {
    const factors: { [key: string]: number } = {};

    factors.codeBlocks = (content.match(/```/g) || []).length / 2;
    factors.headings = (content.match(/^#{1,6}\s/gm) || []).length;
    factors.nestedLists = (content.match(/^\s{2,}-/gm) || []).length;
    factors.tables = (content.match(/\|/g) || []).length / 2;
    factors.avgLineLength = content.length / lines.length;
    factors.tokenDensity = TokenUtils.estimateTokens(content) / lines.length;

    let score = 0;
    score += factors.codeBlocks * 2;
    score += factors.headings * 0.5;
    score += factors.nestedLists * 0.3;
    score += factors.tables * 0.1;
    score += factors.avgLineLength * 0.01;
    score += factors.tokenDensity * 10;

    let level = 'low';
    if (score > 100) level = 'high';
    else if (score > 50) level = 'medium';

    return { level, score: Math.round(score), factors };
  }

  private identifySections(lines: string[]): Array<{ title: string; start: number; end: number }> {
    const sections: Array<{ title: string; start: number; end: number }> = [];
    let currentSection: { title: string; start: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const headingMatch = lines[i].match(/^#{2}\s+(.+)$/);

      if (headingMatch) {
        if (currentSection) {
          sections.push({ ...currentSection, end: i });
        }
        currentSection = { title: headingMatch[1], start: i + 1 };
      }
    }

    if (currentSection) {
      sections.push({ ...currentSection, end: lines.length });
    }

    return sections;
  }

  private parseArgs(args: string[]): {
    filePath: string;
    bySection?: boolean;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--by-section') {
        options.bySection = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
