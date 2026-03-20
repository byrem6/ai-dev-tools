import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionEvent } from '../types';
import { ConfigManager } from './config';

export class SessionManager {
  private session: Session;
  private configManager: ConfigManager;
  private eventsFile: string;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    const sessionId = `sess_${Date.now()}_${uuidv4().slice(0, 4)}`;
    this.session = {
      id: sessionId,
      startTime: new Date().toISOString(),
      events: [],
      tokenUsage: 0,
    };

    const sessionsDir = this.configManager.getSessionsDir();
    const sessionDir = path.join(
      sessionsDir,
      new Date().toISOString().split('T')[0]
    );
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    this.eventsFile = path.join(sessionDir, `${sessionId}.jsonl`);
    this.saveSession();
  }

  logEvent(
    command: string,
    args: string[],
    success: boolean,
    tokenEstimate?: number,
    duration?: number
  ): void {
    const event: SessionEvent = {
      timestamp: new Date().toISOString(),
      command,
      args,
      duration,
      success,
      tokenEstimate,
    };

    this.session.events.push(event);
    
    if (tokenEstimate) {
      this.session.tokenUsage += tokenEstimate;
    }

    try {
      fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n');
    } catch (error) {
      console.error('Failed to write event:', error);
    }

    this.saveSession();
  }

  private saveSession(): void {
    const sessionFile = path.join(
      this.configManager.getSessionsDir(),
      'session.json'
    );
    try {
      fs.writeFileSync(sessionFile, JSON.stringify(this.session, null, 2));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  getSession(): Session {
    return { ...this.session };
  }

  getEvents(command?: string): SessionEvent[] {
    if (command) {
      return this.session.events.filter(e => e.command === command);
    }
    return [...this.session.events];
  }

  getTokenUsage(): number {
    return this.session.tokenUsage;
  }

  getDuration(): string {
    const startTime = new Date(this.session.startTime);
    const endTime = this.session.endTime ? new Date(this.session.endTime) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  close(): void {
    this.session.endTime = new Date().toISOString();
    this.saveSession();
  }

  static cleanupOldSessions(configManager: ConfigManager): void {
    const sessionsDir = configManager.getSessionsDir();
    const retentionDays = configManager.get('backupRetentionDays');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryDate = new Date(entry.name);
          if (entryDate < cutoffDate) {
            const entryPath = path.join(sessionsDir, entry.name);
            fs.rmSync(entryPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }
}
