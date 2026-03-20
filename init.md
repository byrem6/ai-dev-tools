# adt — `init` & `doctor` Implementation Spec

> **Purpose:** This document tells an AI coder exactly what to build.
> Three self-contained features. Implement them in order.
> Every file path, every output line, every edge case is specified here.

---

## Overview

| Feature | Command | What It Does |
|---------|---------|-------------|
| 1 | `adt init` | Generates AI tool config files in the current project |
| 2 | `adt doctor` | Checks that `adt` and the project environment are ready |
| 3 | Config Templates | The exact content of every file `adt init` generates |

---

## Feature 1 — `adt init`

### What It Does

Runs once per project. Detects which AI coding tools the user has configured and generates the appropriate instruction files so those tools know how to use `adt`.

### Command Signature

```bash
adt init [options]

Options:
  --tools <list>   Comma-separated tools to generate for.
                   Choices: claude,cursor,opencode,copilot,all
                   Default: all
  --force          Overwrite existing files without prompting
  --dry-run        Print what would be created, do not write
  --fmt slim|normal|json
```

### Detection Logic

Before generating files, `adt init` auto-detects which tools are present by checking for these markers in the current working directory or `$HOME`:

```
Tool        Detection Check
─────────────────────────────────────────────────────────
claude      .claude/ dir exists  OR  CLAUDE.md exists
            OR  `which claude` returns a path
cursor      .cursor/ dir exists  OR  .cursorrules exists
            OR  `which cursor` returns a path
opencode    .opencode/ dir exists
            OR  `which opencode` returns a path
copilot     .github/ dir exists
            OR  `which gh` returns a path
```

If none are detected, generate for **all** tools.

### Files Generated

```
Project Root
├── CLAUDE.md                          ← Claude Code (reads automatically)
├── .claude/
│   └── instructions.md                ← Claude Code (alternative location)
├── .cursorrules                        ← Cursor (reads automatically)
├── .cursor/
│   └── mcp.json                        ← Cursor MCP config (optional)
├── .opencode/
│   └── config.json                     ← OpenCode config
└── .github/
    └── copilot-instructions.md         ← GitHub Copilot
```

### Behavior Rules

1. If a file already exists and `--force` is NOT passed → **ask the user** (y/n) before overwriting.
2. If `--dry-run` → print file paths and first 5 lines of each, do not write.
3. After writing, print a summary.
4. Always run `adt doctor` automatically at the end of `adt init` (unless `--dry-run`).

### Output

```
--fmt slim:
  ok true
  created CLAUDE.md
  created .claude/instructions.md
  created .cursorrules
  created .opencode/config.json
  created .github/copilot-instructions.md
  ---
  5 files created  run: adt doctor

--fmt normal (default):
  ok: true
  project: /path/to/project
  tools-detected: cursor  claude
  ===
  created  CLAUDE.md
  created  .claude/instructions.md
  created  .cursorrules
  skipped  .cursor/mcp.json  (adt-mcp package not installed)
  created  .opencode/config.json
  created  .github/copilot-instructions.md
  ---
  5 files created  1 skipped
  running adt doctor...
  [doctor output follows]
```

---

## Feature 2 — `adt doctor`

### What It Does

Validates that the environment is correctly set up for AI tools to use `adt`. Checks four categories: installation, project, config files, and context.

### Command Signature

```bash
adt doctor [options]

Options:
  --fmt slim|normal|json
```

### Checks (in order)

```
Category: INSTALLATION
  [ ] adt is globally installed          which adt
  [ ] adt version matches package.json   adt --version
  [ ] node >= 18.0.0                     node --version
  [ ] git is available                   which git

Category: PROJECT
  [ ] Current directory is a git repo    git rev-parse --git-dir
  [ ] package.json exists                fs.existsSync('package.json')
  [ ] .gitignore exists                  fs.existsSync('.gitignore')

Category: CONFIG FILES (at least one must exist)
  [ ] CLAUDE.md                          fs.existsSync('CLAUDE.md')
  [ ] .claude/instructions.md            fs.existsSync(...)
  [ ] .cursorrules                       fs.existsSync('.cursorrules')
  [ ] .opencode/config.json              fs.existsSync(...)
  [ ] .github/copilot-instructions.md    fs.existsSync(...)

Category: ADT CONTEXT
  [ ] Context initialized                ~/.adt/context/<project>/ exists
  [ ] Session directory exists           ~/.adt/sessions/ exists
  [ ] Backup directory exists            ~/.adt/backups/ exists
```

