import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { HashUtils } from '../../utils/hash';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface SessionEvent {
  timestamp: string;
  command: string;
  args: string[];
  exitCode: number;
  duration: number;
  tokens: number;
}

interface CheckpointData {
  id: string;
  timestamp: string;
  name: string;
  files: {
    path: string;
    hash: string;
    backup: string;
  }[];
}

export class SessionCommand extends Command {
  public getDescription(): string {
    return 'Session management';
  }

  private sessionFile: string;
  private eventsFile: string;
  private checkpointsDir: string;
  private backupsDir: string;

  constructor(formatManager: any, configManager: any, sessionManager: any) {
    super(formatManager, configManager, sessionManager);
    const adtDir = this.configManager.getAdtDir();
    this.sessionFile = path.join(adtDir, 'session.json');
    this.eventsFile = path.join(adtDir, 'events.jsonl');
    this.checkpointsDir = path.join(adtDir, 'checkpoints');
    this.backupsDir = path.join(adtDir, 'backups');
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('session', args, async () => {
      const subCommand = options._[0] || 'show';

      switch (subCommand) {
        case 'show':
        case 'status':
          return this.showSession(options);
        case 'diff':
          return this.showDiff(options);
        case 'undo':
          return this.undoLast(options);
        case 'checkpoint':
          return this.createCheckpoint(options);
        case 'restore':
          return this.restoreCheckpoint(options);
        case 'list':
          return this.listCheckpoints(options);
        case 'clear':
          return this.clearSession(options);
        case 'resume':
          return this.resumeSession(options);
        default:
          return this.showSession(options);
      }
    });
  }

  private async showSession(options: any): Promise<CommandResult> {
    const session = this.loadSession();
    const events = this.loadEvents();

    const output = this.formatSession(session, events, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      session,
      events,
    };
  }

  private async showDiff(options: any): Promise<CommandResult> {
    const file = options.file;
    if (!file) {
      throw new Error('File path required for diff. Use: adt session diff --file <path>');
    }

    const session = this.loadSession();
    const lastEvents = this.loadEvents().slice(-5);

    const changes: any[] = [];
    lastEvents.forEach((event: any) => {
      if (event.command === 'patch' || event.command === 'replace') {
        const targetFile = event.args?.[0];
        if (targetFile && targetFile.includes(file)) {
          changes.push(event);
        }
      }
    });

    const output = this.formatDiff(file, changes, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      file,
      changes,
    };
  }

  private async undoLast(options: any): Promise<CommandResult> {
    const events = this.loadEvents();
    const writeEvents = events.filter((e: any) => e.command === 'patch' || e.command === 'replace' || e.command === 'delete');

    if (writeEvents.length === 0) {
      const output = this.formatSimpleResult('No write operations to undo', options);
      return {
        ok: true,
        command: 'session',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
      };
    }

    const lastEvent = writeEvents[writeEvents.length - 1];
    const backupPath = lastEvent.backup;

    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error('No backup found for last operation');
    }

    const targetFile = lastEvent.args?.[0] || lastEvent.target;
    if (!targetFile) {
      throw new Error('Cannot determine target file from last operation');
    }

    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    fs.writeFileSync(targetFile, backupContent);

    this.logEvent('undo', [targetFile], 0, 0, 0);

