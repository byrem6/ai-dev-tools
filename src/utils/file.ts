import fs from 'fs';
import path from 'path';
import { FileInfo } from '../types';

export class FileUtils {
  static fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  static isDirectory(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static isFile(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  static readFile(filePath: string, encoding?: BufferEncoding): string {
    try {
      if (encoding) {
        return fs.readFileSync(filePath, encoding);
      }

      const buffer = fs.readFileSync(filePath);
      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  static writeFile(filePath: string, content: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  static getFileInfo(filePath: string): FileInfo {
    try {
      const stats = fs.statSync(filePath);
      const buffer = fs.readFileSync(filePath);

      const size = stats.size;
      const sizeHuman = this.formatBytes(size);

      let encoding = 'utf-8';
      let confidence = 1.0;
      let isBinary = false;

      const content = buffer.toString('utf-8');
      const totalLines = content.split('\n').length;

      const hasBOM = buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF;

      const lineEnding = this.detectLineEnding(content);

      const nonPrintableRatio = this.getNonPrintableRatio(buffer);
      isBinary = nonPrintableRatio > 0.3;

      return {
        path: filePath,
        size,
        sizeHuman,
        totalLines,
        encoding,
        confidence,
        hasBOM,
        lineEnding,
        isBinary,
        modified: stats.mtime.toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error}`);
    }
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  static detectLineEnding(content: string): 'LF' | 'CRLF' | 'MIXED' {
    const hasCRLF = content.includes('\r\n');
    const hasLF = content.includes('\n') && !content.includes('\r\n');

    if (hasCRLF && hasLF) {
      return 'MIXED';
    }
    if (hasCRLF) {
      return 'CRLF';
    }
    return 'LF';
  }

  static getNonPrintableRatio(buffer: Buffer): number {
    let nonPrintable = 0;
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintable++;
      }
    }
    return nonPrintable / buffer.length;
  }

  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  static resolvePath(filePath: string, basePath?: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    if (basePath) {
      return path.resolve(basePath, filePath);
    }

    return path.resolve(filePath);
  }

  static getFileExtension(filePath: string): string {
    const ext = path.extname(filePath);
    return ext.startsWith('.') ? ext.slice(1) : ext;
  }

  static getLanguageFromExtension(ext: string): string {
    const langMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      scala: 'Scala',
      kt: 'Kotlin',
      swift: 'Swift',
      sh: 'Shell',
      bash: 'Bash',
      zsh: 'Zsh',
      ps1: 'PowerShell',
      sql: 'SQL',
      md: 'Markdown',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      less: 'LESS',
    };

    return langMap[ext.toLowerCase()] || 'Unknown';
  }
}