### Pass / Fail Logic

- `INSTALLATION` checks: ALL must pass. Any failure = `ok false`.
- `PROJECT` checks: ALL must pass. Any failure = `ok false`.
- `CONFIG FILES` checks: AT LEAST ONE must exist. All missing = `ok false` with tip.
- `ADT CONTEXT` checks: Failures are warnings only (`WARN`), not errors.

### Output

```
--fmt slim:
  # All passing
  ok true
  adt v1.0.0  node v20.11.0  git v2.43.0
  git-repo  package.json  .gitignore
  CLAUDE.md  .cursorrules
  context initialized

  # With failures
  ok false
  ✓ adt v1.0.0
  ✓ node v20.11.0
  ✗ git  NOT FOUND
  tip: install git from https://git-scm.com

--fmt normal (default):
  ok: true
  ===
  INSTALLATION
    ✓  adt        v1.0.0   /usr/local/bin/adt
    ✓  node       v20.11.0 /usr/local/bin/node
    ✓  git        v2.43.0  /usr/bin/git

  PROJECT
    ✓  git repo   /path/to/project/.git
    ✓  package.json
    ✓  .gitignore

  CONFIG FILES  (1 of 5 present)
    ✓  CLAUDE.md
    -  .claude/instructions.md   [not found]
    ✓  .cursorrules
    -  .opencode/config.json     [not found]
    -  .github/copilot-instructions.md  [not found]

  ADT CONTEXT
    ✓  context dir   ~/.adt/context/my-project/
    ✓  sessions dir  ~/.adt/sessions/
    ✗  backups dir   ~/.adt/backups/  [WARN — will be created on first patch]

  ---
  status: READY
  tip: run `adt init` to generate missing config files

  # Failed example:
  ok: false
  ===
  INSTALLATION
    ✓  adt        v1.0.0
    ✓  node       v20.11.0
    ✗  git        NOT FOUND
       fix: install git → https://git-scm.com

  PROJECT
    ✗  git repo   not a git repository
       fix: run `git init` or navigate to a git project

  CONFIG FILES
    ✗  no config files found
       fix: run `adt init`

  ADT CONTEXT
    -  skipped (project checks failed)
  ---
  status: NOT READY  (3 errors)

--fmt json:
  {
    "ok": true,
    "status": "READY",
    "checks": {
      "installation": {
        "passed": true,
        "items": [
          { "name": "adt",  "ok": true,  "version": "1.0.0", "path": "/usr/local/bin/adt" },
          { "name": "node", "ok": true,  "version": "20.11.0" },
          { "name": "git",  "ok": true,  "version": "2.43.0" }
        ]
      },
      "project": {
        "passed": true,
        "items": [
          { "name": "git-repo",     "ok": true },
          { "name": "package.json", "ok": true },
          { "name": ".gitignore",   "ok": true }
        ]
      },
      "configFiles": {
        "passed": true,
        "foundCount": 2,
        "items": [
          { "name": "CLAUDE.md",     "ok": true,  "path": "CLAUDE.md" },
          { "name": ".cursorrules",  "ok": true,  "path": ".cursorrules" },
          { "name": ".opencode/config.json", "ok": false }
        ]
      },
      "context": {
        "passed": true,
        "warnings": ["backups dir will be created on first patch"]
      }
    }
  }
```

---

## Feature 3 — Config File Templates

Exact content for every file `adt init` generates.
The `{{PROJECT_NAME}}` and `{{ADT_VERSION}}` placeholders are replaced at generation time.

---

### File: `CLAUDE.md`

This file is read automatically by Claude Code at session start.