    const output = this.formatUndo(targetFile, backupPath, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      restoredFile: targetFile,
    };
  }

  private async createCheckpoint(options: any): Promise<CommandResult> {
    const name = options.name || options.message || 'checkpoint';
    const targetPath = options.path || process.cwd();

    if (!fs.existsSync(this.checkpointsDir)) {
      fs.mkdirSync(this.checkpointsDir, { recursive: true });
    }

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    const checkpointId = HashUtils.hashString(Date.now().toString() + name).substring(0, 8);
    const checkpointDir = path.join(this.checkpointsDir, checkpointId);
    fs.mkdirSync(checkpointDir, { recursive: true });

    const files = this.snapshotDirectory(targetPath, checkpointDir);

    const checkpoint: CheckpointData = {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      name,
      files,
    };

    const checkpointFile = path.join(checkpointDir, 'metadata.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));

    const output = this.formatCheckpoint(checkpoint, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      checkpoint,
    };
  }

  private async restoreCheckpoint(options: any): Promise<CommandResult> {
    const checkpointId = options.id || options.checkpoint;
    if (!checkpointId) {
      throw new Error('Checkpoint ID required. Use: adt session restore --id <checkpoint-id>');
    }

    const checkpointDir = path.join(this.checkpointsDir, checkpointId);
    if (!fs.existsSync(checkpointDir)) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const metadataFile = path.join(checkpointDir, 'metadata.json');
    if (!fs.existsSync(metadataFile)) {
      throw new Error('Checkpoint metadata not found');
    }

    const checkpoint: CheckpointData = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));

    checkpoint.files.forEach((fileData) => {
      const backupPath = path.join(checkpointDir, path.basename(fileData.path) + '.backup');
      if (fs.existsSync(backupPath)) {
        const content = fs.readFileSync(backupPath, 'utf-8');
        fs.writeFileSync(fileData.path, content);
      }
    });

    this.logEvent('restore', [checkpointId], 0, 0, 0);

    const output = this.formatRestore(checkpoint, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      checkpoint,
    };
  }

  private async listCheckpoints(options: any): Promise<CommandResult> {
    const checkpoints: CheckpointData[] = [];

    if (!fs.existsSync(this.checkpointsDir)) {
      const output = this.formatCheckpointList([], options);
      return {
        ok: true,
        command: 'session',
        tokenEstimate: TokenUtils.estimateTokens(output),
        content: output,
        checkpoints: [],
      };
    }

    const dirs = fs.readdirSync(this.checkpointsDir);
    dirs.forEach((dir) => {
      const metadataFile = path.join(this.checkpointsDir, dir, 'metadata.json');
      if (fs.existsSync(metadataFile)) {
        try {
          const checkpoint: CheckpointData = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
          checkpoints.push(checkpoint);
        } catch {
          // Invalid checkpoint, skip
        }
      }
    });

    checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const output = this.formatCheckpointList(checkpoints, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      checkpoints,
    };
  }

  private async clearSession(options: any): Promise<CommandResult> {
    const eventsCleared = this.clearEvents();
    const sessionCleared = this.clearSessionData();

    const output = this.formatClear(eventsCleared, sessionCleared, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
    };
  }

  private async resumeSession(options: any): Promise<CommandResult> {
    const events = this.loadEvents();
    const lastEvents = events.slice(-10);

    const context: any = {
      lastCommands: lastEvents.map((e: any) => e.command),
      lastFiles: this.getUniqueFiles(lastEvents),
      lastWorkingDir: lastEvents.length > 0 ? lastEvents[lastEvents.length - 1].cwd : process.cwd(),
    };

    const output = this.formatResume(context, options);
    return {
      ok: true,
      command: 'session',
      tokenEstimate: TokenUtils.estimateTokens(output),
      content: output,
      context,
    };
  }

  private loadSession(): any {
    if (!fs.existsSync(this.sessionFile)) {
      return {
        startTime: new Date().toISOString(),
        commandsRun: 0,
        totalTokens: 0,
        totalDuration: 0,
      };
    }

    try {
      return JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
    } catch {
      return {
        startTime: new Date().toISOString(),
        commandsRun: 0,
        totalTokens: 0,
        totalDuration: 0,
      };
    }
  }

  private loadEvents(): any[] {
    if (!fs.existsSync(this.eventsFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.eventsFile, 'utf-8');
      return content.split('\n')
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private logEvent(command: string, args: string[], exitCode: number, duration: number, tokens: number): void {
    const event: SessionEvent = {
      timestamp: new Date().toISOString(),
      command,
      args,
      exitCode,
      duration,
      tokens,
    };

    fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n');
  }

  private clearEvents(): number {
    if (!fs.existsSync(this.eventsFile)) {
      return 0;
    }

    const events = this.loadEvents();
    fs.unlinkSync(this.eventsFile);
    return events.length;
  }

  private clearSessionData(): boolean {
    if (fs.existsSync(this.sessionFile)) {
      fs.unlinkSync(this.sessionFile);
      return true;
    }
    return false;
  }

  private snapshotDirectory(dir: string, checkpointDir: string): CheckpointData['files'] {
    const files: CheckpointData['files'] = [];

    const snapshotPath = (p: string) => {
      const stats = fs.statSync(p);
      if (stats.isFile() && !p.includes('node_modules') && !p.includes('.git')) {
        const relativePath = path.relative(dir, p);
        const content = fs.readFileSync(p, 'utf-8');
        const hash = HashUtils.hashString(content);
        const backupPath = path.join(checkpointDir, path.basename(p) + '.backup');
        fs.writeFileSync(backupPath, content);

        files.push({
          path: relativePath,
          hash,
          backup: backupPath,
        });
      } else if (stats.isDirectory() && !p.includes('node_modules') && !p.includes('.git')) {
        try {
          const entries = fs.readdirSync(p);
          entries.forEach((entry) => {
            snapshotPath(path.join(p, entry));
          });
        } catch {
          // Permission denied or other error, skip
        }
      }
    };

    snapshotPath(dir);
    return files;
  }

  private getUniqueFiles(events: any[]): string[] {
    const files = new Set<string>();
    events.forEach((e) => {
      if (e.args && e.args.length > 0) {
        e.args.forEach((arg: string) => {
          if (arg.includes('.') && !arg.startsWith('--')) {
            files.add(arg);
          }
        });
      }
    });
    return Array.from(files);
  }

  private formatSession(session: any, events: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`commands: ${session.commandsRun || 0}`);
      lines.push(`tokens: ${session.totalTokens || 0}`);
      lines.push(`duration: ${Math.round((session.totalDuration || 0) / 1000)}s`);
      lines.push(`events: ${events.length}`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        session,
        eventsCount: events.length,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('command: session');
      lines.push('===');
      lines.push(`commands-run: ${session.commandsRun || 0}`);
      lines.push(`total-tokens: ${session.totalTokens || 0}`);
      lines.push(`total-duration: ${Math.round((session.totalDuration || 0) / 1000)}s`);
      lines.push('===');
      lines.push('recent-events:');
      events.slice(-10).forEach((e, i) => {
        lines.push(`  ${i + 1}. ${e.command} (${e.timestamp})`);
      });
      return lines.join('\n');
    }
  }

  private formatDiff(file: string, changes: any[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (changes.length === 0) {
        return `ok true\nno changes found for ${file}`;
      }
      const lines: string[] = [];
      lines.push(`file: ${file}`);
      lines.push(`changes: ${changes.length}`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'diff',
        file,
        changes,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`file: ${file}`);
      lines.push('===');
      if (changes.length === 0) {
        lines.push('No recent changes');
      } else {
        changes.forEach((c, i) => {
          lines.push(`${i + 1}. ${c.command} at ${c.timestamp}`);
        });
      }
      return lines.join('\n');
    }
  }

  private formatUndo(file: string, backupPath: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true\nrestored: ${file}\nfrom: ${backupPath}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'undo',
        restoredFile: file,
        backupPath,
      }, null, 2);
    } else {
      return `ok: true\naction: undo\nrestored: ${file}\nbackup: ${backupPath}\nstatus: success`;
    }
  }

  private formatCheckpoint(checkpoint: CheckpointData, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true\ncheckpoint: ${checkpoint.id}\nname: ${checkpoint.name}\nfiles: ${checkpoint.files.length}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'checkpoint',
        checkpoint,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: checkpoint');
      lines.push(`id: ${checkpoint.id}`);
      lines.push(`name: ${checkpoint.name}`);
      lines.push(`files: ${checkpoint.files.length}`);
      lines.push(`timestamp: ${checkpoint.timestamp}`);
      return lines.join('\n');
    }
  }

  private formatRestore(checkpoint: CheckpointData, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true\nrestored: ${checkpoint.id}\nfiles: ${checkpoint.files.length}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'restore',
        checkpoint,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: restore');
      lines.push(`checkpoint: ${checkpoint.id}`);
      lines.push(`name: ${checkpoint.name}`);
      lines.push(`files-restored: ${checkpoint.files.length}`);
      lines.push('status: success');
      return lines.join('\n');
    }
  }

  private formatCheckpointList(checkpoints: CheckpointData[], options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      if (checkpoints.length === 0) {
        return 'ok true\ncheckpoints: 0';
      }
      const lines: string[] = [];
      lines.push(`checkpoints: ${checkpoints.length}`);
      checkpoints.forEach((c) => {
        lines.push(`${c.id}  ${c.name}  ${c.timestamp.split('T')[0]}  ${c.files.length} files`);
      });
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'list',
        count: checkpoints.length,
        checkpoints,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push(`checkpoints: ${checkpoints.length}`);
      lines.push('===');
      checkpoints.forEach((c) => {
        lines.push(`${c.id}`);
        lines.push(`  name: ${c.name}`);
        lines.push(`  date: ${c.timestamp}`);
        lines.push(`  files: ${c.files.length}`);
      });
      return lines.join('\n');
    }
  }

  private formatClear(eventsCleared: number, sessionCleared: boolean, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`ok true`);
      lines.push(`events-cleared: ${eventsCleared}`);
      lines.push(`session-cleared: ${sessionCleared}`);
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'clear',
        eventsCleared,
        sessionCleared,
      }, null, 2);
    } else {
      return `ok: true\naction: clear\nevents-cleared: ${eventsCleared}\nsession-cleared: ${sessionCleared}`;
    }
  }

  private formatResume(context: any, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      const lines: string[] = [];
      lines.push(`last-commands: ${context.lastCommands.length}`);
      context.lastCommands.slice(-5).forEach((c: string) => {
        lines.push(`  ${c}`);
      });
      if (context.lastFiles.length > 0) {
        lines.push(`last-files:`);
        context.lastFiles.slice(0, 5).forEach((f: string) => {
          lines.push(`  ${f}`);
        });
      }
      return lines.join('\n');
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        action: 'resume',
        context,
      }, null, 2);
    } else {
      const lines: string[] = [];
      lines.push('ok: true');
      lines.push('action: resume');
      lines.push('===');
      lines.push(`last-working-dir: ${context.lastWorkingDir}`);
      lines.push(`last-commands:`);
      context.lastCommands.slice(-10).forEach((c: string) => {
        lines.push(`  ${c}`);
      });
      if (context.lastFiles.length > 0) {
        lines.push(`last-files:`);
        context.lastFiles.forEach((f: string) => {
          lines.push(`  ${f}`);
        });
      }
      return lines.join('\n');
    }
  }

  private formatSimpleResult(message: string, options: any): string {
    const fmt = options.fmt || 'normal';

    if (fmt === 'slim') {
      return `ok true\n${message}`;
    } else if (fmt === 'json') {
      return JSON.stringify({
        ok: true,
        command: 'session',
        message,
      }, null, 2);
    } else {
      return `ok: true\nmessage: ${message}`;
    }
  }

  protected parseArgs(args: string[]): any {
    const options: any = {};
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (key === 'fmt') {
          options.fmt = args[++i];
        } else if (key === 'file') {
          options.file = args[++i];
        } else if (key === 'name' || key === 'message') {
          options.name = args[++i];
        } else if (key === 'path') {
          options.path = args[++i];
        } else if (key === 'id' || key === 'checkpoint') {
          options.id = args[++i];
        } else {
          options[key] = true;
        }
      } else {
        positional.push(arg);
      }
    }

    options._ = positional;
    return options;
  }
}
