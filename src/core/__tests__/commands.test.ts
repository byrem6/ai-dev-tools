/**
 * Smoke tests for critical ADT commands.
 * Verifies that parseArgs correctly handles flags vs positional args.
 */

import { FormatManager } from '../format';
import { ConfigManager } from '../config';
import { SessionManager } from '../session';
import { MapCommand } from '../../commands/map/map';
import { WhereCommand } from '../../commands/search/where';
import { FindCommand } from '../../commands/search/find';
import { GrepCommand } from '../../commands/search/grep';
import { DefCommand } from '../../commands/symbol/def';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../../src');

function makeCommand<T>(Ctor: new (f: FormatManager, c: ConfigManager, s: SessionManager) => T): T {
  const cfg = new ConfigManager();
  const fmt = new FormatManager(cfg.getDefaultFormat());
  const sess = new SessionManager(cfg);
  return new Ctor(fmt, cfg, sess);
}

describe('parseArgs: flag-as-path regression', () => {
  test('map --fmt slim should not treat "--fmt" as path', async () => {
    const cmd = makeCommand(MapCommand);
    const result = await cmd.execute('--fmt', 'slim');
    expect(result.ok).toBe(true);
  });

  test('map src --fmt slim should use src as path', async () => {
    const cmd = makeCommand(MapCommand);
    const result = await cmd.execute('src', '--fmt', 'slim');
    expect(result.ok).toBe(true);
  });

  test('where Symbol --fmt slim should not treat "--fmt" as path', async () => {
    const cmd = makeCommand(WhereCommand);
    const result = await cmd.execute('MapCommand', '--fmt', 'slim');
    expect(result.ok).toBe(true);
  });

  test('def Symbol --fmt slim should not treat "--fmt" as path', async () => {
    const cmd = makeCommand(DefCommand);
    const result = await cmd.execute('MapCommand', '--fmt', 'slim');
    expect(result.ok).toBe(true);
  });

  test('grep pattern --fmt slim should not treat "--fmt" as path', async () => {
    const cmd = makeCommand(GrepCommand);
    const result = await cmd.execute('MapCommand', '--fmt', 'slim');
    expect(result.ok).toBe(true);
  });
});

describe('find --name glob fix', () => {
  test('find . --name "*.ts" should return TypeScript files recursively', async () => {
    const cmd = makeCommand(FindCommand);
    const result = await cmd.execute('.', '--name', '*.ts', '--fmt', 'slim');
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(10);
    // Should find files in subdirectories, not just root
    const paths: string[] = (result.results as any[]).map((r: any) => r.path);
    const hasSubdirFile = paths.some((p: string) => p.includes('/') || p.includes('\\'));
    expect(hasSubdirFile).toBe(true);
  });

  test('find src --name "*.ts" should only return files under src/', async () => {
    const cmd = makeCommand(FindCommand);
    const result = await cmd.execute('src', '--name', '*.ts', '--fmt', 'slim');
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(5);
  });
});

describe('where: symbol search', () => {
  test('where ReadCommand should find class definition', async () => {
    const cmd = makeCommand(WhereCommand);
    const result = await cmd.execute('ReadCommand', 'src', '--fmt', 'slim');
    expect(result.ok).toBe(true);
    const symbols: any[] = (result.results as any[]).filter((r: any) => r.type === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols[0].name).toBe('ReadCommand');
  });
});

describe('ConfigManager', () => {
  test('getExcludeGlobs returns proper glob patterns', () => {
    const cfg = new ConfigManager();
    const globs = cfg.getExcludeGlobs();
    expect(globs).toContain('**/node_modules/**');
    expect(globs).toContain('**/dist/**');
  });

  test('get excludeByDefault returns simple names (for name-based matching)', () => {
    const cfg = new ConfigManager();
    const names = cfg.get('excludeByDefault');
    expect(names).toContain('node_modules');
    expect(names).toContain('dist');
  });
});
