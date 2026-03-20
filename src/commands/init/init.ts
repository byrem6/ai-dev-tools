import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ToolDetection {
  name: string;
  detected: boolean;
  reason: string;
}

interface FileToCreate {
  path: string;
  template: string;
  tool: string;
}

export class InitCommand extends Command {
  private templatesDir: string;

  constructor(formatManager: any, configManager: any, sessionManager: any) {
    super(formatManager, configManager, sessionManager);
    this.templatesDir = path.join(__dirname, '../../templates');
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('init', args, async () => {
      const detectedTools = this.detectTools();
      const toolsToGenerate = this.getToolsToGenerate(options.tools, detectedTools);
      const filesToCreate = this.getFilesToCreate(toolsToGenerate);

      if (options.dryRun) {
        return this.dryRun(filesToCreate, options);
      }

      const result = await this.createFiles(filesToCreate, options);

      if (!options.dryRun && result.ok) {
        try {
          const { DoctorCommand } = await import('../doctor/doctor');
          const doctor = new DoctorCommand(this.formatManager, this.configManager, this.sessionManager);
          await doctor.execute('--fmt', options.fmt || 'slim');
        } catch (error) {
          // Doctor command might not exist yet, that's ok
        }
      }

      return result;
    });
  }

  private detectTools(): ToolDetection[] {
    const cwd = process.cwd();
    const home = require('os').homedir();

    const tools: ToolDetection[] = [
      {
        name: 'claude',
        detected: fs.existsSync(path.join(cwd, '.claude')) ||
                  fs.existsSync(path.join(cwd, 'CLAUDE.md')) ||
                  this.commandExists('claude'),
        reason: '.claude/ or CLAUDE.md or claude command'
      },
      {
        name: 'cursor',
        detected: fs.existsSync(path.join(cwd, '.cursor')) ||
                  fs.existsSync(path.join(cwd, '.cursorrules')) ||
                  this.commandExists('cursor'),
        reason: '.cursor/ or .cursorrules or cursor command'
      },
      {
        name: 'opencode',
        detected: fs.existsSync(path.join(cwd, '.opencode')) ||
                  this.commandExists('opencode'),
        reason: '.opencode/ or opencode command'
      },
      {
        name: 'copilot',
        detected: fs.existsSync(path.join(cwd, '.github')) ||
                  this.commandExists('gh'),
        reason: '.github/ or gh command'
      }
    ];

    return tools;
  }

  private commandExists(cmd: string): boolean {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private getToolsToGenerate(toolsOption: string | undefined, detected: ToolDetection[]): string[] {
    if (toolsOption) {
      if (toolsOption === 'all') {
        return ['claude', 'cursor', 'opencode', 'copilot'];
      }
      return toolsOption.split(',').map(t => t.trim());
    }

    const detectedTools = detected.filter(t => t.detected).map(t => t.name);
    return detectedTools.length > 0 ? detectedTools : ['claude', 'cursor', 'opencode', 'copilot'];
  }

  private getFilesToCreate(tools: string[]): FileToCreate[] {
    const files: FileToCreate[] = [];

    if (tools.includes('claude')) {
      files.push({ path: 'CLAUDE.md', template: 'CLAUDE.md.tpl', tool: 'claude' });
      files.push({ path: '.claude/instructions.md', template: 'CLAUDE.md.tpl', tool: 'claude' });
    }

    if (tools.includes('cursor')) {
      files.push({ path: '.cursorrules', template: 'cursorrules.tpl', tool: 'cursor' });
    }

    if (tools.includes('opencode')) {
      files.push({ path: '.opencode/config.json', template: 'opencode-config.json.tpl', tool: 'opencode' });
    }

    if (tools.includes('copilot')) {
      files.push({ path: '.github/copilot-instructions.md', template: 'copilot-instructions.md.tpl', tool: 'copilot' });
    }

    return files;
  }

  private async dryRun(files: FileToCreate[], options: any): Promise<CommandResult> {
    const projectName = this.getProjectName();
    const adtVersion = this.getAdtVersion();

    const output = this.formatDryRun(files, projectName, adtVersion, options);

    return {
      ok: true,
      command: 'init',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      dryRun: true,
      files: files.map(f => f.path),
    };
  }

  private async createFiles(files: FileToCreate[], options: any): Promise<CommandResult> {
    const projectName = this.getProjectName();
    const adtVersion = this.getAdtVersion();
    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const fullPath = path.join(process.cwd(), file.path);

      if (fs.existsSync(fullPath) && !options.force) {
        const shouldOverwrite = await this.askUser(file.path);
        if (!shouldOverwrite) {
          skipped.push(file.path);
          continue;
        }
      }

      try {
        const templatePath = path.join(this.templatesDir, file.template);
        let content = fs.readFileSync(templatePath, 'utf-8');

        content = this.renderTemplate(content, projectName, adtVersion);

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content);
        created.push(file.path);
      } catch (error: any) {
        errors.push(`${file.path}: ${error.message}`);
      }
    }

