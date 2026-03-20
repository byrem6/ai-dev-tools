export const ERROR_CODES = {
  ENOENT: 'File not found',
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
    ENOENT: path ? `adt find ${path.split('/').pop()?.split('.')[0]} --fmt slim` : undefined,
    EACCES: 'Check file permissions',
    EBINARY: 'Confirm with adt info',
    ETOOBIG: 'Read with --start/--end',
    EENCODING: 'Force with --encoding latin-1',
    ENOMATCH: 'Try refs or search',
    ECONFLICT: 'Re-confirm with verify',
    ENOBACKUP: 'Manual restore required',
    EGIT: 'Init git or change directory',
    EEXEC: 'Read stderr field',
    ETIMEOUT: 'Increase --timeout',
    EMERGE_CONFLICT: 'Resolve conflicts manually',
    EEXIST: 'Use --overwrite to replace',
    ENOTEMPTY: 'Use --force to delete non-empty directories',
  };

  return new AdtError(code, path, tips[code]);
}