```markdown
# {{PROJECT_NAME}} — AI Dev Tools Setup

`adt` v{{ADT_VERSION}} is installed globally. Use it for ALL file, search, and git operations.

## Session Start

Run these two commands at the beginning of every session:

```bash
adt resume --fmt slim
adt context get --fmt slim
```

## Core Rules

- **NEVER** use `cat`, `grep`, `find`, `sed`, or `git` directly
- **ALWAYS** use `adt` equivalents
- **Format rule:** `--fmt slim` for location/boolean, `--fmt normal` for reading/analysis

## Command Reference

### Search & Navigation
```bash
adt where <symbol> --fmt slim                    # fastest: where is X?
adt grep "<pattern>" [path] --fmt slim           # search all files → file:line:col
adt grep "<pattern>" . --regex --fmt slim        # regex search
adt find . --name "*.service.ts" --fmt slim      # find files by name
adt refs <symbol> src/ --fmt slim                # all usages of a symbol
```

### Reading Files
```bash
adt info <file> --fmt slim                       # check size, encoding, binary?
adt peek <file> --fmt slim                       # quick skeleton (imports + symbols)
adt outline <file> --fmt slim                    # TOC for files >500 lines
adt read <file> --start N --lines 100 --fmt normal  # read a chunk
adt read <file> --around N --context 15 --fmt normal # context around a line
adt read <file> --fn <functionName> --fmt normal # read a function by name
```

### Understanding Code
```bash
adt sig <symbol> src/ --fmt slim                 # signature only (~12 tokens)
adt def <symbol> src/ --fmt normal               # definition + location
adt body <symbol> src/ --fmt normal              # full function body
adt callers <symbol> src/ --fmt slim             # who calls this?
adt callees <symbol> src/ --fmt slim             # what does this call?
adt deps <file> --file --fmt normal              # what does this file import?
adt impact <file> --symbol <name> --fmt normal   # what breaks if I change this?
```

### Editing Files — ALWAYS Follow This Order
```bash
# Step 1: confirm the target lines contain what you expect
adt verify <file> --lines N:M --contains "<expected text>" --fmt slim

# Step 2: preview the change
adt patch <file> --replace N:M --with "<new content>" --dry-run --fmt normal

# Step 3: apply
adt patch <file> --replace N:M --with "<new content>" --fmt slim

# Step 4: confirm
adt read <file> --around N --context 5 --fmt normal
```

### Git
```bash
adt git status --fmt slim
adt git log --limit 10 --fmt slim
adt git diff --staged --fmt normal
adt git add <path> --fmt slim
adt git commit --message "<msg>" --fmt slim
adt git push --fmt slim
adt git pull --fmt slim
adt git branch list --fmt slim
adt git branch create <name> --fmt slim
```

### Quality
```bash
adt lint src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
adt test <file> --fmt normal         # single file with details
adt format src/ --check --fmt slim
```

### Project Context & Tasks
```bash
adt context get --fmt slim           # read project rules
adt context set "<key>" "<value>"    # save a rule or decision
adt task status --fmt slim           # current task progress
adt task create "<title>"
adt task step add <id> "<step>"
adt task step done <id> <stepNo>
```

## Reading Strategy by File Size

```
File size        Strategy
────────────────────────────────────────────────────
< 200 lines      adt read <file> --fmt normal
200–500 lines    adt peek --fmt slim  →  adt read --start N
> 500 lines      adt outline --fmt slim  →  adt read --start N --end M
```

## Error Handling

Every `adt` command outputs `ok true` or `ok false` as the first line.
Always check this before proceeding.

```bash
# If ok false:
# - Read the `tip:` line for the suggested fix
# - Common fixes:
#   ENOENT → adt find <name> --fmt slim
#   ECONFLICT → re-run adt outline to get correct line numbers
#   EGIT → check adt git status --fmt slim first
```
```

---

### File: `.claude/instructions.md`

Identical content to `CLAUDE.md`. Some Claude Code versions read from this path instead.

```
[Same content as CLAUDE.md above]
```

---

### File: `.cursorrules`

Cursor reads this file and applies the rules to every AI interaction in the project.

