import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config, OutputFormat } from '../types';

const DEFAULT_CONFIG: Config = {
  defaultFmt: 'normal',
  defaultLines: 100,
  maxCatLines: 500,
  maxGrepResults: 100,
  backupRetentionDays: 30,
  excludeByDefault: ['node_modules', 'dist', '.git', 'build', 'coverage', '.next'],
  tokenWarningThreshold: 1000,
  autoBackup: true,
  defaultShell: 'auto',
  gitSafetyChecks: true,
  patchVerifyBeforeApply: true,
};

export class ConfigManager {
  public config: Config;
  private configPath: string;
  private adtDir: string;

  constructor() {
    this.adtDir = path.join(os.homedir(), '.adt');
    this.configPath = path.join(this.adtDir, 'config.json');
    this.config = this.loadConfig();
    this.ensureAdtDir();
  }

  private ensureAdtDir(): void {
    if (!fs.existsSync(this.adtDir)) {
      fs.mkdirSync(this.adtDir, { recursive: true });
      
      const subdirs = [
        'sessions',
        'backups',
        'checkpoints',
        'context',
        'tags',
        'git-ops',
      ];

      subdirs.forEach(dir => {
        const dirPath = path.join(this.adtDir, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });
    }
  }

  private loadConfig(): Config {
    if (fs.existsSync(this.configPath)) {
      try {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...loaded };
      } catch (error) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  }

  saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Returns excludeByDefault as proper fast-glob patterns.
   * Config stores simple names like 'node_modules'; this converts them to the form needed by fast-glob.
   */
  getExcludeGlobs(): string[] {
    return this.config.excludeByDefault.map((name: string) => {
      if (name.includes('*') || name.includes('/')) {
        return name; // already a glob pattern
      }
      return `**/${name}/**`;
    });
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveConfig();
  }

  getAll(): Config {
    return { ...this.config };
  }

  getDefaultFormat(): OutputFormat {
    return this.config.defaultFmt;
  }

  setDefaultFormat(format: OutputFormat): void {
    this.config.defaultFmt = format;
    this.saveConfig();
  }

  getAdtDir(): string {
    return this.adtDir;
  }

  getSessionsDir(): string {
    return path.join(this.adtDir, 'sessions');
  }

  getBackupsDir(): string {
    return path.join(this.adtDir, 'backups');
  }

  getCheckpointsDir(): string {
    return path.join(this.adtDir, 'checkpoints');
  }

  getContextDir(project?: string): string {
    if (project) {
      const projectDir = path.join(this.adtDir, 'context', project);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      return projectDir;
    }
    return path.join(this.adtDir, 'context');
  }

  getTagsDir(project?: string): string {
    if (project) {
      const projectDir = path.join(this.adtDir, 'tags', project);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      return projectDir;
    }
    return path.join(this.adtDir, 'tags');
  }
}
