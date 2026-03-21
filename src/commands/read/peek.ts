import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { ASTParser } from '../../parsers/typescript';

export class PeekCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('peek', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.generatePeek(options.filePath);
    });
  }

  private async generatePeek(filePath: string): Promise<CommandResult> {
    const info = FileUtils.getFileInfo(filePath);
    const content = FileUtils.readFile(filePath);
    const lines = content.split('\n');
    const ext = FileUtils.getFileExtension(filePath);
    const language = FileUtils.getLanguageFromExtension(ext);

    let imports: string[] = [];
    let skeleton: any[] = [];

    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      try {
        const parser = new ASTParser(content);
        if (parser.isValid()) {
          const importList = parser.extractImports();
          imports = importList.map(imp => imp.source);

          const symbols = parser.extractSymbols();
          skeleton = this.buildSkeleton(symbols);
        }
      } catch (error) {
        // If parsing fails, continue without skeleton
      }
    }

    const firstLines = lines.slice(0, 3).map((line, i) => `${i + 1}: ${line}`);

    const output = this.formatPeek(info, language, imports, skeleton, firstLines);

    return {
      ok: true,
      command: 'peek',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      info,
      language,
      imports,
      skeleton,
      firstLines,
    };
  }

  private buildSkeleton(symbols: any[]): any[] {
    const skeleton: any[] = [];

    symbols.forEach(symbol => {
      if (symbol.type === 'class') {
        const classInfo: any = {
          type: 'class',
          name: symbol.name,
          line: symbol.line,
          end: symbol.end,
        };

        if (symbol.members) {
          classInfo.members = symbol.members.map((member: any) => ({
            type: member.type,
            name: member.name,
            line: member.line,
            end: member.end,
            async: member.async,
          }));
        }

        skeleton.push(classInfo);
      } else if (symbol.type === 'function') {
        skeleton.push({
          type: 'function',
          name: symbol.name,
          line: symbol.line,
          end: symbol.end,
          async: symbol.async,
        });
      }
    });

    return skeleton;
  }

  private formatPeek(
    info: any,
    language: string,
    imports: string[],
    skeleton: any[],
    firstLines: string[]
  ): string {
    const fmt = this.formatManager.getFormat();

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`${language}  ${info.totalLines} lines  ${info.sizeHuman}`);
      if (imports.length > 0) {
        lines.push(`imports: ${imports.join('  ')}`);
      }
      skeleton.forEach(item => {
        if (item.type === 'class') {
          lines.push(`class ${item.name} :${item.line}–${item.end}`);
          if (item.members) {
            item.members.forEach((member: any) => {
              let memberLine = `  ${member.type === 'method' ? 'method' : 'prop'} ${member.name} :${member.line}`;
              if (member.end) memberLine += `–${member.end}`;
              if (member.async) memberLine += ' async';
              lines.push(memberLine);
            });
          }
        } else if (item.type === 'function') {
          let line = `function ${item.name} :${item.line}`;
          if (item.end) line += `–${item.end}`;
          if (item.async) line += ' async';
          lines.push(line);
        }
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'peek',
        file: info.path,
        type: language,
        size: info.sizeHuman,
        totalLines: info.totalLines,
        encoding: info.encoding,
        lineEnding: info.lineEnding,
        hasBOM: info.hasBOM,
        isBinary: info.binary,
        imports,
        skeleton,
        firstLines,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: true`);
      lines.push(`file: ${info.path}`);
      lines.push(`type: ${language}  size: ${info.sizeHuman}  lines: ${info.totalLines}`);
      lines.push(`encoding: ${info.encoding}  lineEnding: ${info.lineEnding}  binary: ${info.binary}`);
      lines.push('---');

      if (imports.length > 0) {
        lines.push(`imports (${imports.length}):`);
        imports.slice(0, 10).forEach((imp, i) => {
          lines.push(`  ${i + 1}: ${imp}`);
        });
        if (imports.length > 10) {
          lines.push(`  ... and ${imports.length - 10} more`);
        }
        lines.push('---');
      }

      if (skeleton.length > 0) {
        lines.push('skeleton:');
        skeleton.forEach(item => {
          if (item.type === 'class') {
            let line = `  class ${item.name}                 :${item.line}–${item.end}`;
            lines.push(line);

            if (item.members) {
              item.members.forEach((member: any) => {
                let memberLine = '    ';
                if (member.type === 'method') {
                  memberLine += `method ${member.name}`;
                  if (member.async) memberLine += '        async';
                  memberLine += ` :${member.line}`;
                  if (member.end) memberLine += `–${member.end}`;
                } else if (member.type === 'property') {
                  memberLine += `property ${member.name}              :${member.line}`;
                }
                lines.push(memberLine);
              });
            }
          } else if (item.type === 'function') {
            let line = `  function ${item.name} :${item.line}`;
            if (item.end) line += `–${item.end}`;
            if (item.async) line += '  async';
            lines.push(line);
          }
        });
        lines.push('---');
      }

      if (firstLines.length > 0) {
        lines.push('first-lines:');
        firstLines.forEach(line => lines.push(line));
      }

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): {
    filePath: string;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