```
# adt — AI Dev Tools (globally installed)
# Use adt for ALL file, search, and git operations in this project.

## RULES

1. Never use cat, grep, find, sed, or git directly.
   Always use the adt equivalent.

2. Format selection:
   --fmt slim   → location queries, boolean checks, lists
   --fmt normal → reading files, analysis, git operations
   --fmt json   → only when you need to parse nested data in code

3. Session start — always run both:
   adt resume --fmt slim
   adt context get --fmt slim

4. Before every patch — always verify first:
   adt verify <file> --lines N:M --contains "<text>" --fmt slim
   adt patch <file> --replace N:M --with "..." --dry-run --fmt normal
   adt patch <file> --replace N:M --with "..." --fmt slim

5. Read strategy by file size:
   < 200 lines  → adt read <file> --fmt normal
   200-500      → adt peek --fmt slim then adt read --start N
   > 500 lines  → adt outline --fmt slim then adt read --start N --end M

## KEY COMMANDS

Search:
  adt where <symbol> --fmt slim
  adt grep "<pattern>" src/ --fmt slim
  adt grep "<pattern>" . --regex --fmt slim
  adt find . --name "*.service.ts" --fmt slim
  adt refs <symbol> src/ --fmt slim

Read:
  adt info <file> --fmt slim
  adt peek <file> --fmt slim
  adt outline <file> --fmt slim
  adt read <file> --start N --lines 100 --fmt normal
  adt read <file> --around N --context 15 --fmt normal
  adt read <file> --fn <functionName> --fmt normal

Symbols:
  adt sig <symbol> src/ --fmt slim
  adt def <symbol> src/ --fmt normal
  adt body <symbol> src/ --fmt normal
  adt callers <symbol> src/ --fmt slim
  adt callees <symbol> src/ --fmt slim

Edit:
  adt verify <file> --lines N:M --contains "<text>" --fmt slim
  adt patch <file> --replace N:M --with "..." --fmt slim
  adt patch <file> --insert-after N --content "..." --fmt slim
  adt patch <file> --delete N:M --fmt slim
  adt replace src/ "<from>" "<to>" --ext ts --dry-run --fmt slim
  adt rename <old> <new> src/ --dry-run --fmt slim

Git:
  adt git status --fmt slim
  adt git log --limit 10 --fmt slim
  adt git diff --staged --fmt normal
  adt git add <path> --fmt slim
  adt git commit --message "<msg>" --fmt slim
  adt git push --fmt slim
  adt git pull --fmt slim
  adt git branch list --fmt slim
  adt git branch create <name> --fmt slim
  adt git stash save "<msg>" --fmt slim

Quality:
  adt lint src/ --fmt slim
  adt typecheck src/ --fmt slim
  adt test --fmt slim
  adt security scan src/ --fmt slim
  adt arch check --fmt slim

Analysis:
  adt impact <file> --symbol <name> --fmt normal
  adt deps <file> --file --fmt normal
  adt risk hotspot src/ --fmt slim
  adt coverage report --fmt slim
  adt complexity hotspot src/ --fmt slim
  adt dead code src/ --fmt slim

Context:
  adt context get --fmt slim
  adt context set "<key>" "<value>"
  adt task status --fmt slim
  adt resume --fmt slim
```

---

### File: `.opencode/config.json`

OpenCode configuration. Injects the system prompt and enables the shell tool.

```json
{
  "systemPrompt": "You have access to the `adt` CLI tool (globally installed as `ai-dev-tools`).\n\nUSE `adt` FOR ALL FILE, SEARCH, AND GIT OPERATIONS.\nNEVER use cat, grep, find, sed, or git directly.\n\nSESSION START — always run:\n  adt resume --fmt slim\n  adt context get --fmt slim\n\nFORMAT RULES:\n  --fmt slim   → location, boolean, lists\n  --fmt normal → reading, analysis\n  --fmt json   → programmatic/nested only\n\nKEY COMMANDS:\n  adt where <symbol> --fmt slim\n  adt grep \"<pattern>\" src/ --fmt slim\n  adt read <file> --start N --lines 100 --fmt normal\n  adt outline <file> --fmt slim\n  adt verify <file> --lines N:M --contains \"<text>\" --fmt slim\n  adt patch <file> --replace N:M --with \"...\" --fmt slim\n  adt git status --fmt slim\n  adt git commit --message \"<msg>\" --fmt slim\n  adt lint src/ --fmt slim\n  adt test --fmt slim\n  adt typecheck src/ --fmt slim\n\nBEFORE EVERY EDIT:\n  1. adt verify → confirm correct lines\n  2. adt patch --dry-run → preview\n  3. adt patch → apply\n\nFILE SIZE STRATEGY:\n  <200 lines  → adt read directly\n  200-500     → adt peek then targeted read\n  >500 lines  → adt outline then targeted read",
  "tools": {
    "shell": {
      "enabled": true,
      "allowedCommands": ["adt"]
    }
  }
}
```

---

### File: `.github/copilot-instructions.md`

GitHub Copilot reads this file for workspace-level instructions.

