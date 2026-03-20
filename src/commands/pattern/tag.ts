import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface Tag {
  id: string;
  tag: string;
  file: string;
  line?: number;
  startLine?: number;
  endLine?: number;
  createdAt: string;
}

export class TagCommand extends Command {
  private tagsFile = path.join(process.cwd(), '.adt', 'tags.json');

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('tag', args, async () => {
      if (!options.filePath && !options.action && !options.searchTag) {
        throw createError('ENOMATCH', 'tag', 'File or action required');
      }

      if (options.action === 'add' && options.filePath) {
        if (!FileUtils.fileExists(options.filePath)) {
          throw createError('ENOENT', options.filePath);
        }
        if (!options.tag) {
          throw createError('ENOMATCH', 'tag', 'Tag is required for add action');
        }
        return this.addTag(
          options.filePath,
          options.tag,
          options.line,
          options.startLine,
          options.endLine
        );
      }

      if (options.action === 'search' && options.searchTag) {
        return this.searchTags(options.searchTag, options.filePath);
      }

      if (options.action === 'report' && options.filePath) {
        if (!FileUtils.fileExists(options.filePath)) {
          throw createError('ENOENT', options.filePath);
        }
        return this.tagReport(options.filePath);
      }

      if (options.action === 'remove' && options.tagId) {
        return this.removeTag(options.tagId);
      }

      if (options.action === 'list') {
        return this.listTags(options.filePath);
      }

      throw createError('ENOMATCH', 'tag', 'Invalid tag command. Use: add, search, report, remove, or list');
    });
  }

  private loadTags(): Tag[] {
    if (!fs.existsSync(this.tagsFile)) {
      return [];
    }
    const content = fs.readFileSync(this.tagsFile, 'utf-8');
    return JSON.parse(content);
  }

  private saveTags(tags: Tag[]): void {
    const dir = path.dirname(this.tagsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.tagsFile, JSON.stringify(tags, null, 2));
  }

  private async addTag(
    filePath: string,
    tag: string,
    line?: number,
    startLine?: number,
    endLine?: number
  ): Promise<CommandResult> {
    const tags = this.loadTags();
    const id = `${path.basename(filePath)}-${Date.now()}`;

    const newTag: Tag = {
      id,
      tag,
      file: filePath,
      line,
      startLine,
      endLine,
      createdAt: new Date().toISOString(),
    };

    tags.push(newTag);
    this.saveTags(tags);

    let output = `Tag added: ${tag}\n`;
    output += `File: ${filePath}\n`;
    if (line) output += `Line: ${line}\n`;
    if (startLine && endLine) output += `Range: ${startLine}-${endLine}\n`;
    output += `ID: ${id}\n`;

    return {
      ok: true,
      command: 'tag',
      action: 'add',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tag: newTag,
    };
  }

  private async searchTags(tag: string, filePath?: string): Promise<CommandResult> {
    const tags = this.loadTags();
    const filtered = tags.filter(t => {
      const matchesTag = t.tag === tag || t.tag.includes(tag);
      const matchesFile = !filePath || t.file === filePath;
      return matchesTag && matchesFile;
    });

    let output = `Tag search: ${tag}\n`;
    output += `Results: ${filtered.length}\n`;
    output += `===\n`;

    for (const t of filtered) {
      output += `${t.file}:${t.line || `${t.startLine}-${t.endLine}`} [${t.tag}]\n`;
    }

    return {
      ok: true,
      command: 'tag',
      action: 'search',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tag,
      results: filtered,
    };
  }

  private async tagReport(filePath: string): Promise<CommandResult> {
    const tags = this.loadTags();
    const fileTags = tags.filter(t => t.file === filePath);

    const content = FileUtils.readFile(filePath);
    const totalTokens = TokenUtils.estimateTokens(content);

    const tagGroups: { [key: string]: Tag[] } = {};
    for (const tag of fileTags) {
      if (!tagGroups[tag.tag]) {
        tagGroups[tag.tag] = [];
      }
      tagGroups[tag.tag].push(tag);
    }

    let output = `Tag Report: ${filePath}\n`;
    output += `Total tags: ${fileTags.length}\n`;
    output += `File tokens: ${totalTokens}\n`;
    output += `===\n`;

    for (const [tag, tagList] of Object.entries(tagGroups)) {
      output += `\n[${tag}]: ${tagList.length} occurrences\n`;
      for (const t of tagList) {
        if (t.line) {
          output += `  Line ${t.line}\n`;
        } else if (t.startLine && t.endLine) {
          output += `  Lines ${t.startLine}-${t.endLine}\n`;
        }
      }
    }

    return {
      ok: true,
      command: 'tag',
      action: 'report',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file: filePath,
      totalTokens,
      tagGroups,
      tags: fileTags,
    };
  }

  private async removeTag(tagId: string): Promise<CommandResult> {
    const tags = this.loadTags();
    const index = tags.findIndex(t => t.id === tagId);

    if (index === -1) {
      throw createError('ENOMATCH', tagId, 'Tag not found');
    }

    const removed = tags.splice(index, 1)[0];
    this.saveTags(tags);

    let output = `Tag removed: ${removed.tag}\n`;
    output += `ID: ${tagId}\n`;

    return {
      ok: true,
      command: 'tag',
      action: 'remove',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      removedTag: removed,
    };
  }

  private async listTags(filePath?: string): Promise<CommandResult> {
    const tags = this.loadTags();
    const filtered = filePath ? tags.filter(t => t.file === filePath) : tags;

    let output = `Tags: ${filtered.length}\n`;
    output += `===\n`;

    for (const t of filtered) {
      output += `${t.id}: ${t.tag} @ ${t.file}:${t.line || `${t.startLine}-${t.endLine}`}\n`;
    }

    return {
      ok: true,
      command: 'tag',
      action: 'list',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      tags: filtered,
    };
  }

  private parseArgs(args: string[]): {
    filePath?: string;
    action?: string;
    tag?: string;
    searchTag?: string;
    tagId?: string;
    line?: number;
    startLine?: number;
    endLine?: number;
    fmt?: OutputFormat;
  } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (i === 0 && !arg.startsWith('--')) {
        options.action = arg;
      } else if (!arg.startsWith('--') && i > 0 && !options.filePath) {
        options.filePath = arg;
      } else if (arg === '--tag' && nextArg) {
        options.tag = nextArg;
        i++;
      } else if (arg === '--search' && nextArg) {
        options.searchTag = nextArg;
        i++;
      } else if (arg === '--id' && nextArg) {
        options.tagId = nextArg;
        i++;
      } else if (arg === '--line' && nextArg) {
        options.line = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--start' && nextArg) {
        options.startLine = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--end' && nextArg) {
        options.endLine = parseInt(nextArg, 10);
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }
}
