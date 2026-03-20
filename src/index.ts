#!/usr/bin/env node

import { CLI } from './core/cli';
import { ReadCommand } from './commands/read/read';
import { OutlineCommand } from './commands/read/outline';
import { PeekCommand } from './commands/read/peek';
import { GrepCommand } from './commands/search/grep';
import { WhereCommand } from './commands/search/where';
import { FindCommand } from './commands/search/find';
import { SearchCommand } from './commands/search/search';
import { RefsCommand } from './commands/search/refs';
import { SymbolsCommand } from './commands/symbol/symbols';
import { SigCommand } from './commands/symbol/sig';
import { DefCommand } from './commands/symbol/def';
import { BodyCommand } from './commands/symbol/body';
import { CallersCommand } from './commands/symbol/callers';
import { CalleesCommand } from './commands/symbol/callees';
import { VerifyCommand } from './commands/edit/verify';
import { PatchCommand } from './commands/edit/patch';
import { ReplaceCommand } from './commands/edit/replace';
import { CreateCommand } from './commands/edit/create';
import { DeleteCommand } from './commands/edit/delete';
import { MoveCommand } from './commands/edit/move';
import { CopyCommand } from './commands/edit/copy';
import { RenameCommand } from './commands/edit/rename';
import { MapCommand } from './commands/map/map';
import { TreeCommand } from './commands/map/tree';
import { StatsCommand } from './commands/map/stats';
import { DepsCommand } from './commands/map/deps';
import { ImpactCommand } from './commands/map/impact';
import { GitStatusCommand } from './commands/git/status';
import { GitLogCommand } from './commands/git/log';
import { GitDiffCommand } from './commands/git/diff';
import { GitBlameCommand } from './commands/git/blame';
import { GitBranchCommand } from './commands/git/branch';
import { GitCommitCommand } from './commands/git/commit';
import { GitStashCommand } from './commands/git/stash';
import { GitResetCommand } from './commands/git/reset';
import { GitMergeCommand } from './commands/git/merge';
import { GitTagCommand } from './commands/git/tag';
import { GitCherryPickCommand } from './commands/git/cherry-pick';
import { ExecCommand } from './commands/shell/exec';
import { PlatformCommand } from './commands/shell/platform';
import { RunCommand } from './commands/shell/run';
import { EnvCommand } from './commands/shell/env';
import { WhichCommand } from './commands/shell/which';
import { LintCommand } from './commands/quality/lint';
import { TestCommand } from './commands/quality/test';
import { TypecheckCommand } from './commands/quality/typecheck';
import { FormatCommand } from './commands/quality/format';
import { SessionCommand } from './commands/session/session';
import { InfoCommand } from './commands/utility/info';
import { BatchCommand } from './commands/utility/batch';
import { AICommand } from './commands/utility/ai';
import { QuickCommand } from './commands/utility/quick';
import { SafeCommand } from './commands/utility/safe';
import { InitCommand } from './commands/init/init';
import { DoctorCommand } from './commands/doctor/doctor';
import { FormatManager } from './core/format';
import { ConfigManager } from './core/config';
import { SessionManager } from './core/session';

async function main() {
  const cli = new CLI();
  
  const formatManager = cli.getFormatManager();
  const configManager = cli.getConfigManager();
  const sessionManager = cli.getSessionManager();

  // READ Group
  cli.registerCommand('read', new ReadCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('outline', new OutlineCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('peek', new PeekCommand(formatManager, configManager, sessionManager));

  // SEARCH Group
  cli.registerCommand('grep', new GrepCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('where', new WhereCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('find', new FindCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('search', new SearchCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('refs', new RefsCommand(formatManager, configManager, sessionManager));

  // SYMBOL Group
  cli.registerCommand('symbols', new SymbolsCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('sig', new SigCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('def', new DefCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('body', new BodyCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('callers', new CallersCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('callees', new CalleesCommand(formatManager, configManager, sessionManager));

  // MAP Group
  cli.registerCommand('map', new MapCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('tree', new TreeCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('stats', new StatsCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('deps', new DepsCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('impact', new ImpactCommand(formatManager, configManager, sessionManager));

  // GIT Group
  cli.registerCommand('git-status', new GitStatusCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-log', new GitLogCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-diff', new GitDiffCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-blame', new GitBlameCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-branch', new GitBranchCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-commit', new GitCommitCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-stash', new GitStashCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-reset', new GitResetCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-merge', new GitMergeCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-tag', new GitTagCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('git-cherry-pick', new GitCherryPickCommand(formatManager, configManager, sessionManager));

  // SHELL Group
  cli.registerCommand('exec', new ExecCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('platform', new PlatformCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('run', new RunCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('env', new EnvCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('which', new WhichCommand(formatManager, configManager, sessionManager));

  // QUALITY Group
  cli.registerCommand('lint', new LintCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('test', new TestCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('typecheck', new TypecheckCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('format', new FormatCommand(formatManager, configManager, sessionManager));

  // SESSION Group
  cli.registerCommand('session', new SessionCommand(formatManager, configManager, sessionManager));

  // UTILITY Group
  cli.registerCommand('info', new InfoCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('batch', new BatchCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('ai', new AICommand(formatManager, configManager, sessionManager));
  cli.registerCommand('quick', new QuickCommand(formatManager, configManager, sessionManager));

  // EDIT Group
  cli.registerCommand('verify', new VerifyCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('patch', new PatchCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('replace', new ReplaceCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('create', new CreateCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('delete', new DeleteCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('move', new MoveCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('copy', new CopyCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('rename', new RenameCommand(formatManager, configManager, sessionManager));

  // SYSTEM Group
  cli.registerCommand('init', new InitCommand(formatManager, configManager, sessionManager));
  cli.registerCommand('doctor', new DoctorCommand(formatManager, configManager, sessionManager));

  const args = process.argv.slice(2);
  const result = await cli.execute(args);

  console.log(result);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