```markdown
# {{PROJECT_NAME}} — Copilot Instructions

## Dev Tooling

`adt` (ai-dev-tools) is installed globally. Use terminal commands with `adt` for all
file operations, search, and git tasks instead of built-in tools.

## When suggesting terminal commands, always use adt:

### Instead of `grep`:
```bash
adt grep "<pattern>" src/ --fmt slim
```

### Instead of `cat` / reading files:
```bash
adt peek <file> --fmt slim          # quick overview
adt outline <file> --fmt slim       # table of contents (>500 line files)
adt read <file> --start N --lines 100 --fmt normal
```

### Instead of `find`:
```bash
adt find . --name "*.service.ts" --fmt slim
adt where <symbol> --fmt slim
```

### Instead of `sed` / file editing:
```bash
# Always verify before patching
adt verify <file> --lines N:M --contains "<expected>" --fmt slim
adt patch <file> --replace N:M --with "<new content>" --fmt slim
```

### Instead of `git`:
```bash
adt git status --fmt slim
adt git add <path> --fmt slim
adt git commit --message "<message>" --fmt slim
adt git push --fmt slim
```

## Format Rule

- `--fmt slim` → location queries, boolean checks, file lists
- `--fmt normal` → reading file content, analysis output
- `--fmt json` → only when processing output programmatically

## Quality Checks (run before committing)

```bash
adt lint src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
```
```

---

## Implementation Notes for the AI Coder

### File Structure

Add the two new commands to the existing `adt` CLI in the same pattern as other commands:

```
src/
├── commands/
│   ├── init.js      ← new
│   ├── doctor.js    ← new
│   ├── grep.js      ← existing
│   ├── read.js      ← existing
│   └── ...
├── templates/       ← new directory
│   ├── CLAUDE.md.tpl
│   ├── cursorrules.tpl
│   ├── opencode-config.json.tpl
│   └── copilot-instructions.md.tpl
└── index.js
```

### Template Rendering

Simple string replacement — no template engine needed:

```javascript
function renderTemplate(content, vars) {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, vars.projectName)
    .replace(/\{\{ADT_VERSION\}\}/g, vars.adtVersion);
}

function getProjectName() {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return pkg.name || path.basename(process.cwd());
  } catch {
    return path.basename(process.cwd());
  }
}
```

### Detection Helper

```javascript
function detectTools() {
  const detected = [];
  const checks = {
    claude:  () => fs.existsSync('.claude') || fs.existsSync('CLAUDE.md') || commandExists('claude'),
    cursor:  () => fs.existsSync('.cursor') || fs.existsSync('.cursorrules') || commandExists('cursor'),
    opencode:() => fs.existsSync('.opencode') || commandExists('opencode'),
    copilot: () => fs.existsSync('.github') || commandExists('gh'),
  };
  for (const [tool, check] of Object.entries(checks)) {
    if (check()) detected.push(tool);
  }
  return detected.length > 0 ? detected : ['claude', 'cursor', 'opencode', 'copilot'];
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

### `adt doctor` Version Check

```javascript
function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0]);
  return {
    ok: major >= 18,
    version,
    required: '18.0.0',
    tip: major < 18 ? 'Upgrade Node.js to v18 or later: https://nodejs.org' : null
  };
}
```

### Output Formatting

Both commands must support `--fmt slim|normal|json` exactly like all other `adt` commands.
Reuse the existing output formatter from the codebase — do not create a new one.

### Exit Codes

```
adt init   → exits 0 always (even if some files skipped)
adt doctor → exits 0 if ok:true, exits 1 if ok:false
```

This allows `adt doctor` to be used in CI:

```bash
adt doctor --fmt slim || exit 1
```

---

## Acceptance Criteria

### `adt init`

- [ ] Generates all 5 config files with correct content
- [ ] Replaces `{{PROJECT_NAME}}` and `{{ADT_VERSION}}` in all templates
- [ ] Detects existing tools and only generates relevant files when `--tools` not specified
- [ ] Asks before overwriting (skips prompt with `--force`)
- [ ] `--dry-run` prints file paths + first 5 lines, writes nothing
- [ ] Automatically runs `adt doctor` after init (unless `--dry-run`)
- [ ] Supports `--fmt slim|normal|json`

### `adt doctor`

- [ ] Runs all checks in order: installation → project → config files → context
- [ ] Exits with code 1 when any non-warning check fails
- [ ] `ok false` output includes a `tip:` or `fix:` line for every failure
- [ ] Context warnings do not affect exit code
- [ ] Supports `--fmt slim|normal|json`
- [ ] Can be piped: `adt doctor --fmt slim && echo "ready"`

### Config Files

- [ ] `CLAUDE.md` — complete command reference, session start instructions, error handling
- [ ] `.claude/instructions.md` — identical to `CLAUDE.md`
- [ ] `.cursorrules` — all commands listed, format rules, edit workflow
- [ ] `.opencode/config.json` — valid JSON, systemPrompt and shell tool config
- [ ] `.github/copilot-instructions.md` — markdown format, all command replacements