    const output = this.formatResult(created, skipped, errors, options);

    return {
      ok: errors.length === 0,
      command: 'init',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      created,
      skipped,
      errors,
    };
  }

  private getProjectName(): string {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.name || path.basename(process.cwd());
      }
    } catch {
      // Ignore
    }
    return path.basename(process.cwd());
  }

  private getAdtVersion(): string {
    try {
      const pkgPath = path.join(__dirname, '../../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private renderTemplate(content: string, projectName: string, adtVersion: string): string {
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
      .replace(/\{\{ADT_VERSION\}\}/g, adtVersion);
  }

  private async askUser(filePath: string): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`File ${filePath} exists. Overwrite? (y/n): `, (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  private formatDryRun(files: FileToCreate[], projectName: string, adtVersion: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`dry-run: true`);
      lines.push(`project: ${projectName}`);
      lines.push(`adt: v${adtVersion}`);
      lines.push(`files: ${files.length}`);
      files.forEach(f => {
        const templatePath = path.join(this.templatesDir, f.template);
        const content = fs.readFileSync(templatePath, 'utf-8');
        const preview = content.split('\n').slice(0, 5).join('\n');
        lines.push(``);
        lines.push(`${f.path}:`);
        lines.push(preview);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'init',
        dryRun: true,
        project: projectName,
        adtVersion,
        files: files.map(f => ({ path: f.path, template: f.template })),
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('dry-run: true');
      lines.push(`project: ${projectName}`);
      lines.push(`adt-version: v${adtVersion}`);
      lines.push('===');
      lines.push(`files to create: ${files.length}`);
      files.forEach(f => {
        const templatePath = path.join(this.templatesDir, f.template);
        const content = fs.readFileSync(templatePath, 'utf-8');
        const preview = content.split('\n').slice(0, 5).join('\n');
        lines.push(``);
        lines.push(`${f.path}`);
        lines.push('---');
        lines.push(preview);
        lines.push('---');
      });
      return lines.join('\n');
    }
  }

  private formatResult(created: string[], skipped: string[], errors: string[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      created.forEach(f => lines.push(`created ${f}`));
      skipped.forEach(f => lines.push(`skipped ${f}`));
      errors.forEach(e => lines.push(`error ${e}`));
      lines.push(`---`);
      lines.push(`${created.length} created  ${skipped.length} skipped  ${errors.length} errors`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: errors.length === 0,
        command: 'init',
        created,
        skipped,
        errors,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push(`ok: ${errors.length === 0 ? 'true' : 'false'}`);
      lines.push(`project: ${this.getProjectName()}`);
      lines.push('===');
      created.forEach(f => lines.push(`created  ${f}`));
      skipped.forEach(f => lines.push(`skipped  ${f}`));
      errors.forEach(e => lines.push(`error    ${e}`));
      lines.push('---');
      lines.push(`${created.length} files created  ${skipped.length} skipped  ${errors.length} errors`);
      if (created.length > 0 && errors.length === 0) {
        lines.push(`run: adt doctor`);
      }
      return lines.join('\n');
    }
  }

  protected parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--tools') {
        options.tools = args[++i];
      } else if (arg === '--force') {
        options.force = true;
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg === '--fmt') {
        options.fmt = args[++i];
      }
    }

    return options;
  }
}
