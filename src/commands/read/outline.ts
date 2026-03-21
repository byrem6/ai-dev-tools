import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import { ASTParser } from '../../parsers/typescript';

export class OutlineCommand extends Command {
  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('outline', args, async () => {
      if (!options.filePath) {
        throw createError('ENOENT', '');
      }

      if (!FileUtils.fileExists(options.filePath)) {
        throw createError('ENOENT', options.filePath);
      }

      return this.generateOutline(options.filePath, options.depth || 2, options.withLines, options.withSize);
    });
  }

  private async generateOutline(
    filePath: string,
    depth: number,
    withLines?: boolean,
    withSize?: boolean
  ): Promise<CommandResult> {
    const content = FileUtils.readFile(filePath);
    const ext = FileUtils.getFileExtension(filePath);
    const totalLines = content.split('\n').length;

    let sections: any[] = [];

    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      const parser = new ASTParser(content);
      if (parser.isValid()) {
        sections = this.extractFromAST(parser, depth, withLines, withSize);
      }
    }

    const output = this.formatOutline(filePath, totalLines, sections, withLines, withSize);

    return {
      ok: true,
      command: 'outline',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      lines: totalLines,
      sections,
    };
  }

  private extractFromAST(
    parser: ASTParser,
    depth: number,
    withLines?: boolean,
    withSize?: boolean
  ): any[] {
    const symbols = parser.extractSymbols();
    const sections: any[] = [];

    const imports = parser.extractImports();
    if (imports.length > 0) {
      sections.push({
        type: 'import-block',
        name: 'imports',
        line: imports[0].line,
        end: imports[imports.length - 1].line,
        summary: `${imports.length} imports`,
      });
    }

    symbols.forEach(symbol => {
      if (symbol.type === 'class') {
        const classSection: any = {
          type: 'class',
          name: symbol.name,
          line: symbol.line,
          end: symbol.end,
        };

        if (withLines) {
          classSection.lines = `${symbol.line}-${symbol.end}`;
        }

        if (withSize && symbol.end) {
          classSection.size = symbol.end - symbol.line + 1;
        }

        if (depth > 1 && symbol.members) {
          classSection.members = symbol.members.map((member: any) => {
            const memberInfo: any = {
              type: member.type,
              name: member.name,
              line: member.line,
            };

            if (withLines && member.end) {
              memberInfo.lines = `${member.line}-${member.end}`;
            }

            if (withSize && member.end) {
              memberInfo.size = member.end - member.line + 1;
            }

            if (member.async) {
              memberInfo.async = true;
            }

            return memberInfo;
          });
        }

        sections.push(classSection);
      } else if (symbol.type === 'function') {
        const fnSection: any = {
          type: 'function',
          name: symbol.name,
          line: symbol.line,
          end: symbol.end,
        };

        if (withLines) {
          fnSection.lines = `${symbol.line}-${symbol.end}`;
        }

        if (withSize && symbol.end) {
          fnSection.size = symbol.end - symbol.line + 1;
        }

        if (symbol.async) {
          fnSection.async = true;
        }

        sections.push(fnSection);
      } else if (symbol.type === 'interface' || symbol.type === 'type') {
        const typeSection: any = {
          type: symbol.type,
          name: symbol.name,
          line: symbol.line,
          end: symbol.end,
        };

        if (withLines) {
          typeSection.lines = `${symbol.line}-${symbol.end}`;
        }

        if (withSize && symbol.end) {
          typeSection.size = symbol.end - symbol.line + 1;
        }

        sections.push(typeSection);
      }
    });

    return sections;
  }

  private formatOutline(
    filePath: string,
    totalLines: number,
    sections: any[],
    withLines?: boolean,
    withSize?: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`${filePath}  ${totalLines} lines`);

    sections.forEach(section => {
      let line = '';
      
      if (section.type === 'import-block') {
        line = `import-block     :${section.line}-${section.end}    (${section.summary})`;
      } else {
        const typeInfo = section.type ? `${section.type} ` : '';
        const lineInfo = withLines && section.lines ? ` ${section.lines}` : '';
        const sizeInfo = withSize && section.size ? ` (${section.size} lines)` : '';
        
        if (section.members && section.members.length > 0) {
          line = `${typeInfo}${section.name}        :${section.line}-${section.end}  (${section.end - section.line + 1} lines)`;
        } else {
          line = `${typeInfo}${section.name}        :${section.line}-${section.end || section.line}  ${sizeInfo}`;
        }
      }

      lines.push(line);

      if (section.members && section.members.length > 0) {
        section.members.forEach((member: any) => {
          let memberLine = '    ';
          
          if (member.type === 'method') {
            memberLine += `method ${member.name}`;
            if (member.async) memberLine += ' async';
            if (member.lines) memberLine += ` ${member.lines}`;
            else memberLine += ` :${member.line}`;
          } else if (member.type === 'property') {
            memberLine += `property ${member.name} :${member.line}`;
          } else {
            memberLine += `${member.type} ${member.name}`;
            if (member.lines) memberLine += ` ${member.lines}`;
            else memberLine += ` :${member.line}`;
          }

          lines.push(memberLine);
        });
      }
    });

    return lines.join('\n');
  }

  private parseArgs(args: string[]): {
    filePath: string;
    depth?: number;
    withLines?: boolean;
    withSize?: boolean;
    fmt?: OutputFormat;
  } {
    const options: any = { filePath: args[0] || '' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--depth' && nextArg) {
        options.depth = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--with-lines') {
        options.withLines = true;
      } else if (arg === '--with-size') {
        options.withSize = true;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
