export const ERROR_CODES = {
  ENOENT: 'File not found',
  ENOTDIR: 'Not a directory',
  EACCES: 'Permission denied',
  EBINARY: 'Binary file',
  ETOOBIG: 'File too large',
  EENCODING: 'Encoding undetectable',
  ENOMATCH: 'Symbol not found',
  ECONFLICT: 'Line mismatch in patch',
  ENOBACKUP: 'No backup exists',
  EGIT: 'Git error',
  EEXEC: 'Command failed',
  ETIMEOUT: 'Command timed out',
  EMERGE_CONFLICT: 'Git merge conflict',
  EEXIST: 'File already exists',
  ENOTEMPTY: 'Directory not empty',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AdtError extends Error {
  code: ErrorCode;
  path?: string;
  tip?: string;

  constructor(code: ErrorCode, path?: string, tip?: string) {
    super(ERROR_CODES[code]);
    this.name = 'AdtError';
    this.code = code;
    this.path = path;
    this.tip = tip;
  }

  toSlim(): string {
    let output = `ok false\n${this.code}`;
    if (this.path) {
      output += ` ${this.path}`;
    }
    if (this.tip) {
      output += `\ntip: ${this.tip}`;
    }
    return output;
  }

  toJson(): string {
    const obj: any = {
      ok: false,
      error: ERROR_CODES[this.code],
      code: this.code,
    };
    if (this.path) {
      obj.path = this.path;
    }
    if (this.tip) {
      obj.tip = this.tip;
    }
    return JSON.stringify(obj, null, 2);
  }

  toNormal(): string {
    let output = `ok: false\n`;
    output += `error: ${ERROR_CODES[this.code]}\n`;
    output += `code: ${this.code}`;
    if (this.path) {
      output += `\npath: ${this.path}`;
    }
    if (this.tip) {
      output += `\ntip: ${this.tip}`;
    }
    return output;
  }
}

export function createError(
  code: ErrorCode,
  path?: string,
  context?: string
): AdtError {
  const tips: Record<ErrorCode, string | undefined> = {
    ENOENT: path 
      ? `File not found: ${path}\n  Try: adt find ${path.split(/[/\\]/).pop()?.split('.')[0]} --fmt slim\n  Or: adt tree . --fmt slim`
      : 'Path not found. Try: adt tree . --fmt slim',
    ENOTDIR: `Not a directory: ${path}\n  Use 'adt info ${path}' for file information`,
    EACCES: `Permission denied: ${path}\n  Check file permissions or run with appropriate privileges`,
    EBINARY: `Binary file detected: ${path}\n  Confirm with: adt info ${path} --fmt slim\n  Use --encoding to force read`,
    ETOOBIG: `File too large: ${path}\n  Read with: adt read ${path} --start 1 --lines 100 --fmt normal\n  Or: adt outline ${path} --fmt slim`,
    EENCODING: `Encoding issue detected: ${path}\n  Force with: adt read ${path} --encoding latin-1 --fmt normal`,
    ENOMATCH: `Symbol not found: ${context || path}\n  Try:\n  - adt grep "${context || path}" . --fmt slim\n  - adt refs "${context || path}" . --fmt slim\n  - adt symbols ${path || '.'} --fmt normal`,
    ECONFLICT: `Patch conflict detected\n  Re-confirm with: adt verify ${path} --lines X:Y --contains "expected text" --fmt slim`,
    ENOBACKUP: `No backup found for: ${path}\n  Manual restore required from: ~/.adt/backups/`,
    EGIT: `Git error: ${context}\n  Try:\n  - adt git status --fmt slim\n  - git init (if not a git repo)\n  - Check if you're in the right directory`,
    EEXEC: `Command failed: ${context}\n  Check stderr field for details\n  Try: adt exec "${context}" --fmt normal`,
    ETIMEOUT: `Command timed out: ${context}\n  Increase timeout: adt exec "${context}" --timeout 30000`,
    EMERGE_CONFLICT: `Merge conflict detected in: ${path}\n  Resolve conflicts manually then:\n  - git add .\n  - adt git commit --message "Resolve merge conflicts"`,
    EEXIST: `File already exists: ${path}\n  Use: adt create ${path} --overwrite to replace`,
    ENOTEMPTY: `Directory not empty: ${path}\n  Use: adt delete ${path} --force to delete non-empty directories`,
  };

  return new AdtError(code, path, tips[code]);
}
