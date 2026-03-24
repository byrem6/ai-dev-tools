export type OutputFormat = 'slim' | 'normal' | 'full' | 'json';

export interface CommandResult {
  ok: boolean;
  command: string;
  tokenEstimate?: number;
  content?: string;
  [key: string]: any;
}

export interface SlimFormat extends CommandResult {
  format: 'slim';
}

export interface NormalFormat extends CommandResult {
  format: 'normal';
}

export interface JsonFormat extends CommandResult {
  format: 'json';
}

export interface ErrorResult {
  ok: false;
  command: string;
  error: string;
  code: string;
  path?: string;
  tip?: string;
}

export interface FileLocation {
  file: string;
  line: number;
  col?: number;
}

export interface MatchResult extends FileLocation {
  text: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface SymbolInfo {
  name: string;
  type: 'class' | 'function' | 'method' | 'interface' | 'type' | 'enum' | 'const' | 'variable';
  line: number;
  end?: number;
  exported?: boolean;
  async?: boolean;
  params?: string[];
  returns?: string;
  members?: SymbolInfo[];
}

export interface FileInfo {
  path: string;
  size: number;
  sizeHuman: string;
  totalLines: number;
  encoding: string;
  confidence: number;
  hasBOM: boolean;
  lineEnding: 'LF' | 'CRLF' | 'MIXED';
  isBinary: boolean;
  language?: string;
  modified?: string;
}

export interface SessionEvent {
  timestamp: string;
  command: string;
  args: string[];
  duration?: number;
  success: boolean;
  tokenEstimate?: number;
}

export interface Session {
  id: string;
  startTime: string;
  endTime?: string;
  events: SessionEvent[];
  tokenUsage: number;
}

export interface Config {
  defaultFmt: OutputFormat;
  defaultLines: number;
  maxCatLines: number;
  maxGrepResults: number;
  backupRetentionDays: number;
  excludeByDefault: string[];
  tokenWarningThreshold: number;
  autoBackup: boolean;
  defaultShell: 'auto' | 'bash' | 'powershell' | 'cmd';
  gitSafetyChecks: boolean;
  patchVerifyBeforeApply: boolean;
}

export interface ImportInfo {
  source: string;
  type: 'named' | 'default' | 'namespace';
  specifiers?: string[];
  isExternal: boolean;
  resolvedPath?: string;
}

export interface ExportInfo {
  name: string;
  type: 'class' | 'function' | 'interface' | 'type' | 'enum' | 'const';
  line: number;
}
