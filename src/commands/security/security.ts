import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { TokenUtils } from '../../utils/token';
import { createError } from '../../core/error';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  description: string;
}

export class SecurityCommand extends Command {
  public getDescription(): string {
    return 'Security vulnerability scan';
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt || 'normal');

    return this.runWithLogging('security', args, async () => {
      const action = options.action || 'scan';
      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      switch (action) {
        case 'scan':
          return this.scanSecurity(targetPath, options);
        case 'secrets':
          return this.findSecrets(targetPath, options);
        case 'cve':
          return this.checkCVEs(options);
        default:
          return this.scanSecurity(targetPath, options);
      }
    });
  }

  private async scanSecurity(targetPath: string, options: any): Promise<CommandResult> {
    const issues: SecurityIssue[] = [];

    // Scan source files
    const files = await fg.glob('**/*.{ts,js,tsx,jsx,json,env,env.*}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const fileIssues = await this.scanFile(filePath);
      issues.push(...fileIssues);
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;

    return {
      ok: criticalCount === 0 && highCount === 0,
      command: 'security',
      action: 'scan',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(issues)),
      content: this.formatSecurityIssues(issues, options),
      issues,
      summary: {
        total: issues.length,
        critical: criticalCount,
        high: highCount,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length,
      },
    };
  }

  private async findSecrets(targetPath: string, options: any): Promise<CommandResult> {
    const issues: SecurityIssue[] = [];

    const files = await fg.glob('**/*.{ts,js,tsx,jsx,json,env,env.*}', {
      cwd: targetPath,
      onlyFiles: true,
      absolute: false,
      ignore: this.configManager.getExcludeGlobs(),
    });

    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/gi, type: 'API Key' },
      { pattern: /secret[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/gi, type: 'Secret Key' },
      { pattern: /password\s*[:=]\s*['"]([^'"]{8,})['"]/gi, type: 'Password' },
      { pattern: /token\s*[:=]\s*['"]([^'"]{20,})['"]/gi, type: 'Token' },
      { pattern: /aws[_-]?(access[_-]?key[_-]?id|secret[_-]?access[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/gi, type: 'AWS Credentials' },
      { pattern: /github[_-]?token\s*[:=]\s*['"]([^'"]{20,})['"]/gi, type: 'GitHub Token' },
      { pattern: /private[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/gi, type: 'Private Key' },
      { pattern: /(mongodb|mysql|postgres|redis)[:+]\/\/[^@]+:[^@]+@/gi, type: 'Database Connection String' },
    ];

    for (const file of files) {
      const filePath = path.join(targetPath, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const { pattern, type } of secretPatterns) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            pattern.lastIndex = 0;
            const match = pattern.exec(line);

            if (match) {
              issues.push({
                type: 'secret',
                severity: file.includes('.env') ? 'high' : 'critical',
                file: filePath,
                line: i + 1,
                description: `Potential ${type} found`,
              });
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      ok: issues.length === 0,
      command: 'security',
      action: 'secrets',
      tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(issues)),
      content: this.formatSecrets(issues, options),
      issues,
      total: issues.length,
    };
  }

  private async checkCVEs(options: any): Promise<CommandResult> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return {
        ok: true,
        command: 'security',
        action: 'cve',
        tokenEstimate: 30,
        content: 'No package.json found',
        vulnerabilities: [],
      };
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const vulnerabilities: any[] = [];
      
      // Check for known vulnerable versions (simplified)
      const knownVulnerabilities: Record<string, { version: string; severity: string; description: string }> = {
        'lodash': { version: '<4.17.21', severity: 'high', description: 'Prototype Pollution' },
        'express': { version: '<4.17.1', severity: 'high', description: 'Path Traversal' },
        'axios': { version: '<0.21.1', severity: 'medium', description: 'SSRF' },
      };

      for (const [pkg, version] of Object.entries(dependencies)) {
        const vuln = knownVulnerabilities[pkg];
        if (vuln) {
          vulnerabilities.push({
            package: pkg,
            version,
            severity: vuln.severity,
            description: vuln.description,
          });
        }
      }

      return {
        ok: vulnerabilities.length === 0,
        command: 'security',
        action: 'cve',
        tokenEstimate: TokenUtils.estimateTokens(JSON.stringify(vulnerabilities)),
        content: this.formatCVEs(vulnerabilities, options),
        vulnerabilities,
      };
    } catch (error) {
      return {
        ok: false,
        command: 'security',
        action: 'cve',
        tokenEstimate: 30,
        content: `Error reading package.json: ${error}`,
      };
    }
  }

  private async scanFile(filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for dangerous imports
      const dangerousImports = ['eval', 'child_process', 'fs', 'http', 'https'];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // eval usage
        if (/\beval\s*\(/.test(line)) {
          issues.push({
            type: 'dangerous-code',
            severity: 'high',
            file: filePath,
            line: i + 1,
            description: 'Use of eval() function',
          });
        }

        // innerHTML usage
        if (/innerHTML\s*=/.test(line)) {
          issues.push({
            type: 'xss',
            severity: 'medium',
            file: filePath,
            line: i + 1,
            description: 'Potential XSS vulnerability via innerHTML',
          });
        }

        // SQL injection patterns
        if (/\+.*?(SELECT|INSERT|UPDATE|DELETE)/i.test(line)) {
          issues.push({
            type: 'sql-injection',
            severity: 'high',
            file: filePath,
            line: i + 1,
            description: 'Potential SQL injection',
          });
        }

        // Hardcoded credentials
        if (/(password|secret|key)\s*[:=]\s*['"][^'"]{8,}['"]/.test(line)) {
          issues.push({
            type: 'hardcoded-secret',
            severity: 'critical',
            file: filePath,
            line: i + 1,
            description: 'Hardcoded credential detected',
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }

    return issues;
  }

  private formatSecurityIssues(issues: SecurityIssue[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = [`ok ${issues.filter(i => i.severity === 'critical').length === 0 ? 'true' : 'false'}`];
      issues.forEach(i => {
        lines.push(`${i.severity.toUpperCase()} ${i.file}${i.line ? ':' + i.line : ''}`);
        lines.push(`  ${i.description}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: issues.filter(i => i.severity === 'critical').length === 0,
        command: 'security',
        action: 'scan',
        issues,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: scan', '---'];

      if (issues.length === 0) {
        lines.push('No security issues found!');
        return lines.join('\n');
      }

      const grouped = issues.reduce((acc, issue) => {
        if (!acc[issue.severity]) acc[issue.severity] = [];
        acc[issue.severity].push(issue);
        return acc;
      }, {} as Record<string, SecurityIssue[]>);

      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        if (grouped[severity]) {
          lines.push(`---`);
          lines.push(`${severity.toUpperCase()} (${grouped[severity].length}):`);
          grouped[severity].forEach(i => {
            lines.push(`  ${i.file}${i.line ? ':' + i.line : ''}`);
            lines.push(`    ${i.description}`);
          });
        }
      });

      return lines.join('\n');
    }
  }

  private formatSecrets(issues: SecurityIssue[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = [`ok ${issues.length === 0 ? 'true' : 'false'}`];
      issues.forEach(i => {
        lines.push(`${i.severity.toUpperCase()} ${i.file}:${i.line}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: issues.length === 0,
        command: 'security',
        action: 'secrets',
        issues,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: secrets', '---'];

      if (issues.length === 0) {
        lines.push('No secrets found!');
        return lines.join('\n');
      }

      issues.forEach(i => {
        lines.push(`${i.severity.toUpperCase()}: ${i.file}:${i.line}`);
        lines.push(`  ${i.description}`);
      });

      return lines.join('\n');
    }
  }

  private formatCVEs(vulnerabilities: any[], options: any): string {
    if (options.fmt === 'slim') {
      const lines: string[] = [`ok ${vulnerabilities.length === 0 ? 'true' : 'false'}`];
      vulnerabilities.forEach(v => {
        lines.push(`${v.severity.toUpperCase()} ${v.package}@${v.version}`);
      });
      return lines.join('\n');
    } else if (options.fmt === 'json') {
      return JSON.stringify({
        ok: vulnerabilities.length === 0,
        command: 'security',
        action: 'cve',
        vulnerabilities,
      }, null, 2);
    } else {
      const lines: string[] = ['ok: true', 'action: cve', '---'];

      if (vulnerabilities.length === 0) {
        lines.push('No known vulnerabilities found!');
        return lines.join('\n');
      }

      vulnerabilities.forEach(v => {
        lines.push(`${v.severity.toUpperCase()}: ${v.package}@${v.version}`);
        lines.push(`  ${v.description}`);
      });

      return lines.join('\n');
    }
  }

  private parseArgs(args: string[]): any {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--fmt' && args[i + 1]) {
        options.fmt = args[++i];
      } else if (arg === 'scan' || arg === 'secrets' || arg === 'cve') {
        options.action = arg;
      } else if (arg === '--path' && args[i + 1]) {
        options.path = args[++i];
      }
    }

    return options;
  }
}
