import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

export class SplitCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('split', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.splitFile(options.filePath, options.linesPerSplit || 400, options.dryRun);
    });
  }

  private async splitFile(
    filePath: string,
    linesPerSplit: number,
    dryRun?: boolean
  ): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const allLines = content.split('\n');
    const totalLines = allLines.length;
    const numSplits = Math.ceil(totalLines / linesPerSplit);

    const splits: Array<{
      name: string;
      startLine: number;
      endLine: number;
      lines: number;
      tokens: number;
    }> = [];

    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);

    for (let i = 0; i < numSplits; i++) {
      const startLine = i * linesPerSplit;
      const endLine = Math.min(startLine + linesPerSplit, totalLines);
      const splitLines = allLines.slice(startLine, endLine);
      const splitContent = splitLines.join('\n');
      const tokens = TokenUtils.estimateTokens(splitContent);

      const splitName = `${dir}/${basename}-${String(i + 1).padStart(2, '0')}${ext}`;

      splits.push({
        name: splitName,
        startLine: startLine + 1,
        endLine,
        lines: splitLines.length,
        tokens,
      });

      if (!dryRun) {
        fs.writeFileSync(splitName, splitContent, 'utf-8');
      }
    }

    const output = splits
      .map(
        (s) => `${s.name}: ${s.startLine}-${s.endLine} (${s.lines} lines, ~${s.tokens} tokens)`
      )
      .join('\n');

    return {
      ok: true,
      command: 'split',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      totalLines,
      linesPerSplit,
      numSplits,
      splits,
      dryRun: dryRun || false,
    };
  }

  private parseArgs(args: string[]): {
    filePath: string;
    linesPerSplit?: number;
    dryRun?: boolean;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--lines' && nextArg) {
        options.linesPerSplit = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
