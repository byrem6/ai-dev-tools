import crypto from 'crypto';
import fs from 'fs';

export class HashUtils {
  static hashFile(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): string {
    try {
      const content = fs.readFileSync(filePath);
      return HashUtils.hashContent(content, algorithm);
    } catch (error) {
      throw new Error(`Failed to hash file: ${error}`);
    }
  }

  static hashContent(content: Buffer | string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): string {
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
  }

  static hashString(str: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): string {
    return HashUtils.hashContent(str, algorithm);
  }

  static async hashFileAsync(
    filePath: string,
    algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(new Error(`Failed to hash file: ${error}`));
      });
    });
  }

  static generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static checksum(filePath: string): string {
    return HashUtils.hashFile(filePath, 'sha256');
  }
}
