# AI Dev Tools (adt) — Full Design Specification v5

> **Target Audience:** Primarily AI (LLM) agents. Human developers can use it too.
> Every design decision was made by asking a single question: *"Does this output justify the token cost?"*

---

## Why This Tool Exists

Standard shell commands are built for human terminals. When an AI agent uses them:

| Problem | Example | Token Cost |
|---------|---------|-----------|
| Token waste | `cat large.ts` → 800 lines, 600 irrelevant | ~2000 tokens burned |
| Unparseable output | `grep` → ANSI colors, page numbers | JSON parse failure |
| Binary bomb | `cat logo.png` → context corrupted | Context destroyed |
| Blind navigation | "Where is UserService?" → 5 commands | 5× round-trips |
| JSON bloat | `{"file":"a.ts","line":45}` for a simple location | 3× unnecessary overhead |
| Silent corruption | BOM, CRLF mismatch undetected | Hidden bugs |
| Git blindness | `git log` → colorized, paginated | Unparseable |
| Shell risk | Where is exit code? Where is stderr? | Silent failures |

`adt` solves all of these with a token-efficient three-format output system.

---

## Core Principles

1. **Format-aware output:** Every command works in three modes: `slim`, `normal`, `json`. Right mode = minimum tokens, maximum information.
2. **`ok` guarantee:** All JSON and normal outputs begin with an `ok:` line. AI parses a single line to decide whether to continue.
3. **Actionable errors:** Not "File not found" → "ENOENT: src/UserService.ts — Try: adt find UserService"
4. **Token-aware:** Every command reports an estimated `~T` token count. AI manages its budget.
5. **Safe defaults:** Destructive operations take backups. `--dry-run` is default for patch.
6. **Stateless + traceable:** Each run is independent. Session log records everything.
7. **Language-agnostic:** JS/TS → AST. Others → robust regex. Unknown language → graceful degradation.
8. **Cross-platform:** Windows PowerShell + Linux/macOS Bash supported transparently.

---

## ═══════════════════════════════════════════════════════════
## OUTPUT FORMAT SYSTEM — v4 Core Innovation
## ═══════════════════════════════════════════════════════════

### Three Format Modes

```
--fmt slim    Maximum token savings. Location, status, simple lists.
--fmt normal  Default. Balanced. Machine-readable but human-friendly.
--fmt json    Full structured data. Nested analysis, programmatic processing.
```

> **The legacy `--json` flag** is equivalent to `--fmt json`. For backward compatibility `--json` still works.

---

### Format Selection Guide

| Situation | Format | Why |
|-----------|--------|-----|
| "Where is X?" → just file:line needed | `slim` | 5–15 tokens |
| Grep / search results | `slim` | `file:line:col:text` classic grep format |
| Boolean check (ok?) | `slim` | `ok true` or `ok false tip:...` |
| Metadata summary | `normal` | key=value, readable |
| Symbol list | `normal` | table format, token-balanced |
| Git status / log | `normal` | structured but compact |
| Nested analysis (deps, impact) | `json` | nested structure required |
| Error details | `json` | `tip`, `code`, `path` as separate fields |
| Programmatic processing | `json` | pipe, parse, script |
| Large batch results | `slim` or `normal` | `json` bloats |

---

### `slim` Format Rules

```
# General structure
ok <true|false>
[key value]           ← optional single metadata line
<content>             ← each line independent, parseable

# Location line (grep tradition)
<file>:<line>:<col>:<text>
src/services/UserService.ts:45:8:  async createOrder(

# Simple key-value
ok true
file src/services/UserService.ts
lines 342

# List
ok true
count 3
src/services/UserService.ts
src/controllers/OrderController.ts
tests/UserService.test.ts

# Error
ok false
ENOENT src/UserService.ts
tip adt find UserService
```

**Token comparison — same information:**
```
JSON  : {"ok":true,"file":"src/services/UserService.ts","line":45,"col":8,"text":"async createOrder("}  → ~28 tokens
slim  : src/services/UserService.ts:45:8:async createOrder(                                             →  ~9 tokens
Diff  : 3.1× more efficient
```

---

### `normal` Format Rules

```
# General structure
ok: true
command: <command>
---
<key>: <value>       ← simple values
<key>:               ← list start
  - <item>           ← list items (2-space indent)
<key>:               ← block start
  <key>: <value>     ← nested values
===                  ← section separator
<key>: <value>

# Example — grep result
ok: true
command: grep
pattern: createOrder
matches: 4  files: 2  ~42 tokens
===
src/services/OrderService.ts:44:  async createOrder(userId: string): Promise<Order> {
src/services/OrderService.ts:89:  return this.createOrder(dto);
src/controllers/OrderController.ts:32:  await this.svc.createOrder(req.body);
src/controllers/OrderController.ts:78:  const result = createOrder(dto);

# Example — git status
ok: true
command: git status
branch: feature/payment  ahead: 2  behind: 0
===
staged:
  M  src/services/PaymentService.ts
  A  src/models/Payment.ts
unstaged:
  M  src/controllers/OrderController.ts
untracked:
  ?  src/utils/crypto.ts
```

**Token comparison — git status:**
```
JSON   : {"ok":true,"branch":"feature/payment","ahead":2,"behind":0,"staged":[{"status":"M","file":"..."},...]}  → ~85 tokens
normal : (example above)                                                                                          → ~38 tokens
slim   : ok true\nbranch feature/payment\nM src/services/PaymentService.ts\n...                                  → ~22 tokens
```

---

### `json` Format Rules

```json
{
  "ok": true,
  "command": "<command-name>",
  "tokenEstimate": 380,
  "...": "command-specific fields"
}
```

Error:
```json
{
  "ok": false,
  "command": "<command-name>",
  "error": "File not found",
  "code": "ENOENT",
  "path": "/path/to/file.ts",
  "tip": "adt find UserService --fmt slim"
}
```

---

### Which LLM Should Use Which Format?

| Model | Recommended | Why |
|-------|-------------|-----|
| Claude Sonnet/Haiku | `slim` or `normal` | Efficient context window usage |
| Claude Opus | `normal` or `json` | Deep analysis capacity available |
| GPT-4o | `normal` | Balanced for tool-call response parsing |
| GPT-4o-mini | `slim` | Token limits matter |
| Gemini 1.5 Pro | `normal` or `json` | 1M context, but efficiency still valuable |
| Gemini Flash | `slim` | Speed + cost focused |
| Llama 3 / local | `slim` | Limited context window |
| Cursor / Copilot | `normal` | Readability for IDE integration |

---

### Format × Command Matrix

| Command | slim | normal | json |
|---------|------|--------|------|
| `grep` | ✅ **default** | location+context | full schema |
| `search` | location list | ✅ **default** | nested context |
| `where` | ✅ **default** | with metadata | — |
| `find` | file list | ✅ **default** | size+date |
| `read` | line-numbered text | ✅ **default** | pagination meta |
| `peek` | skeleton summary | ✅ **default** | full schema |
| `outline` | name:line list | ✅ **default** | nested members |
| `symbols` | name:line list | ✅ **default** | full schema |
| `def` | file:line:sig | ✅ **default** | bodyStart/End |
| `sig` | ✅ **default** | with parameters | JSON schema |
| `verify` | ✅ **default** | line content | actualContent |
| `patch` | ok+lines | ✅ **default** | diff+checksum |
| `git status` | branch+file list | ✅ **default** | full schema |
| `git log` | hash+message | ✅ **default** | author+files |
| `git diff` | unified diff | ✅ **default** | hunk schema |
| `exec` | exitCode+output | ✅ **default** | full schema |
| `lint` | file:line:msg | ✅ **default** | rule+fixable |
| `test` | pass/fail summary | ✅ **default** | failure detail |
| `env check` | ✅ **default** | key+value | full schema |
| `impact` | risk+file list | ✅ **default** | ✅ nested required |
| `deps` | import list | ✅ **default** | ✅ nested required |
| `stats` | numbers summary | ✅ **default** | byExtension |
| `session` | token summary | ✅ **default** | full schema |

---

### Token Savings Table (Measured)

```
Command               slim      normal    json      Best Choice
──────────────────────────────────────────────────────────────
grep (10 matches)     ~45T      ~110T     ~280T     slim
git status            ~22T       ~38T      ~85T     slim
git log (5 commits)   ~55T      ~120T     ~310T     slim
peek (medium file)    ~70T      ~180T     ~320T     normal
outline (10 fns)      ~50T      ~120T     ~240T     normal
symbols (8 symbols)   ~35T       ~80T     ~180T     normal
lint (5 issues)       ~40T       ~90T     ~200T     slim/normal
test (3 failures)     ~50T      ~110T     ~260T     normal
env check (5 vars)    ~20T       ~55T     ~120T     slim
deps (10 imports)     ~45T      ~100T     ~220T     normal
impact                ~60T      ~140T     ~320T     normal (json required for nested)
──────────────────────────────────────────────────────────────
Average savings       slim: 5–7× vs json   normal: 2–3× vs json
```

---

## Command Architecture

```
adt <command> [subcommand] [target] [options] [--fmt slim|normal|json]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
READ GROUP
  read      Smart chunk reader (range, context-window aware)
  cat       Full file (hard token limit enforced)
  head      First N lines
  tail      Last N lines
  peek      Quick profile: metadata + skeleton + import summary
  outline   Large file TOC (function map)

SEARCH GROUP
  grep      Project-wide search → file:line:col  [slim default]
  search    Advanced: regex, multi-pattern, context lines
  find      Find files/directories
  refs      Symbol references (import/def/usage)
  where     "Where is X?" single-command answer  [slim default]

SYMBOL GROUP
  symbols   Class/function/method/type list
  def       Go to symbol definition
  sig       Signature only (no body)              [slim default]
  body      Function/method body
  callers   Who calls this?
  callees   What does this call?

EDIT GROUP
  patch     Line-based safe edit (replace, insert, delete)
  replace   String/regex replace (single or bulk)
  verify    Pre-patch line content validation     [slim default]
  bulk      Multi-file batch operations
  create    Create new file/directory
  delete    Safe delete (with backup)
  move      Move + auto-update imports
  copy      Copy file/directory
  rename    Project-wide symbol/file rename

MAP GROUP
  map       Project file tree + technology stack
  tree      Visual directory tree (filterable)
  deps      Import/require dependency graph
  impact    Change impact analysis
  stats     Code statistics (lines, complexity, language breakdown)

GIT GROUP
  git status / log / diff / blame
  git branch / commit / add / push / pull
  git merge / rebase / stash / reset
  git tag / remote / cherry-pick

SHELL GROUP
  exec      Run Bash/PowerShell → exitCode+stdout+stderr
  run       Run script/binary
  env       Environment variables
  which     Find command path
  platform  OS/shell information

QUALITY GROUP
  lint      Run linter
  test      Run test runner
  format    Run formatter
  typecheck Type checking

SESSION GROUP
  session     Session summary
  diff        Show last change
  undo        Revert patch
  checkpoint  Snapshot
  resume      Resume from last session              ⭐ NEW

CONTEXT GROUP                                       ⭐ NEW GROUP
  context set/get/decisions/conventions

PATTERN GROUP                                       ⭐ NEW GROUP
  pattern find/similar/list

TASK GROUP                                          ⭐ NEW GROUP
  task create/step/status/list

GENERATE GROUP                                      ⭐ NEW GROUP
  generate service/model/test/controller

API GROUP                                           ⭐ NEW GROUP
  api list/find/routes   package usage

RISK & COVERAGE GROUP                               ⭐ NEW GROUP
  risk file/hotspot
  coverage report/file/untested

SECURITY GROUP                                      ⭐ NEW GROUP
  security scan/secrets/cve

HISTORY GROUP                                       ⭐ NEW GROUP
  history file/fn/why/churn/authors

COMPLEXITY & DEAD CODE GROUP                        ⭐ NEW GROUP
  complexity file/hotspot/debt
  dead code/files
  duplicate code

FLOW & CONTRACT GROUP                               ⭐ NEW GROUP
  flow trace/db
  contract check/missing

ARCHITECTURE GROUP                                  ⭐ NEW GROUP
  arch rules/check/rule add

WORKSPACE GROUP                                     ⭐ NEW GROUP
  workspace list/graph/affected/run

DOCUMENTATION GROUP                                 ⭐ NEW GROUP
  doc coverage/missing/stale

CONFIGURATION GROUP                                 ⭐ NEW GROUP
  config flags/read/diff

TAG GROUP                                           ⭐ NEW GROUP
  tag add/search/list

INTEGRATION GROUP                                   ⭐ NEW GROUP
  integration list/db/queue

MIGRATION GROUP                                     ⭐ NEW GROUP
  migrate plan/scan/apply

UTILITY GROUP
  info      File metadata + encoding
  safe      Binary check
  hash      SHA256/MD5
  watch     Watch for changes
  deps outdated / vulnerable / why   ⭐ EXTENDED
```

---

## Command Details (With Format Outputs)

---

## READ GROUP

---

### `adt read <file>`

```
Options:
  -s, --start <n>       Start line (1-based, inclusive)
  -e, --end <n>         End line (inclusive)
  -n, --lines <n>       How many lines to read (default: 100)
  --head <n>            First N lines
  --tail <n>            Last N lines
  --around <n>          Read around line N
  --context <n>         ±N lines with --around (default: 20)
  --fn <name>           Read function body by name
  --info                Metadata only, no content
  --encoding <enc>      Force encoding (utf8, latin1, utf16le...)
  --fmt slim|normal|json

Output --fmt slim:
   45  async createOrder(userId: string): Promise<Order> {
   46    const user = await this.userRepo.findById(userId);
   47    if (!user) throw new NotFoundError('User');
   48    ...
  144  }
  ~total:342  ~more:145  ~tokens:95

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts
  lines: 45–144 of 342  hasMore: true  nextStart: 145
  encoding: utf-8  lineEnding: LF  ~tokens: 380
  ---
   45  async createOrder(userId: string): Promise<Order> {
   46    const user = await this.userRepo.findById(userId);
  ...
  144  }

Output --fmt json:
  {
    "ok": true,
    "command": "read",
    "path": "src/services/UserService.ts",
    "encoding": "utf-8",
    "lineEnding": "LF",
    "hasBOM": false,
    "totalLines": 342,
    "startLine": 45,
    "endLine": 144,
    "hasMore": true,
    "nextStart": 145,
    "hasBefore": true,
    "prevStart": 1,
    "lines": [
      { "n": 45, "text": "  async createOrder(userId: string): Promise<Order> {" }
    ],
    "tokenEstimate": 380
  }
```

**AI Usage Protocol:**
```bash
# 1. Get info first — how many lines, how large
adt read src/services/UserService.ts --info --fmt slim

# 2. Read from start
adt read src/services/UserService.ts --start 1 --lines 100 --fmt normal

# 3. If hasMore=true, continue
adt read src/services/UserService.ts --start 101 --lines 100 --fmt normal

# 4. Stack trace context
adt read src/services/UserService.ts --around 87 --context 15 --fmt normal

# 5. Read by function name
adt read src/services/UserService.ts --fn createOrder --fmt normal
```

---

### `adt peek <file>`

```
Options:
  --fmt slim|normal|json

Output --fmt slim:
  ok true
  TypeScript  342 lines  12.4KB  utf-8 LF
  imports: bcrypt  ../models/User  ../utils/jwt
  class UserService :18–340
    method constructor :22–30
    method createUser :32–78
    method findById :80–102
    method updatePassword :104–145
  ~tokens: 55

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts
  type: TypeScript  size: 12.4 KB  lines: 342
  encoding: utf-8  lineEnding: LF  binary: false
  ---
  imports (3):
    1: bcrypt
    2: ../models/User
    3: ../utils/jwt
  skeleton:
    class UserService                 :18–340
      method constructor              :22–30
      method createUser        async  :32–78
      method findById          async  :80–102
      method updatePassword    async  :104–145
  first-lines:
    1: import bcrypt from 'bcrypt';
    2: import { User } from '../models/User';
  ~tokens: 180

Output --fmt json:
  {
    "ok": true,
    "path": "src/services/UserService.ts",
    "type": "TypeScript",
    "size": "12.4 KB",
    "totalLines": 342,
    "encoding": "utf-8",
    "lineEnding": "LF",
    "hasBOM": false,
    "isBinary": false,
    "imports": [
      { "line": 1, "source": "bcrypt" },
      { "line": 2, "source": "../models/User" }
    ],
    "skeleton": [
      { "type": "class",  "name": "UserService", "line": 18, "end": 340 },
      { "type": "method", "name": "createUser",  "line": 32, "end": 78,
        "async": true, "exported": false }
    ],
    "firstLines": [{ "n": 1, "text": "import bcrypt from 'bcrypt';" }],
    "tokenEstimate": 180
  }
```

---

### `adt outline <file>`

Read the table of contents first for files with 500+ lines, then read the target section.

```
Options:
  --depth <n>     Nesting depth (default: 2)
  --with-lines    Include start/end line numbers
  --with-size     Show line count per block
  --fmt slim|normal|json

Output --fmt slim:
  ok true
  src/services/OrderService.ts  892 lines
  import-block     :1–14    (14 lines)
  interface CreateOrderDTO  :16–28   (13 lines)
  class OrderService        :30–890  (861 lines)
    property db             :31
    method constructor      :33–42   (10 lines)
    method create    async  :44–118  (75 lines)
    method findById  async  :120–155 (36 lines)
    method #validate private:157–210 (54 lines)
  ~tokens: 55

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts  lines: 892
  ---
  sections:
    import-block              lines 1–14    (14)    14 imports: 8 external, 6 internal
    interface CreateOrderDTO  lines 16–28   (13)
    class OrderService        lines 30–890  (861)
      property db                      :31
      method constructor               :33–42   (10)
      method create           async    :44–118  (75)  userId:string, dto:CreateOrderDTO
      method findById         async    :120–155 (36)  id:string
      method #validate        private  :157–210 (54)
  ~tokens: 95

Output --fmt json:
  {
    "ok": true,
    "path": "src/services/OrderService.ts",
    "totalLines": 892,
    "sections": [
      { "type": "import-block", "line": 1, "end": 14,
        "summary": "14 imports (8 external, 6 internal)" },
      { "type": "class", "name": "OrderService", "line": 30, "end": 890,
        "members": [
          { "type": "method", "name": "create", "line": 44, "end": 118,
            "async": true, "params": ["userId: string", "dto: CreateOrderDTO"] }
        ]
      }
    ],
    "tokenEstimate": 95
  }
```

---

## SEARCH GROUP

---

### `adt grep <pattern> [path]` ⭐ slim default

The most critical command for AI. Searches across all project files. Returns every match as `file:line:col:text`. Precise navigation in a single command.

```
Options:
  -i, --ignore-case
  -r, --regex
  -w, --word              Whole word match
  -l, --files-only        File paths only (no line content)
  -c, --count-only        Match count per file
  -A, --after <n>         N lines of context after match
  -B, --before <n>        N lines of context before match
  -C, --context <n>       N lines both directions
  --ext <exts>            Filter by extension: ts,js,jsx
  --exclude <dirs>        Exclude: node_modules,dist
  --no-tests              Exclude *test*, *spec*, __tests__
  --no-comments           Exclude comment lines
  --max <n>               Max matches (default: 100)
  --max-per-file <n>      Max per file (default: 20)
  --fmt slim|normal|json

Output --fmt slim (default):
  src/services/OrderService.ts:44:  async createOrder(userId: string): Promise<Order> {
  src/services/OrderService.ts:89:  return this.createOrder(dto);
  src/controllers/OrderController.ts:32:  await this.svc.createOrder(req.body);
  src/controllers/OrderController.ts:78:  const result = createOrder(dto);
  ---
  4 matches  2 files  ~9 tokens

Output --fmt normal:
  ok: true
  pattern: createOrder  matches: 4  files: 2  ~tokens: 42
  ===
  src/services/OrderService.ts (2 matches)
    :44  async createOrder(userId: string): Promise<Order> {
    :89  return this.createOrder(dto);

  src/controllers/OrderController.ts (2 matches)
    :32  await this.svc.createOrder(req.body);
    :78  const result = createOrder(dto);

Output --fmt json:
  {
    "ok": true,
    "pattern": "createOrder",
    "totalMatches": 4,
    "totalFiles": 2,
    "truncated": false,
    "results": [
      {
        "file": "src/services/OrderService.ts",
        "matchCount": 2,
        "matches": [
          { "line": 44, "col": 2, "text": "  async createOrder(userId: string): Promise<Order> {",
            "context": { "before": [], "after": [] } }
        ]
      }
    ],
    "tokenEstimate": 280
  }

Contextual search (--context 2):
Output --fmt slim:
  src/services/OrderService.ts:44:  async createOrder(userId: string): Promise<Order> {
  > src/services/OrderService.ts:45:    const user = await this.userRepo.findById(userId);
  > src/services/OrderService.ts:46:    if (!user) throw new NotFoundError('User');
  ---
  1 match  1 file  ~18 tokens

  (match line is plain, context lines prefixed with >)

Examples:
  adt grep "createOrder" src/ --fmt slim
  adt grep "TODO|FIXME" . --regex --fmt slim
  adt grep "password" src/ --no-tests --fmt slim
  adt grep "implements.*IRepo" src/ --regex --context 2 --fmt normal
  adt grep "deprecated" . --files-only --fmt slim
```

---

### `adt where <query> [path]` ⭐ slim default

Fastest answer to "Where is X?". Combines file search and symbol definition in one shot.

```
Options:
  --type file|symbol|both   What to search (default: both)
  --fmt slim|normal|json

Output --fmt slim:
  file  src/services/UserService.ts  342 lines
  sym   class UserService :18  src/services/UserService.ts
  ~tokens: 20

Output --fmt normal:
  ok: true
  query: UserService
  ---
  files:
    src/services/UserService.ts  (342 lines, 12.2 KB)
  symbols:
    class UserService  :18  src/services/UserService.ts

Output --fmt json:
  {
    "ok": true,
    "query": "UserService",
    "files": [
      { "path": "src/services/UserService.ts", "lines": 342, "size": "12.2 KB" }
    ],
    "symbols": [
      { "file": "src/services/UserService.ts", "line": 18, "type": "class",
        "signature": "export class UserService" }
    ]
  }
```

---

### `adt search <pattern> [path]`

```
Options:
  -B/A/C, -i, -r, -l, -w  (same as grep)
  --multi <p1> <p2>        Multiple patterns
  --and                    All must match (AND)
  --not <pattern>          Exclude lines matching this
  --ext, --exclude, --max, --max-per-file
  --fmt slim|normal|json

Examples:
  # Lines containing both "async" and "createOrder"
  adt search --multi "async" "createOrder" src/ --and --fmt slim

  # Lines with "password" but not "hash"
  adt search "password" src/ --not "hash" --fmt slim

Output --fmt slim:
  src/controllers/UserController.ts:3:import { UserService } from '...'
  src/controllers/UserController.ts:22:this.userService = new UserService(db);
  ---
  2 matches  1 file  ~18 tokens

Output --fmt normal (default):
  ok: true
  pattern: UserService  matches: 23  files: 7  ~tokens: 110
  ===
  src/controllers/UserController.ts (4)
    :3    import { UserService } from '../services/UserService';
          context> import express from 'express';        [before:1]
    :22   this.userService = new UserService(db);
  ...
```

---

### `adt find <query> [path]`

```
Options:
  --name <glob>              Filename pattern: *.service.ts
  --ext <exts>               Extension filter
  --contains <text>          File must contain this text
  --contains-all <t1,t2>     Must contain all (AND)
  --contains-any <t1,t2>     Must contain any (OR)
  --size-gt <n>KB  --size-lt <n>KB
  --modified-after <YYYY-MM-DD>  --modified-before
  --created-after
  --type f|d|l               file / directory / symlink
  --depth <n>
  --exclude <dirs>
  --empty         Find empty files
  --duplicates    Find files with identical content
  --fmt slim|normal|json

Output --fmt slim:
  src/services/UserService.ts
  src/controllers/UserController.ts
  tests/UserService.test.ts
  ---
  3 files  ~8 tokens

Output --fmt normal (default):
  ok: true
  query: UserService  found: 3  ~tokens: 45
  ===
  src/services/UserService.ts        12.2 KB  342 lines  2025-03-10
  src/controllers/UserController.ts   8.4 KB  218 lines  2025-03-12
  tests/UserService.test.ts           5.1 KB  134 lines  2025-03-08

Output --fmt json:
  {
    "ok": true,
    "totalFound": 3,
    "results": [
      { "path": "src/services/UserService.ts", "type": "file",
        "size": 12480, "sizeHuman": "12.2 KB", "lines": 342,
        "modified": "2025-03-10T14:22:00Z" }
    ]
  }
```

---

### `adt refs <symbol> [path]`

Smarter than grep: categorizes imports, definitions, and usages separately.

```
Options:
  --type imports|defs|usages|types   Filter by category
  --files-only                       File list only
  --fmt slim|normal|json

Output --fmt slim:
  DEF  src/services/UserService.ts:18:export class UserService {
  IMP  src/controllers/UserController.ts:3:import { UserService } from '...'
  IMP  src/routes/user.routes.ts:2:import { UserService } from '...'
  USE  src/controllers/UserController.ts:22:new UserService(db)
  USE  src/app.ts:15:container.register(UserService)
  ---
  1 def  2 imports  2 usages  ~22 tokens

Output --fmt normal (default):
  ok: true
  symbol: UserService  totalRefs: 23  ~tokens: 80
  ===
  definitions (1):
    src/services/UserService.ts:18  export class UserService {

  imports (6):
    src/controllers/UserController.ts:3
    src/routes/user.routes.ts:2
    ...

  usages (14):
    src/controllers/UserController.ts:22  this.userService = new UserService(db);
    ...
```

---

## SYMBOL GROUP

---

### `adt symbols <file>`

```
Options:
  --type class|function|method|interface|type|enum|const
  --exported    Show only exported symbols
  --fmt slim|normal|json

Output --fmt slim:
  class   UserService          :18–340  exported
    ctor  constructor          :22–30
    meth  createUser    async  :32–78
    meth  findById      async  :80–102
    meth  updatePassword async :104–145
  ~tokens: 35

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts  symbols: 5  ~tokens: 80
  ===
  class UserService                        lines 18–340  [exported]
    constructor()                          lines 22–30
    async createUser(dto)     → Promise<User>  lines 32–78
    async findById(id)        → Promise<User>  lines 80–102
    async updatePassword(id,pwd) → void    lines 104–145

Output --fmt json:
  {
    "ok": true,
    "file": "src/services/UserService.ts",
    "symbols": [
      { "type": "class", "name": "UserService", "line": 18, "end": 340, "exported": true,
        "members": [
          { "type": "method", "name": "createUser", "line": 32, "end": 78,
            "async": true, "params": [{"name":"dto","type":"CreateUserDTO"}],
            "returns": "Promise<User>" }
        ]
      }
    ]
  }
```

---

### `adt def <symbol> [path]`

```
Output --fmt slim:
  src/services/OrderService.ts:44:async createOrder(userId:string, dto:CreateOrderDTO): Promise<Order>
  body :44–118  (75 lines)
  ~tokens: 18

Output --fmt normal (default):
  ok: true
  symbol: createOrder  found: 1  ~tokens: 45
  ===
  src/services/OrderService.ts
    type:    method (async)
    lines:   44–118  (75 lines)
    class:   OrderService  [exported]
    sig:     async createOrder(userId: string, dto: CreateOrderDTO): Promise<Order>
    params:  userId: string | dto: CreateOrderDTO
    returns: Promise<Order>

Output --fmt json:
  {
    "ok": true,
    "symbol": "createOrder",
    "definitions": [
      { "file": "src/services/OrderService.ts", "line": 44, "type": "method",
        "signature": "async createOrder(userId: string, dto: CreateOrderDTO): Promise<Order>",
        "bodyStart": 44, "bodyEnd": 118, "async": true,
        "params": [{"name":"userId","type":"string"},{"name":"dto","type":"CreateOrderDTO"}],
        "returns": "Promise<Order>" }
    ]
  }
```

---

### `adt sig <symbol> [path]` ⭐ slim default

Signature only, no body. Token savings: ~12 tokens vs ~500 tokens for the full function.

```
Output --fmt slim (default):
  src/services/OrderService.ts:44
  async createOrder(userId: string, dto: CreateOrderDTO, options?: CreateOrderOptions): Promise<Order>
  ~tokens: 12

Output --fmt normal:
  ok: true
  symbol: createOrder  file: src/services/OrderService.ts:44
  async createOrder(
    userId: string,
    dto: CreateOrderDTO,
    options?: CreateOrderOptions
  ): Promise<Order>

Output --fmt json:
  {
    "ok": true,
    "symbol": "createOrder",
    "file": "src/services/OrderService.ts",
    "line": 44,
    "signature": "async createOrder(userId: string, dto: CreateOrderDTO): Promise<Order>",
    "params": [
      { "name": "userId",  "type": "string",            "optional": false },
      { "name": "dto",     "type": "CreateOrderDTO",     "optional": false },
      { "name": "options", "type": "CreateOrderOptions", "optional": true  }
    ],
    "returnType": "Promise<Order>",
    "async": true,
    "tokenEstimate": 12
  }
```

---

### `adt callers <symbol> [path]`

```
Output --fmt slim:
  src/controllers/OrderController.ts:45:handleCreateOrder → createOrder
  src/services/CheckoutService.ts:88:processCheckout → createOrder
  ---
  2 callers  ~12 tokens

Output --fmt normal (default):
  ok: true
  symbol: createOrder  callers: 2  ~tokens: 55
  ===
  src/controllers/OrderController.ts:45
    caller:  handleCreateOrder
    call:    await this.orderService.createOrder(userId, dto);
    context> const { userId, ...dto } = req.body;   [line 44]

  src/services/CheckoutService.ts:88
    caller:  processCheckout
    call:    await this.orderSvc.createOrder(userId, cartDto);
```

---

### `adt callees <symbol> [path]`

```
Output --fmt slim:
  :46  this.userRepo.findById     [internal → src/repositories/UserRepository.ts]
  :52  this.#validate             [internal]
  :58  uuid.v4                    [external → uuid]
  :71  this.orderRepo.create      [internal → src/repositories/OrderRepository.ts]
  ~tokens: 22

Output --fmt normal (default):
  ok: true
  symbol: createOrder  callees: 4  ~tokens: 65
  ===
  line 46:  this.userRepo.findById(userId)
            → internal: src/repositories/UserRepository.ts
  line 52:  this.#validate(dto)
            → internal (private)
  line 58:  uuid.v4()
            → external: uuid
  line 71:  this.orderRepo.create(order)
            → internal: src/repositories/OrderRepository.ts
```

---

## EDIT GROUP

---

### `adt verify <file>` ⭐ slim default

**Critical command.** Validates that target lines contain expected content before patching.
Prevents "line drift" errors when file has changed or line numbers are wrong.

```
Usage:
  adt verify <file> --lines 45:52 --contains "createOrder" --fmt slim
  adt verify <file> --line 87 --exact "  return user.id;"

Options:
  --lines <n:m>       Line range
  --line <n>          Single line
  --expect <text>     Must contain (substring)
  --exact <text>      Must match exactly (whitespace included)
  --contains <regex>  Must match regex
  --fmt slim|normal|json

Output --fmt slim (default):
  # Success
  ok true  :45–52  matches "createOrder"
  45:  async createOrder(userId: string): Promise<Order> {

  # Failure
  ok false  :45  mismatch
  expected: createOrder
  actual:   async updateOrder(userId: string): Promise<Order> {
  tip: use outline to re-confirm line number

Output --fmt normal:
  ok: true
  file: src/services/UserService.ts  lines: 45–52  verified: true
  ---
  :45  async createOrder(userId: string): Promise<Order> {
  :46    const user = await this.userRepo.findById(userId);

Output --fmt json:
  { "ok": true, "verified": true,
    "lines": { "start": 45, "end": 52 },
    "actualContent": [
      { "n": 45, "text": "  async createOrder(userId: string): Promise<Order> {" }
    ]
  }
```

**AI Usage Protocol:**
```bash
# Always verify before patching
adt verify src/services/UserService.ts --lines 45:52 --contains "createOrder" --fmt slim
# If ok=true → apply patch
adt patch src/services/UserService.ts --replace 45:52 --with "..." --fmt slim
```

---

### `adt patch <file>`

```
Operations:
  --replace <n:m> --with "<text>"       Replace line range
  --insert-after <n> --content "<text>" Insert after line
  --insert-before <n> --content "<text>" Insert before line
  --delete <n:m>                        Delete line range

Options:
  --dry-run    Show diff without applying
  --no-backup  Skip backup
  --fmt slim|normal|json

Safety:
  - File hash taken before every patch
  - Backup stored at ~/.adt/backups/<hash>/
  - Operation logged to session
  - New hash recorded after patch (for diff)

Output --fmt slim:
  ok true  replace :45–52  -8 +6  total:340
  backup: ~/.adt/backups/a3f2b1c4/

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts
  op: replace  lines: 45–52  removed: 8  added: 6  new-total: 340
  backup: ~/.adt/backups/a3f2b1c4/UserService.ts
  ---
  @@ -45,8 +45,6 @@
  -  async createOrder(userId: string) {
  +  async createOrder(userId: string, opts?: Options) {
  ...

Output --fmt json:
  { "ok": true, "operation": "replace",
    "targetLines": { "start": 45, "end": 52 },
    "linesRemoved": 8, "linesAdded": 6, "newTotalLines": 340,
    "backupPath": "~/.adt/backups/a3f2b1c4/UserService.ts",
    "diff": "@@ -45,8 +45,6 @@\n...",
    "checksum": { "before": "a3f2b1c4", "after": "d8e9f012" }
  }
```

---

### `adt replace <target> <from> <to>`

```
Options:
  -r, --regex
  -i, --ignore-case
  --dry-run
  --ext <exts>
  --exclude <dirs>
  --limit <n>
  --fmt slim|normal|json

Output --fmt slim:
  ok true  23 replacements  7 files
  src/controllers/UserController.ts :3 :18 :45 :89

Output --fmt normal (default):
  ok: true
  from: UserService → to: AccountService  total: 23  files: 7
  ===
  src/controllers/UserController.ts  (4)  lines: 3, 18, 45, 89
  src/services/UserService.ts        (3)  lines: 18, 45, 102
  ...
```

---

### `adt create <path>`

```
Options:
  --template empty|class|interface|express-controller|react-component|jest-test
  --content "<text>"
  --overwrite
  --fmt slim|normal|json

Output --fmt slim:
  ok true  src/services/PaymentService.ts  12 lines

Output --fmt normal (default):
  ok: true
  created: src/services/PaymentService.ts
  template: class  size: 245 bytes  lines: 12
  ---
  export class PaymentService {
    constructor() {}
  }
```

---

### `adt move <source> <dest>`

```
Options:
  --update-imports    Auto-update import paths (default: true)
  --dry-run
  --fmt slim|normal|json

Output --fmt slim:
  ok true  src/services/User.ts → src/services/UserService.ts
  imports-updated: 5 files

Output --fmt normal (default):
  ok: true
  from: src/services/User.ts
  to:   src/services/UserService.ts
  imports-updated: 5
  ===
  src/controllers/UserController.ts:3
    old: from '../services/User'
    new: from '../services/UserService'
  ...
```

---

### `adt rename <old> <new> [path]`

Project-wide safe symbol or file rename. Smarter than `replace`: only renames in symbol/file context.

```
Options:
  --type symbol|file    What to rename (default: auto-detect)
  --dry-run
  --update-imports
  --fmt slim|normal|json

Output --fmt slim:
  ok true  UserService → AccountService  28 changes  9 files  [dry-run]

Output --fmt normal (default):
  ok: true
  type: symbol  old: UserService  new: AccountService
  total: 28 changes  files: 9  dry-run: false
  ===
  src/services/UserService.ts  (3)
    :18  export class UserService {  →  export class AccountService {
  ...
```

---

## MAP GROUP

---

### `adt map [dir]`

```
Output --fmt slim:
  Node.js/TypeScript  Express  Jest  npm
  src/ controllers/ services/ models/ utils/
  84 files  18 dirs

Output --fmt normal (default):
  ok: true
  root: /project
  stack: Node.js · TypeScript · Express · Jest · npm
  config: tsconfig.json  .eslintrc.js  jest.config.ts
  ---
  src/
    controllers/  (4 files)
    services/     (6 files)
    models/       (8 files)
    utils/        (5 files)
  tests/          (12 files)
  ---
  total: 84 files  18 dirs  ts:71  json:8  md:5
```

---

### `adt tree [dir]`

```
Options:
  -d, --depth <n>    Max depth (default: 3)
  --ext <exts>       Filter by extension
  --dirs-only        Directories only
  --show-size        Show file sizes
  --show-lines       Show line counts
  --gitignore        Respect .gitignore (default: true)
  --fmt slim|normal|json

Output --fmt slim:
  src/
  ├─ controllers/ UserController.ts OrderController.ts
  ├─ services/    UserService.ts(342) OrderService.ts(892)
  └─ models/      User.ts Order.ts

Output --fmt normal (default):
  src/
  ├── controllers/
  │   ├── UserController.ts      218 lines   8.4 KB
  │   └── OrderController.ts     186 lines   7.1 KB
  ├── services/
  │   ├── UserService.ts         342 lines  12.2 KB
  │   └── OrderService.ts        892 lines  34.8 KB
  └── models/
      ├── User.ts                 48 lines   1.8 KB
      └── Order.ts                62 lines   2.4 KB
```

---

### `adt stats [path]`

```
Output --fmt slim:
  71 files  8420 lines  6210 code  840 comments  1370 blank
  ts:68f/8200l  js:3f/220l
  largest: OrderService.ts:892  UserController.ts:654

Output --fmt normal (default):
  ok: true
  path: src/  ~tokens: 60
  ---
  files: 71    lines: 8420
  code: 6210   comments: 840   blank: 1370
  by extension:
    .ts  68 files  8200 lines  6050 code
    .js   3 files   220 lines   160 code
  largest files:
    src/services/OrderService.ts      892 lines
    src/controllers/UserController.ts  654 lines
  most complex:
    src/services/OrderService.ts  18 functions  2 classes  [HIGH]
```

---

### `adt deps [path]`

```
Options:
  --file <f>          Single file imports/exports
  --who-imports <f>   Reverse lookup
  --circular          Detect circular dependencies
  --depth <n>         Tree depth (default: 1)
  --external          External packages only
  --internal          Internal files only
  --fmt slim|normal|json

Output --fmt slim (--file):
  IMPORT uuid v4 [external]
  IMPORT ../models/Order Order [internal → src/models/Order.ts]
  EXPORT OrderService class :30
  EXPORT CreateOrderDTO interface :16

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  ---
  imports (8):
    external: uuid(v4)  express  bcrypt
    internal: ../models/Order(Order)  ../utils/db(db)  ...
  exports:
    OrderService      class      :30
    CreateOrderDTO    interface  :16

Output --fmt json:
  {
    "ok": true,
    "file": "src/services/OrderService.ts",
    "imports": [
      { "source": "uuid", "type": "named", "specifiers": ["v4"], "isExternal": true },
      { "source": "../models/Order", "specifiers": ["Order"],
        "isExternal": false, "resolvedPath": "src/models/Order.ts" }
    ],
    "exports": [
      { "name": "OrderService", "type": "class", "line": 30 }
    ]
  }
```

---

### `adt impact <target>`

```
Options:
  --symbol <name>    Analyze impact of a specific symbol
  --depth <n>        Impact chain depth (default: 2)
  --fmt slim|normal|json

Output --fmt slim:
  target: createUser  risk: MEDIUM
  direct: UserController.ts:45  UserController.ts:88
  indirect: user.routes.ts (via UserController)  app.ts (via routes)
  tests: UserService.test.ts (4 tests cover this)

Output --fmt normal (default):
  ok: true
  target: src/services/UserService.ts → symbol: createUser
  risk: MEDIUM  (4 direct usages, 3 test files)
  ---
  direct-dependents (2):
    src/controllers/UserController.ts
      :45  await this.userService.createUser(dto);
      :88  const user = this.userService.createUser(adminDto);

  indirect-dependents (2):
    src/routes/user.routes.ts          [via UserController, depth:2]
    src/app.ts                         [via routes, depth:3]

  test-coverage (1):
    tests/services/UserService.test.ts   4 tests cover createUser

Output --fmt json:
  {
    "ok": true,
    "symbol": "createUser",
    "riskLevel": "medium",
    "directDependents": [...],
    "indirectDependents": [...],
    "testFiles": [...]
  }
```

---

## GIT GROUP

---

### `adt git status`

```
Output --fmt slim:
  branch: feature/payment  ahead:2 behind:0
  M  src/services/PaymentService.ts  [staged]
  A  src/models/Payment.ts           [staged]
  M  src/controllers/OrderController.ts  [unstaged]
  ?  src/utils/crypto.ts             [untracked]

Output --fmt normal (default):
  ok: true
  branch: feature/payment-refactor
  upstream: origin/feature/payment-refactor  ahead: 2  behind: 0
  ---
  staged (2):
    M  src/services/PaymentService.ts
    A  src/models/Payment.ts
  unstaged (1):
    M  src/controllers/OrderController.ts
  untracked (1):
    ?  src/utils/crypto.ts

Output --fmt json:
  {
    "ok": true,
    "branch": "feature/payment-refactor",
    "ahead": 2, "behind": 0, "clean": false,
    "staged": [{ "status": "M", "file": "src/services/PaymentService.ts" }],
    "unstaged": [...],
    "untracked": [...],
    "conflicts": []
  }
```

---

### `adt git log`

```
Options:
  -n, --limit <n>            (default: 20)
  --author <name>
  --since <date|"3 days ago">
  --until <date>
  --file <path>              Commits affecting this file
  --grep <text>              Search commit messages
  --oneline                  Hash + message only
  --fmt slim|normal|json

Output --fmt slim:
  a1b2c3d  feat: add payment service            Dev  2025-03-15
  f9e8d7c  fix: null check in OrderService      Dev  2025-03-14
  b3c4d5e  refactor: extract validation logic   Dev  2025-03-13
  ---
  3 commits  ~25 tokens

Output --fmt normal (default):
  ok: true
  branch: main  limit: 3  ~tokens: 120
  ===
  a1b2c3d  2025-03-15  Dev
    feat: add payment service
    3 files changed: +145 -12
    src/services/PaymentService.ts  src/models/Payment.ts  tests/Payment.test.ts

  f9e8d7c  2025-03-14  Dev
    fix: null check in OrderService
    1 file changed: +3 -1
    src/services/OrderService.ts

Output --fmt json:
  {
    "ok": true,
    "commits": [
      { "hash": "a1b2c3d4", "hashShort": "a1b2c3d",
        "author": { "name": "Dev", "email": "dev@example.com" },
        "date": "2025-03-15T10:22:00Z",
        "message": "feat: add payment service",
        "filesChanged": 3, "insertions": 145, "deletions": 12,
        "files": ["src/services/PaymentService.ts", ...]
      }
    ]
  }
```

---

### `adt git diff`

```
Usage:
  adt git diff                    # unstaged
  adt git diff --staged           # staged
  adt git diff HEAD~1             # vs last commit
  adt git diff main feature/pay   # between two branches
  adt git diff --stat             # summary only

Output --fmt slim:
  M  src/services/PaymentService.ts  +120 -8
  M  src/models/Payment.ts           +45  -0
  ---
  2 files  +165 -8

Output --fmt normal (default):
  ok: true
  from: HEAD~1  to: HEAD  files: 2  +165 -8
  ===
  src/services/PaymentService.ts  (+120 -8)
    @@ -45,4 +45,8 @@
    -  async process() {
    +  async process(opts?: ProcessOptions) {
    +    if (!opts) opts = this.defaults;
    ...

Output --fmt json:
  {
    "ok": true,
    "summary": { "filesChanged": 2, "insertions": 165, "deletions": 8 },
    "files": [
      { "file": "src/services/PaymentService.ts",
        "status": "modified", "insertions": 120, "deletions": 8,
        "hunks": [
          { "oldStart": 45, "newStart": 45,
            "lines": [
              { "type": "removed", "text": "-  async process() {" },
              { "type": "added",   "text": "+  async process(opts?: ProcessOptions) {" }
            ]
          }
        ]
      }
    ]
  }
```

---

### `adt git blame <file>`

```
Options:
  --lines <n:m>   Specific lines only
  --fmt slim|normal|json

Output --fmt slim:
  :45  a1b2c3d  Dev  2025-03-10  async createOrder(userId: string): Promise<Order> {
  :46  a1b2c3d  Dev  2025-03-10    const user = await this.userRepo.findById(userId);
  :47  f9e8d7c  Dev  2025-03-14    if (!user) throw new NotFoundError('User');

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts  lines: 45–47
  ===
  :45  [a1b2c3d  Dev  2025-03-10]  async createOrder(userId: string): Promise<Order> {
  :46  [a1b2c3d  Dev  2025-03-10]    const user = await this.userRepo.findById(userId);
  :47  [f9e8d7c  Dev  2025-03-14]    if (!user) throw new NotFoundError('User');
```

---

### `adt git branch`

```
Sub-commands:
  adt git branch list
  adt git branch create <name> [--from <base>]
  adt git branch delete <name> [--force]
  adt git branch switch <name>
  adt git branch rename <old> <new>
  adt git branch current

Output --fmt slim (list):
  * feature/payment-refactor  ahead:2  a1b2c3d feat: add payment service
    main                       behind:3  f9e8d7c chore: update deps
    fix/null-check                       b3c4d5e fix: null check

Output --fmt normal (default):
  ok: true
  current: feature/payment-refactor
  ===
  * feature/payment-refactor    2025-03-15  ahead:2  behind:0
      a1b2c3d  feat: add payment service

    main                         2025-03-14  ahead:0  behind:3
      f9e8d7c  chore: update deps

    fix/null-check               2025-03-13
      b3c4d5e  fix: null check
```

---

### `adt git commit`

```
Usage:
  adt git commit --message "feat: add payment service"
  adt git commit --message "fix: null check" --amend

Output --fmt slim:
  ok true  a1b2c3d  "feat: add payment service"  3 files +145 -12

Output --fmt normal (default):
  ok: true
  hash: a1b2c3d4e5f6  (short: a1b2c3d)
  branch: feature/payment-refactor
  message: feat: add payment service
  changed: 3 files  +145 -12
```

---

### `adt git stash`

```
Sub-commands:
  adt git stash save [message]
  adt git stash list
  adt git stash pop [index]
  adt git stash apply [index]
  adt git stash drop [index]
  adt git stash show [index]
  adt git stash clear

Output --fmt slim (list):
  [0]  stash@{0}  feature/payment  "WIP: payment refactor"  2025-03-15  3 files
  [1]  stash@{1}  main             "temp changes"            2025-03-14  1 file

Output --fmt normal (default):
  ok: true
  stashes: 2
  ===
  stash@{0}  feature/payment  2025-03-15
    WIP: payment refactor
    3 files changed

  stash@{1}  main  2025-03-14
    temp changes
    1 file changed
```

---

### `adt git reset`

```
Usage:
  adt git reset --soft HEAD~1    # Undo commit, keep staged
  adt git reset --mixed HEAD~1   # Undo commit, unstage
  adt git reset --hard HEAD~1    # Undo commit + changes (destructive)
  adt git reset HEAD src/file.ts # Unstage single file

Output --fmt slim:
  ok true  soft  HEAD~1  reverted: "feat: add payment service" (a1b2c3d)  3 files

Output --fmt normal (default):
  ok: true
  mode: soft  to: HEAD~1
  reverted: a1b2c3d  "feat: add payment service"
  files-affected: 3
  state: changes moved to staged area
```

---

### `adt git merge <branch>`

```
Options:
  --no-ff       Force merge commit
  --squash      Squash all commits into one
  --abort       Abort ongoing merge
  --dry-run     Conflict risk analysis (no merge)
  --fmt slim|normal|json

Output --fmt slim:
  ok true  feature/payment → main  5 commits  8 files  0 conflicts

Output --fmt normal (default):
  ok: true
  merged: feature/payment → main
  method: merge-commit  hash: b2c3d4e5
  commits: 5  files: 8  conflicts: 0
```

---

### `adt git tag`

```
Sub-commands:
  adt git tag list
  adt git tag create <name> [--message "..."] [--commit <hash>]
  adt git tag delete <name>
  adt git tag push <name>
  adt git tag push --all
```

---

### `adt git cherry-pick <hash>`

```
Output --fmt slim:
  ok true  picked: a1b2c3d  new: x9y8z7w  "fix: null check"  0 conflicts
```

---

## SHELL GROUP

---

### `adt exec "<command>"`

Runs a Bash or PowerShell command. Exit code, stdout, stderr returned as separate fields.
Solves the AI's biggest problem: "did this command succeed?"

```
Options:
  --shell bash|powershell|cmd|auto   Shell (default: auto = platform-based)
  --cwd <dir>                        Working directory
  --env <KEY=VALUE,...>              Add environment variables
  --timeout <seconds>                Max duration (default: 30)
  --stdin <text>                     Stdin input
  --fmt slim|normal|json

Output --fmt slim:
  # Success
  ok true  exit:0  12.3s
  added 248 packages in 12s

  # Failure
  ok false  exit:1  4.2s
  stderr: error TS2345: Argument of type 'string' is not assignable to 'number'

Output --fmt normal (default):
  ok: true
  command: npm install
  shell: bash  cwd: /project
  exit: 0  duration: 12340ms
  ---
  stdout:
    added 248 packages in 12s

Output --fmt json:
  {
    "ok": true,
    "shell": "bash",
    "ran": "npm install",
    "exitCode": 0,
    "success": true,
    "stdout": "added 248 packages in 12s",
    "stderr": "",
    "duration": 12340,
    "timedOut": false
  }
```

---

### `adt run <script>`

```
Usage:
  adt run npm:build              # package.json script
  adt run npm:test -- --watch=false
  adt run scripts/migrate.py     # Direct file
  adt run ./bin/server --port 3000

Output --fmt slim:
  ok true  exit:0  8.4s  npm:build → tsc --build
```

---

### `adt env`

```
Sub-commands:
  adt env list                      List all env variables
  adt env get <KEY> [KEY2...]       Get specific variables
  adt env check <KEY1> <KEY2...>    Are required variables present?
  adt env load <file>               Load from .env file
  adt env diff <f1> <f2>            Compare two .env files
  adt env set <KEY>=<VALUE>         Set for current session

Output --fmt slim (check):
  ok false
  ✓ DATABASE_URL
  ✗ REDIS_URL  [MISSING]
  ✓ JWT_SECRET
  tip: add REDIS_URL to your .env file

Output --fmt normal (default, diff):
  ok: true
  fileA: .env  fileB: .env.production
  ===
  only in .env:
    DEBUG=true
    LOG_LEVEL=debug

  only in .env.production:
    LOG_LEVEL=error
    SENTRY_DSN=https://...

  different values:
    DATABASE_URL:
      .env:        postgres://localhost/dev
      .production: postgres://prod-host/app

  same (12): PORT  JWT_ALGORITHM  APP_NAME  ...
```

---

### `adt platform`

```
Output --fmt slim:
  linux x64  bash:5.2.15  node:20.11.0  npm:10.2.4  git:2.43.0  python:3.12.2
  cwd:/project  ci:false  wsl:false

Output --fmt normal (default):
  ok: true
  os: linux (Ubuntu 24.04)  arch: x64
  shell: bash 5.2.15
  ---
  node: 20.11.0    npm: 10.2.4
  git: 2.43.0      python: 3.12.2
  cwd: /project    home: /home/user
  separator: /     line-ending: LF
  ci: false        wsl: false
```

---

### `adt which <commands...>`

```
Output --fmt slim:
  ✓ node    /usr/local/bin/node    20.11.0
  ✓ python  /usr/bin/python3       3.12.2
  ✗ tsc     not found  [tip: npm install -g typescript]
```

---

## QUALITY GROUP

---

### `adt lint [path]`

Auto-detects the project linter (ESLint, pylint, golint...) and normalizes output.

```
Options:
  --tool eslint|pylint|golint|rubocop|auto  (default: auto)
  --fix   Auto-fix what can be fixed
  --fmt slim|normal|json

Output --fmt slim:
  src/services/UserService.ts:45:3  ERROR  no-unused-vars  'oldMethod' never used
  src/controllers/OrderController.ts:88:12  WARN  no-explicit-any  Unexpected any
  ---
  5 errors  12 warnings  8 fixable  eslint

Output --fmt normal (default):
  ok: false
  tool: eslint  files: 68  errors: 5  warnings: 12  fixable: 8
  ===
  src/services/UserService.ts
    :45:3   ERROR  no-unused-vars    'oldMethod' is defined but never used  [fixable]
    :102:8  WARN   prefer-const      Use const instead of let

  src/controllers/OrderController.ts
    :88:12  WARN   @ts/no-explicit-any  Unexpected any. Specify a different type.

Output --fmt json:
  {
    "ok": false,
    "tool": "eslint",
    "errorCount": 5, "warningCount": 12, "fixableCount": 8,
    "issues": [
      { "file": "src/services/UserService.ts", "line": 45, "col": 3,
        "severity": "error", "rule": "no-unused-vars",
        "message": "'oldMethod' is defined but never used.", "fixable": true }
    ]
  }
```

---

### `adt test [path]`

Auto-detects test runner (Jest, pytest, go test...) and normalizes output.

```
Options:
  --tool jest|pytest|go-test|mocha|auto  (default: auto)
  --grep <pattern>   Filter tests by name
  --coverage         Include coverage report
  --fmt slim|normal|json

Output --fmt slim:
  PASS 82  FAIL 5  SKIP 0  8.4s
  FAIL OrderService > should throw if user not found
       Expected: Error('User not found') | Got: Error('User does not exist')
       tests/services/OrderService.test.ts:45

Output --fmt normal (default):
  ok: false
  tool: jest  duration: 8.4s
  suites: 12  tests: 87  passed: 82  failed: 5  skipped: 0
  coverage: statements:84.2%  branches:71.5%  functions:88%  lines:85.1%
  ===
  FAILED (5):

  OrderService > should throw if user not found
    tests/services/OrderService.test.ts:45
    Expected: Error('User not found')
    Received: Error('User does not exist')

Output --fmt json:
  {
    "ok": false,
    "tool": "jest", "duration": 8420,
    "passed": 82, "failed": 5,
    "coverage": { "statements": 84.2, "branches": 71.5 },
    "failures": [
      { "suite": "OrderService", "test": "should throw if user not found",
        "file": "tests/services/OrderService.test.ts", "line": 45,
        "error": "Expected: Error('User not found')\nReceived: Error('User does not exist')" }
    ]
  }
```

---

### `adt typecheck [path]`

```
Output --fmt slim:
  src/services/OrderService.ts:88:12  TS2345  string not assignable to number
  src/models/Payment.ts:34:5  TS2322  Type null not assignable to string
  ---
  3 errors  tsc

Output --fmt normal (default):
  ok: false
  tool: tsc  errors: 3
  ===
  src/services/OrderService.ts:88:12
    TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.

  src/models/Payment.ts:34:5
    TS2322: Type 'null' is not assignable to type 'string'.
```

---

### `adt format [path]`

```
Options:
  --tool prettier|black|gofmt|auto
  --check    Check only, do not modify
  --fmt slim|normal|json

Output --fmt slim:
  ok true  5 files formatted  prettier

Output --fmt normal (default):
  ok: true
  tool: prettier  formatted: 5  skipped: 63
  ===
  src/services/UserService.ts
  src/models/Order.ts
  src/utils/hash.ts
```

---

## SESSION GROUP

---

### `adt session`

```
Sub-commands:
  adt session show     Full session detail
  adt session reads    Files read
  adt session writes   Files modified
  adt session tokens   Token usage summary
  adt session clear    Reset session

Output --fmt slim:
  sess_20250315_a3b2  00:47:33
  read: 8 files  write: 3 files  patches: 5  git: 4 ops  exec: 2 cmds
  tokens: ~4820

Output --fmt normal (default):
  ok: true
  session: sess_20250315_a3b2  duration: 00:47:33
  ---
  reads (8 files):
    src/services/UserService.ts       ×3  ~1120 tokens
    src/services/OrderService.ts      ×2   ~840 tokens

  writes (3 files):
    src/services/UserService.ts       2 patches (replace:45–52, insert-after:30)

  git operations (4):
    git add     src/  2025-03-15T10:00
    git commit  a1b2c3d  "feat: ..."  2025-03-15T10:01
    git push    origin   2025-03-15T10:02

  exec (2):
    npm run build  exit:0  8.4s
    npm test       exit:1  12.2s

  token summary:
    reads: ~3200   greps: ~420   git: ~640   exec: ~560
    total: ~4820
```

---

### `adt diff <file>`

```
Output --fmt slim:
  src/services/UserService.ts  a3f2b1c4 → d8e9f012
  @@ -45,8 +45,6 @@  -8 +6

Output --fmt normal (default):
  ok: true
  file: src/services/UserService.ts
  before: a3f2b1c4  after: d8e9f012
  total: +6 -8
  ---
  @@ -45,8 +45,6 @@
  -  async createOrder(userId: string) {
  +  async createOrder(userId: string, opts?: Options) {
```

---

### `adt undo <file>`

```
Output --fmt slim:
  ok true  src/services/UserService.ts  restored from ~/.adt/backups/a3f2b1c4/
```

---

### `adt checkpoint [name]`

```
Usage:
  adt checkpoint "before-refactor"
  adt checkpoint restore "before-refactor"
  adt checkpoint list
  adt checkpoint diff "before-refactor"

Options:
  --files <globs>
  --fmt slim|normal|json
```

---

## UTILITY GROUP

---

### `adt info <file>`

```
Output --fmt slim:
  TypeScript  12.2KB  342 lines  utf-8  LF  noBOM  readable

Output --fmt normal (default):
  ok: true
  path: src/services/UserService.ts
  type: TypeScript  size: 12.2 KB  lines: 342
  encoding: utf-8  confidence: 99%  BOM: false
  line-ending: LF  binary: false  readable: true
  modified: 2025-03-10T14:22:00Z
  permissions: rw-r--r--

Output --fmt json:
  { "ok": true, "path": "src/services/UserService.ts",
    "type": "file", "size": 12480, "sizeHuman": "12.2 KB",
    "mimeType": "text/plain", "isBinary": false,
    "encoding": "utf-8", "confidence": 0.99, "hasBOM": false,
    "lineEnding": "LF", "totalLines": 342,
    "modified": "2025-03-10T14:22:00Z", "language": "TypeScript" }
```

---

### `adt safe <file>`

```
Output --fmt slim (unsafe):
  ok false  binary  image/png
  tip: adt info assets/logo.png

Output --fmt slim (safe):
  ok true  readable  TypeScript
```

---

### `adt hash <file>`

```
Options:
  --algo md5|sha1|sha256 (default: sha256)
  --recursive

Output --fmt slim:
  a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0  sha256  src/services/UserService.ts
```

---

### `adt watch <path>`

```
Options:
  --on-change <cmd>   Command to run on change
  --ext <exts>        Watch only these extensions
  --ignore <patterns>
  --fmt slim|normal|json

Usage:
  adt watch src/ --on-change "adt lint src/ --fmt slim"
```

---

## NEW COMMAND GROUPS — Details

---

## CONTEXT GROUP

The AI's "project memory". Loaded at session start so the AI doesn't rediscover conventions and decisions from scratch every time. Stored as JSON in `~/.adt/context/<project>/`.

---

### `adt context`

```
Sub-commands:
  adt context set "<key>" "<value>"    Save a piece of information
  adt context get [key]                Read all or a single key
  adt context decisions                Architectural decisions log
  adt context conventions              Code standards
  adt context clear                    Reset

Examples:
  adt context set "arch" "Repository pattern. Services never access DB directly."
  adt context set "naming" "camelCase functions, PascalCase classes, SCREAMING_SNAKE env vars"
  adt context set "error-handling" "All async functions use try/catch + logger.error"
  adt context decisions add "2025-03-15: UUID v7 chosen over v4 for sequential DB indexing"

Output --fmt slim (get):
  arch: Repository pattern. Services never access DB directly.
  naming: camelCase fn | PascalCase class | SCREAMING_SNAKE env
  error-handling: async → try/catch + logger.error
  test-runner: jest  coverage-threshold: 80%
  ~tokens: 35

Output --fmt normal (default, get):
  ok: true
  project: my-project
  entries: 6  last-updated: 2025-03-15
  ===
  arch:           Repository pattern. Services never access DB directly.
  naming:         camelCase fn | PascalCase class | SCREAMING_SNAKE env
  error-handling: async → try/catch + logger.error
  test-runner:    jest  threshold: 80%
  decisions (2):
    2025-03-15: UUID v7 chosen (sequential → better DB index performance)
    2025-03-10: Monorepo managed with turborepo
```

**AI Usage Protocol:**
```bash
# At the start of every session — single command, ~35 tokens
adt context get --fmt slim

# Save a new decision
adt context decisions add "2025-03-15: Redis cache added to payment service"
```

---

## PATTERN GROUP

Detects code patterns already in use so the AI can write consistent new code.

---

### `adt pattern find "<topic>" [path]`

```
Usage:
  adt pattern find "error handling" src/
  adt pattern find "api response format" src/
  adt pattern find "dependency injection" src/
  adt pattern similar src/services/UserService.ts

Method: AST analysis + frequency statistics of common code structures.
E.g.: try/catch usage rate, response wrapper pattern, DI container usage.

Output --fmt slim:
  error-handling: try/catch+logger.error (87% of files)
    example: src/services/UserService.ts:45
  response-format: { ok, data, error } wrapper (92% of endpoints)
    example: src/controllers/UserController.ts:33
  ~tokens: 28

Output --fmt normal (default):
  ok: true
  topic: error handling  files-analyzed: 68  ~tokens: 65
  ===
  dominant-pattern: try/catch + logger.error  (87% — 59/68 files)
    async createUser() {
      try { ... }
      catch (err) { logger.error('createUser failed', err); throw err; }
    }
  example-files:
    src/services/UserService.ts:45
    src/services/OrderService.ts:88
  minority-pattern: Promise.catch chain  (13% — 9/68 files)
    example: src/legacy/OldService.ts:12
```

---

### `adt pattern similar <file> [path]`

```
Output --fmt slim:
  src/services/OrderService.ts       similarity:94%
  src/services/PaymentService.ts     similarity:88%
  src/services/InvoiceService.ts     similarity:81%
  ~tokens: 20

Output --fmt normal (default):
  ok: true
  reference: src/services/UserService.ts
  ===
  src/services/OrderService.ts    94%  (same class structure, async methods, repo injection)
  src/services/PaymentService.ts  88%  (similar but adds event emission)
  src/services/InvoiceService.ts  81%  (same pattern, extra validation layer)
```

---

## TASK GROUP

Cross-session task tracking. Stored in `.adt-tasks.json` at project root.

---

### `adt task`

```
Sub-commands:
  adt task create "<title>" [--desc "<description>"]
  adt task list [--status open|done|all]
  adt task status               Active task + completed steps
  adt task step add <id> "<step>"
  adt task step done <id> <step-no>
  adt task done <id>
  adt task context <id>         Files read/modified for this task

Examples:
  adt task create "PaymentService refactor"
  adt task step add T1 "1. Define IPaymentService interface"
  adt task step add T1 "2. Isolate Stripe integration"
  adt task step add T1 "3. Write tests"
  adt task step done T1 1

Output --fmt slim (status):
  T1 PaymentService refactor  [2/3 steps]
  ✓ 1. Define IPaymentService interface
  ✓ 2. Isolate Stripe integration
  ○ 3. Write tests
  ~tokens: 20

Output --fmt normal (default, status):
  ok: true
  task: T1  PaymentService refactor
  progress: 2/3 steps  created: 2025-03-15
  ===
  ✓  step 1: Define IPaymentService interface
  ✓  step 2: Isolate Stripe integration
  ○  step 3: Write tests  ← CURRENT
  related-files (from session):
    src/services/PaymentService.ts    (modified ×2)
    src/interfaces/IPaymentService.ts  (created)
```

---

## GENERATE GROUP

Generates boilerplate according to the project's own conventions. Templates are not static — they are learned from existing code.

---

### `adt generate <type> <name> [options]`

```
Types:
  service       Service class
  model         Model/entity/DTO
  controller    HTTP controller
  test          Test file
  repository    Repository class
  middleware    Middleware

Options:
  --fields "<name:type,...>"   Model fields
  --extends <base>             Parent class
  --implements <interface>     Interface to implement
  --from-pattern               Use pattern learned from project (default: true)
  --dry-run                    Show content, do not save
  --fmt slim|normal|json

Examples:
  adt generate service PaymentService --fmt normal
  adt generate model Payment --fields "amount:number,currency:string,status:PaymentStatus"
  adt generate test PaymentService --fmt normal
  adt generate controller PaymentController --implements IPaymentController

Output --fmt slim:
  ok true  src/services/PaymentService.ts  created  28 lines

Output --fmt normal (default):
  ok: true
  generated: src/services/PaymentService.ts
  template: service (learned from 6 existing services)
  lines: 28
  ---
  import { Injectable } from '../decorators';
  import { IPaymentService } from '../interfaces/IPaymentService';
  import { PaymentRepository } from '../repositories/PaymentRepository';
  import { logger } from '../utils/logger';

  @Injectable()
  export class PaymentService implements IPaymentService {
    constructor(private readonly repo: PaymentRepository) {}

    async create(dto: CreatePaymentDTO): Promise<Payment> {
      try {
        return await this.repo.create(dto);
      } catch (err) {
        logger.error('PaymentService.create failed', err);
        throw err;
      }
    }
  }
```

---

## API GROUP

Extracts the project's endpoint map from Express, Fastify, or NestJS router analysis.

---

### `adt api list [path]`

```
Output --fmt slim:
  GET    /api/users             UserController.getAll        :src/controllers/UserController.ts:22
  POST   /api/users             UserController.create        :src/controllers/UserController.ts:35
  GET    /api/users/:id         UserController.getById       :src/controllers/UserController.ts:48
  POST   /api/orders            OrderController.create       :src/controllers/OrderController.ts:18
  ---
  24 endpoints  6 controllers  ~45 tokens

Output --fmt normal (default):
  ok: true
  framework: express  endpoints: 24  controllers: 6  ~tokens: 110
  ===
  /api/users
    GET    → UserController.getAll        :22  [auth: JWT]
    POST   → UserController.create        :35  [auth: JWT]  [validate: CreateUserDTO]
    GET /:id → UserController.getById     :48  [auth: JWT]

  /api/orders
    POST   → OrderController.create       :18  [auth: JWT]  [validate: CreateOrderDTO]
    GET /:id → OrderController.getById    :34  [auth: JWT]
```

---

### `adt api find "<pattern>" [path]`

```
Output --fmt slim:
  POST /api/payments            PaymentController.create  :src/controllers/PaymentController.ts:22
  GET  /api/payments/:id        PaymentController.getById :src/controllers/PaymentController.ts:35
  ---
  2 matches  ~10 tokens
```

---

### `adt package usage <pkg> [path]`

```
Output --fmt slim:
  bcrypt  8 usages  4 files
  src/services/UserService.ts:12:  bcrypt.hash(password, 10)
  src/services/AuthService.ts:34:  await bcrypt.compare(pass, hash)
  ~tokens: 22

Output --fmt normal (default):
  ok: true
  package: bcrypt  usages: 8  files: 4
  ===
  src/services/UserService.ts (3)
    :12  bcrypt.hash(password, 10)
    :45  await bcrypt.compare(inputPass, user.password)
    :78  const salt = await bcrypt.genSalt(12)
```

---

## RISK & COVERAGE GROUP

---

### `adt risk file <file>`

Composite risk score: churn (how often changed) + cyclomatic complexity + test coverage.

```
Output --fmt slim:
  src/services/OrderService.ts
  risk: HIGH  score: 78/100
  churn: 23 changes/30days  complexity: HIGH  coverage: 61%
  ~tokens: 18

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  risk-score: 78/100  [HIGH]
  ---
  churn:       23 changes in last 30 days  [HIGH — top 5%]
  complexity:  avg cyclomatic: 8.2  max: 24 (processPayment)  [HIGH]
  coverage:    61%  [LOW — threshold: 80%]
  last-change: 2025-03-15  authors: 3
  ---
  recommendation: Refactor processPayment (:88–210, complexity:24). Add tests for uncovered branches.
```

---

### `adt risk hotspot [path]`

```
Output --fmt slim:
  src/services/OrderService.ts       score:78  churn:23/mo  cov:61%
  src/controllers/UserController.ts  score:71  churn:18/mo  cov:72%
  src/utils/payment-calc.ts          score:65  churn:8/mo   cov:45%
  ---
  top 3 of 71 files  ~20 tokens

Output --fmt normal (default):
  ok: true
  path: src/  analyzed: 71 files
  ===
  rank  file                                score  churn   complexity  coverage
   1    src/services/OrderService.ts         78    23/mo   HIGH        61%
   2    src/controllers/UserController.ts    71    18/mo   MEDIUM      72%
   3    src/utils/payment-calc.ts            65     8/mo   HIGH        45%
   4    src/services/InvoiceService.ts       58    12/mo   MEDIUM      68%
   5    src/models/Order.ts                  52     5/mo   LOW         55%
```

---

### `adt coverage report [path]`

```
Output --fmt slim:
  overall: 74.2% statements  71.5% branches  88% functions  75.1% lines
  uncovered-files: 8  low-coverage (<50%): 3

Output --fmt normal (default):
  ok: true
  tool: jest  path: src/
  ===
  overall:
    statements: 74.2%   branches: 71.5%
    functions:  88.0%   lines:    75.1%
  threshold: 80%  status: BELOW

  low-coverage files (<50%):
    src/utils/payment-calc.ts       34%  (12/35 lines)
    src/services/InvoiceService.ts  48%  (44/92 lines)

  uncovered functions (no tests at all):
    calculateTax()           src/utils/payment-calc.ts:18
    generateInvoicePDF()     src/services/InvoiceService.ts:145
```

---

### `adt coverage file <file>`

```
Output --fmt slim:
  src/services/OrderService.ts  61%  (180/295 lines covered)
  uncovered-lines: 45-52 88-102 145-178 210-240
  uncovered-fns: processRefund validateInventory

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  coverage: 61%  lines: 180/295  functions: 7/10
  ===
  uncovered-ranges:
    lines 45–52:    validateInventory()  [never tested]
    lines 88–102:   error handling branch  [partial]
    lines 145–178:  processRefund()  [never tested]

  uncovered-functions:
    validateInventory()   :45  [0 tests]
    processRefund()       :145 [0 tests]
```

---

## SECURITY GROUP

---

### `adt security scan [path]`

Scans for known vulnerability patterns via static analysis. Uses `semgrep` if installed, falls back to built-in regex patterns.

```
Output --fmt slim:
  CRIT  src/controllers/UserController.ts:45  sql-injection  raw query + user input
  HIGH  src/services/AuthService.ts:88        hardcoded-secret  JWT_SECRET literal
  MED   src/utils/upload.ts:23               path-traversal   user-controlled path
  ---
  1 critical  1 high  1 medium  ~25 tokens

Output --fmt normal (default):
  ok: false
  files-scanned: 68  issues: 3  (critical:1 high:1 medium:1)
  ===
  CRITICAL  sql-injection
    src/controllers/UserController.ts:45
    raw: `SELECT * FROM users WHERE id = ${req.params.id}`
    fix: Use parameterized query: db.query('SELECT * FROM users WHERE id = ?', [id])

  HIGH  hardcoded-secret
    src/services/AuthService.ts:88
    raw: const JWT_SECRET = 'my-super-secret-key-123'
    fix: Use process.env.JWT_SECRET

  MEDIUM  path-traversal
    src/utils/upload.ts:23
    raw: fs.readFile(path.join('/uploads', req.body.filename))
    fix: Sanitize filename: path.basename(req.body.filename)
```

---

### `adt security secrets [path]`

Detects API keys, passwords, and tokens embedded in code.

```
Output --fmt slim:
  src/config/db.ts:12      DATABASE_PASSWORD literal  "adm***23" (masked)
  src/services/sms.ts:8    API_KEY literal             "sk_live_***" (masked)
  src/legacy/old.ts:45     PRIVATE_KEY pem block
  ---
  3 secrets found  ~18 tokens

Output --fmt normal (default):
  ok: false
  secrets-found: 3
  ===
  src/config/db.ts:12
    type: password  value: "adm***23" (masked)
    fix: Move to .env → DATABASE_PASSWORD

  src/services/sms.ts:8
    type: api-key  value: "sk_live_***" (masked)
    fix: Move to .env → SMS_API_KEY

  src/legacy/old.ts:45
    type: private-key  (RSA PEM block)
    fix: Remove immediately. Rotate the key.
```

---

### `adt security cve [path]`

```
Output --fmt slim:
  lodash@4.17.15  CVE-2021-23337  HIGH   prototype pollution
  axios@0.21.1    CVE-2021-3749   HIGH   SSRF
  ---
  2 vulnerabilities  npm audit  ~15 tokens

Output --fmt normal (default):
  ok: false
  tool: npm audit  vulnerabilities: 2  (high:2)
  ===
  lodash@4.17.15  [HIGH]  CVE-2021-23337
    Prototype Pollution via argument pollution
    fix: npm install lodash@4.17.21

  axios@0.21.1  [HIGH]  CVE-2021-3749
    Server-Side Request Forgery
    fix: npm install axios@0.21.4
```

---

## HISTORY GROUP

---

### `adt history file <file>`

```
Output --fmt slim:
  892 lines  23 commits/30days  3 authors  HIGH-churn
  first: 2024-08-01  last: 2025-03-15

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  created: 2024-08-01  last-modified: 2025-03-15
  total-commits: 87  last-30-days: 23  [HIGH churn]
  authors: Dev1(68%)  Dev2(22%)  CI-Bot(10%)
  ===
  recent changes:
    2025-03-15  a1b2c3d  Dev1  feat: add bulk order support  (+145 -12)
    2025-03-14  f9e8d7c  Dev1  fix: null check in processPayment  (+3 -1)
    2025-03-12  b3c4d5e  Dev2  refactor: extract validation  (+88 -120)
```

---

### `adt history fn <symbol> [path]`

```
Output --fmt slim:
  createOrder  first:2024-08-01  changes:12  last:2025-03-15
  :44–90 → :44–118 (grew +28 lines over time)

Output --fmt normal (default):
  ok: true
  symbol: createOrder  file: src/services/OrderService.ts
  first-seen: 2024-08-01  changes: 12
  line-range: originally :44–90 → now :44–118  (+28 lines)
  ===
  evolution:
    2024-08-01  abc123  initial implementation  (47 lines)
    2024-09-12  def456  added inventory check   (+8 lines)
    2024-11-20  ghi789  added event emission     (+5 lines)
    2025-01-15  jkl012  refactored validation    (-12 +18 lines)
    2025-03-14  f9e8d7c fixed null check          (+1 line)
```

---

### `adt history why <file>:<line>`

Explains why a line was added, via commit message and PR description.

```
Output --fmt slim:
  src/services/OrderService.ts:88
  f9e8d7c  Dev  2025-03-14  fix: null check in processPayment
  PR: #142  "Fixes NullPointerException when order has no items"

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts  line: 88
  text: if (!order.items || order.items.length === 0) throw new ValidationError('...')
  ===
  commit: f9e8d7c
  author: Dev  date: 2025-03-14
  message: fix: null check in processPayment
  pr: #142  "Fixes NullPointerException when order has no items"
  related-issue: #138  "App crashes on empty cart checkout"
```

---

### `adt history churn [path]`

```
Output --fmt slim:
  src/services/OrderService.ts      23 changes/30d  HIGH
  src/controllers/UserController.ts  18 changes/30d  HIGH
  src/utils/payment-calc.ts          8 changes/30d  MEDIUM
  ---
  top 3 churners  ~15 tokens

Output --fmt normal (default):
  ok: true
  period: 30 days  files-analyzed: 71
  ===
  HIGH churn (>15 changes/month):
    src/services/OrderService.ts         23  (instability: 0.87)
    src/controllers/UserController.ts    18  (instability: 0.72)

  MEDIUM (5–15):
    src/utils/payment-calc.ts             8
    src/services/InvoiceService.ts        6

  note: High churn + low coverage = highest risk combination
```

---

## COMPLEXITY & DEAD CODE GROUP

---

### `adt complexity file <file>`

```
Output --fmt slim:
  src/services/OrderService.ts  avg:8.2  max:24(processPayment:88)  HIGH
  long-fns: processPayment(131lines) validateInventory(58lines)

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  overall: HIGH  avg-cyclomatic: 8.2  max: 24
  ===
  function               lines  cyclomatic  cognitive  rating
  processPayment()       :88    131         24          HIGH  ← refactor candidate
  validateInventory()    :45    58          12          HIGH
  create()               :220   28           6          MEDIUM
  findById()             :250   12           2          LOW

  recommendation:
    processPayment() exceeds threshold (max:15). Split into:
    → validatePaymentMethod(), chargeCard(), emitPaymentEvent()
```

---

### `adt complexity hotspot [path]`

```
Output --fmt slim:
  src/services/OrderService.ts    HIGH  avg:8.2  max:24
  src/utils/payment-calc.ts       HIGH  avg:7.1  max:19
  src/services/InvoiceService.ts  MED   avg:4.8  max:11
  ~tokens: 22
```

---

### `adt complexity debt [path]`

Technical debt summary: complex + long + untested code combined.

```
Output --fmt slim:
  debt-score: 62/100  HIGH
  critical: 3 functions  (complex + untested)
  ~tokens: 15

Output --fmt normal (default):
  ok: true
  path: src/  debt-score: 62/100  [HIGH]
  ===
  critical debt (high complexity + no tests):
    processPayment()     :OrderService.ts:88    complexity:24  coverage:0%
    calculateTax()       :payment-calc.ts:18    complexity:19  coverage:34%
    generatePDF()        :InvoiceService.ts:145 complexity:11  coverage:0%

  long files (>500 lines):
    src/services/OrderService.ts     892 lines → split recommended

  recommendations (priority order):
    1. Test processPayment() — critical risk, 0% coverage
    2. Split OrderService.ts — too large, high churn
    3. Refactor calculateTax() — complex + low coverage
```

---

### `adt dead code [path]`

```
Output --fmt slim:
  src/utils/old-formatter.ts:12  formatLegacyDate()  0 callers
  src/services/UserService.ts:280 #oldValidate()      0 callers
  src/helpers/unused.ts:1        (whole file)         0 imports
  ---
  3 dead symbols  1 dead file  ~18 tokens

Output --fmt normal (default):
  ok: true
  dead-functions: 3  dead-files: 1
  ===
  dead functions (0 callers):
    formatLegacyDate()  src/utils/old-formatter.ts:12
    #oldValidate()      src/services/UserService.ts:280  [private]
    legacyExport()      src/legacy/export.ts:45  [exported but never imported]

  dead files (0 imports):
    src/helpers/unused.ts  (4 exports, none used anywhere)

  note: Verify before deleting — may be used by external scripts
```

---

### `adt duplicate code [path]`

```
Options:
  --threshold <0-100>   Similarity threshold (default: 85)
  --min-lines <n>       Minimum lines (default: 10)
  --fmt slim|normal|json

Output --fmt slim:
  src/services/UserService.ts:45–78  ↔  src/services/AdminService.ts:32–65  (91%)
  src/utils/validate.ts:12–34  ↔  src/utils/check.ts:8–30  (88%)
  ---
  2 duplicate pairs  ~15 tokens

Output --fmt normal (default):
  ok: true
  pairs-found: 2  threshold: 85%
  ===
  pair 1  (91% similar — 34 lines)
    src/services/UserService.ts:45–78
    src/services/AdminService.ts:32–65
    difference: variable names only
    fix: Extract to shared BaseUserService or utility function

  pair 2  (88% similar — 23 lines)
    src/utils/validate.ts:12–34
    src/utils/check.ts:8–30
    fix: Consolidate into single validateInput() utility
```

---

## FLOW & CONTRACT GROUP

---

### `adt flow trace <symbol> [path]`

Tracks a symbol's static data flow: where it's assigned, where it's passed, where it's consumed.

```
Output --fmt slim:
  userId: req.body.userId → UserController:32
         → UserService.createOrder(:45) param
         → OrderRepository.create(:78) field
         → DB insert

Output --fmt normal (default):
  ok: true
  symbol: userId  trace-depth: 4
  ===
  SOURCE:  req.body.userId  (UserController.ts:32)
    ↓ passed as param
  PASS:    UserService.createOrder(userId, dto)  (:45)
    ↓ passed as param
  PASS:    OrderRepository.create({ userId, ...dto })  (:78)
    ↓ object field
  SINK:    db.query('INSERT INTO orders ...', [userId])  (:92)
           → DATABASE WRITE

  validation-points:
    UserController.ts:30  isUUID(req.body.userId)  ← validated here
```

---

### `adt flow db [path]`

```
Output --fmt slim:
  WRITE: OrderRepository.create :78  → orders table
  WRITE: UserRepository.save :45     → users table
  READ:  OrderRepository.findById :92 → orders table
  READ:  UserRepository.findAll :110  → users table
  ---
  2 writes  2 reads  ~22 tokens
```

---

### `adt contract check <class> [path]`

```
Output --fmt slim:
  ok true   PaymentService  implements IPaymentService  all 4 methods present

  ok false  OrderService  implements IOrderService
  MISSING: cancelOrder(id:string):Promise<void>  (:IOrderService.ts:28)
  MISSING: getTotal(id:string):Promise<number>   (:IOrderService.ts:34)

Output --fmt normal (default):
  ok: false
  class: OrderService  interface: IOrderService
  missing: 2 methods
  ===
  implemented (3/5):
    ✓ create(dto: CreateOrderDTO): Promise<Order>
    ✓ findById(id: string): Promise<Order>
    ✓ findAll(opts: PaginationOpts): Promise<Order[]>

  missing (2):
    ✗ cancelOrder(id: string): Promise<void>   IOrderService.ts:28
    ✗ getTotal(id: string): Promise<number>    IOrderService.ts:34
```

---

## ARCHITECTURE GROUP

---

### `adt arch`

Project architecture rule definition and violation detection. Rules stored in `.adt-arch.json`.

```
Sub-commands:
  adt arch rules               List defined rules
  adt arch check [path]        Scan for violations
  adt arch rule add "<rule>"   Add a rule
  adt arch rule remove <id>    Remove a rule

Rule syntax:
  "<source-glob> must not import <target-glob>"
  "<source-glob> can only import <target-glob>"
  "<glob> must have test file"

Examples:
  adt arch rule add "src/controllers/* must not import src/repositories/*"
  adt arch rule add "src/services/* can only import src/repositories/*,src/models/*,src/utils/*"
  adt arch rule add "src/services/* must have test file"

Output --fmt slim (check):
  ok false  2 violations
  src/controllers/UserController.ts:8  imports src/repositories/UserRepository.ts  [RULE-1]
  src/services/OrderService.ts:12  imports src/services/PaymentService.ts  [RULE-2]

Output --fmt normal (default, check):
  ok: false
  rules: 4  violations: 2
  ===
  VIOLATION [RULE-1]: controllers must not import repositories
    src/controllers/UserController.ts:8
    import { UserRepository } from '../repositories/UserRepository';
    fix: Route through UserService instead

  VIOLATION [RULE-2]: services should not cross-import (circular risk)
    src/services/OrderService.ts:12
    import { PaymentService } from './PaymentService';
    fix: Use IPaymentService interface or event-driven pattern
```

---

## WORKSPACE GROUP

---

### `adt workspace`

Monorepo support for npm workspaces, Turborepo, Nx, pnpm.

```
Sub-commands:
  adt workspace list               List all packages
  adt workspace graph              Inter-package dependency graph
  adt workspace affected <change>  Which packages are affected?
  adt workspace run <cmd> [--filter <pkg>]

Output --fmt slim (list):
  packages/api        @myapp/api         v1.2.0
  packages/shared     @myapp/shared      v1.0.4
  packages/ui         @myapp/ui          v2.1.0
  packages/workers    @myapp/workers     v1.1.0
  ---
  4 packages  ~15 tokens

Output --fmt normal (default, affected):
  ok: true
  changed: packages/shared/src/types/Order.ts
  affected-packages: 3
  ===
  direct:
    @myapp/api      (imports Order type)
    @myapp/workers  (imports Order type)
  indirect:
    @myapp/ui       (imports from @myapp/api)

  recommended: Run tests in affected packages:
    adt workspace run test --filter @myapp/api,@myapp/workers
```

---

## DOCUMENTATION GROUP

---

### `adt doc`

```
Sub-commands:
  adt doc coverage [path]    Documentation coverage rate
  adt doc missing [path]     Undocumented public symbols
  adt doc stale [path]       Code changed but comment not updated

Output --fmt slim (coverage):
  overall: 42%  public-fns: 18/43 documented
  classes: 4/6  interfaces: 6/6  functions: 8/31

Output --fmt slim (missing):
  src/services/OrderService.ts:44   createOrder()  [no JSDoc]
  src/services/OrderService.ts:120  findById()     [no JSDoc]
  src/utils/payment-calc.ts:18      calculateTax() [no JSDoc]
  ---
  25 undocumented public symbols  ~20 tokens

Output --fmt slim (stale):
  src/services/UserService.ts:32   createUser() code changed, JSDoc not updated
    last-code-change:    2025-03-14  (f9e8d7c)
    last-comment-change: 2024-11-20  (abc123)
  ---
  3 stale docs  ~18 tokens
```

---

## CONFIGURATION GROUP

---

### `adt config`

```
Sub-commands:
  adt config flags [path]           Feature flag list
  adt config read <key> [path]      Read a config value
  adt config diff <f1> <f2>         Diff two environments

Feature flag detection: searches for FF_*, FEATURE_*, isEnabled('...'), featureFlags.* patterns.

Output --fmt slim (flags):
  FF_NEW_CHECKOUT     src/config/flags.ts:8   default:false
  FF_BULK_ORDER       src/config/flags.ts:12  default:true
  FF_INVOICE_PDF      src/config/flags.ts:16  default:false
  ---
  3 feature flags  ~15 tokens

Output --fmt normal (default, diff):
  ok: true
  fileA: .env  fileB: .env.staging
  ===
  only in .env (local):
    DEBUG=true
    LOG_LEVEL=debug

  only in .env.staging:
    SENTRY_DSN=https://...
    LOG_LEVEL=warn

  different values (3):
    DATABASE_URL:  localhost/dev  ↔  staging-host/app
    REDIS_URL:     localhost:6379 ↔  staging-redis:6379
    PORT:          3000           ↔  8080

  same (8): JWT_ALGORITHM  APP_NAME  JWT_EXPIRES_IN  ...
```

---

## TAG GROUP

---

### `adt tag`

Adds semantic labels to files and functions. Stored in `.adt-tags.json`. Lets AI search by meaning: "all payment-related code".

```
Sub-commands:
  adt tag add <target> "<tags>"    Add tags
  adt tag search "<tag>"           Search by tag
  adt tag list                     All tags + distribution
  adt tag remove <target> "<tag>"

Examples:
  adt tag add src/services/PaymentService.ts "payment,critical,external-api,stripe"
  adt tag add src/services/OrderService.ts:44 "payment,order-lifecycle,db-write"
  adt tag search "payment" --fmt slim

Output --fmt slim (search payment):
  src/services/PaymentService.ts         [payment, critical, external-api, stripe]
  src/services/OrderService.ts:44        [payment, order-lifecycle, db-write]
  src/controllers/PaymentController.ts   [payment, api-endpoint]
  src/models/Payment.ts                  [payment, model]
  ---
  4 tagged items  ~20 tokens

Output --fmt normal (default, list):
  ok: true
  total-tags: 12  tagged-items: 28
  ===
  payment     (8 items)  PaymentService  OrderService:44  PaymentController  ...
  critical    (5 items)  PaymentService  AuthService  OrderService  ...
  external-api(3 items)  PaymentService  SMSService  EmailService
  auth        (6 items)  AuthService  UserService  JWTMiddleware  ...
  legacy      (4 items)  old-formatter.ts  legacy/export.ts  ...
```

---

## INTEGRATION GROUP

---

### `adt integration`

```
Sub-commands:
  adt integration list [path]    HTTP client calls + external APIs
  adt integration db [path]      Database connections and ORM models
  adt integration queue [path]   Message queue publishers/consumers

Output --fmt slim (list):
  HTTP  src/services/SMSService.ts:22      POST https://api.smsgateway.com/send
  HTTP  src/services/EmailService.ts:15    POST https://api.sendgrid.com/v3/mail
  HTTP  src/services/PaymentService.ts:45  POST https://api.stripe.com/v1/charges
  ---
  3 external HTTP integrations  ~18 tokens

Output --fmt normal (default, db):
  ok: true
  orm: TypeORM  database: PostgreSQL
  ===
  models (6):
    User        users       (src/models/User.ts:1)
    Order       orders      (src/models/Order.ts:1)
    Payment     payments    (src/models/Payment.ts:1)
    Product     products    (src/models/Product.ts:1)

  connections:
    default: process.env.DATABASE_URL  (src/config/db.ts:8)

Output --fmt normal (default, queue):
  ok: true
  broker: RabbitMQ  (detected from amqplib usage)
  ===
  publishers (3):
    order.created     OrderService.ts:89   (after order insert)
    payment.processed PaymentService.ts:67
    invoice.generated InvoiceService.ts:112

  consumers (2):
    order.created     → NotificationWorker (packages/workers/notification.ts:12)
    payment.processed → InvoiceWorker      (packages/workers/invoice.ts:8)
```

---

## MIGRATION GROUP

---

### `adt migrate`

```
Sub-commands:
  adt migrate plan <pkg> --from <v> --to <v>    Upgrade plan
  adt migrate scan <pkg> [path]                 Find deprecated API usage
  adt migrate apply <pkg> --codemod <name>      Apply automatic transform

Output --fmt slim (plan express 4→5):
  breaking: 4 changes affect this project
  app.del() → app.delete()  :3 usages
  res.send(status) → res.status(n).send()  :8 usages
  bodyParser removed → use express.json()  :1 usage
  express.Router strict mode default changed  :2 usages

Output --fmt normal (default, scan):
  ok: false
  package: express  deprecated-usages: 14
  ===
  app.del() [removed in v5]
    src/routes/user.routes.ts:22   app.del('/users/:id', ...)
    src/routes/order.routes.ts:18  app.del('/orders/:id', ...)
    fix: Replace with app.delete()
    adt migrate apply express --codemod app-del-to-delete

  res.send(404) [signature changed in v5]
    src/controllers/UserController.ts:45
    src/controllers/OrderController.ts:88  (+6 more)
    fix: res.status(404).send()
    adt migrate apply express --codemod res-send-status
```

---

## DEPENDENCY EXTENSIONS

---

### `adt deps outdated [path]`

```
Output --fmt slim:
  express   4.18.2  →  5.0.0   MAJOR  breaking-changes:4
  lodash    4.17.15 →  4.17.21 PATCH  security-fix
  typescript 5.0.0  →  5.4.0   MINOR  safe
  ---
  1 major  1 patch(security)  1 minor  ~18 tokens

Output --fmt normal (default):
  ok: true
  outdated: 8  (major:2  minor:4  patch:2)
  ===
  MAJOR (breaking changes — plan upgrade):
    express     4.18.2 → 5.0.0    4 breaking changes affect this project
                                   adt migrate plan express --from 4 --to 5
    typeorm     0.3.17 → 0.4.0    2 breaking changes

  PATCH (security — upgrade immediately):
    lodash      4.17.15 → 4.17.21  CVE-2021-23337 fix
    axios       0.21.1  → 0.21.4   CVE-2021-3749 fix

  MINOR (safe to upgrade):
    typescript  5.0.0 → 5.4.0
    jest        29.0.0 → 29.7.0
```

---

### `adt deps why <pkg> [path]`

```
Output --fmt slim:
  lodash  direct-dep  8 files use it  4 functions used

Output --fmt normal (default):
  ok: true
  package: lodash  type: direct dependency
  ===
  used-in: 8 files
  functions-used:
    _.groupBy    src/services/OrderService.ts:145
    _.orderBy    src/services/InvoiceService.ts:88
    _.pick       src/utils/dto-mapper.ts:12  (+3 more)
    _.debounce   src/utils/search.ts:8

  could-replace-with:
    _.groupBy  → Object.groupBy (Node 21+)
    _.pick     → destructuring or custom util
    _.debounce → use-debounce package (lighter)
```

---

## SESSION RESUMPTION

---

### `adt resume`

```
Sub-commands:
  adt resume             Last session summary + suggested next step
  adt resume plan        Incomplete tasks
  adt resume context     Last files read/modified

Output --fmt slim:
  last-session: 2025-03-15  00:47:33
  task T1: PaymentService refactor  [2/3 steps — NEXT: write tests]
  modified: PaymentService.ts  IPaymentService.ts
  unfinished: typecheck failed (2 errors)  tests not run

Output --fmt normal (default):
  ok: true
  last-session: 2025-03-15T09:12:00Z  duration: 00:47:33
  ===
  active-task: T1 — PaymentService refactor
    ✓ step 1: IPaymentService interface
    ✓ step 2: Stripe isolation
    ○ step 3: Write tests  ← NEXT ACTION

  recent-files:
    src/services/PaymentService.ts     modified ×2  (patch at :45, :88)
    src/interfaces/IPaymentService.ts  created

  pending-issues:
    typecheck: 2 errors  (run: adt typecheck src/ --fmt slim)
    tests: not run since last change

  suggested-next:
    1. adt typecheck src/ --fmt slim          ← fix 2 errors first
    2. adt generate test PaymentService       ← create test skeleton
    3. adt test src/services/PaymentService.ts ← run & verify
```

---

## ENHANCED TEST GROUP

---

### `adt test generate <symbol> [path]`

Generates a test skeleton by learning from existing test patterns.

```
Output --fmt slim:
  ok true  tests/services/PaymentService.test.ts  created  45 lines

Output --fmt normal (default):
  ok: true
  generated: tests/services/PaymentService.test.ts
  based-on-pattern: jest + describe/it style (from 12 existing test files)
  coverage-targets: 4 methods  ~8 test cases
  ---
  import { PaymentService } from '../../src/services/PaymentService';
  import { mockPaymentRepository } from '../mocks/PaymentRepository.mock';

  describe('PaymentService', () => {
    let service: PaymentService;

    beforeEach(() => {
      service = new PaymentService(mockPaymentRepository);
    });

    describe('create()', () => {
      it('should create a payment successfully', async () => {
        // TODO: implement
      });
      it('should throw if repository fails', async () => {
        // TODO: implement
      });
    });
  });
```

---

### `adt test gaps <file>`

```
Output --fmt slim:
  src/services/OrderService.ts
  untested-branches: 8
  :88 if (!order.items) → false branch never tested
  :102 catch block never triggered in tests
  :145 cancelOrder() zero tests

Output --fmt normal (default):
  ok: true
  file: src/services/OrderService.ts
  branch-coverage: 71.5%  missing: 8 branches
  ===
  untested-branches:
    :88   if (!order.items || order.items.length === 0)
          → FALSE branch (normal flow) not tested
    :102  catch(err) in create()
          → error path never triggered
    :145  cancelOrder() — entire function, 0 tests

  suggested-test-cases:
    it('should create order with valid items')    → covers :88 false branch
    it('should throw on repository error')        → covers :102
    it('should cancel a pending order')           → covers :145
```

---

### `adt test flaky [path]`

```
Output --fmt slim:
  tests/services/OrderService.test.ts:88  "should process payment"  fail-rate:23%
  tests/utils/date.test.ts:12             "should format date"       fail-rate:8%
  ---
  2 flaky tests  ~12 tokens

Output --fmt normal (default):
  ok: true
  flaky-tests: 2  (analyzed from: .adt/test-history.jsonl)
  ===
  tests/services/OrderService.test.ts:88
    test: "should process payment in under 200ms"
    fail-rate: 23%  (7/30 runs)
    pattern: timing-dependent  probable-cause: async race condition
    fix: Mock Date.now() or use fake timers

  tests/utils/date.test.ts:12
    test: "should format current date"
    fail-rate: 8%  (2/24 runs)
    pattern: date-dependent  probable-cause: runs at midnight
    fix: Mock new Date() with fixed date
```

---

## Error System

### Error Codes

| Code | Meaning | slim output | AI Action |
|------|---------|------------|-----------|
| `ENOENT` | File not found | `ok false ENOENT src/X.ts` | `adt find X` |
| `EACCES` | Permission denied | `ok false EACCES src/X.ts` | Report permission issue |
| `EBINARY` | Binary file | `ok false EBINARY assets/img.png` | Confirm with `adt info` |
| `ETOOBIG` | File >10MB | `ok false ETOOBIG dump.sql 45MB` | Read with `--start/--end` |
| `EENCODING` | Encoding undetectable | `ok false EENCODING legacy.php` | Force with `--encoding latin-1` |
| `ENOMATCH` | Symbol not found | `ok false ENOMATCH createOrder` | Try `refs` or `search` |
| `ECONFLICT` | Line mismatch in patch | `ok false ECONFLICT :45 mismatch` | Re-confirm with `verify` |
| `ENOBACKUP` | No backup exists | `ok false ENOBACKUP undo-impossible` | Manual restore required |
| `EGIT` | Git error | `ok false EGIT not a repository` | Init git or change directory |
| `EEXEC` | Command failed | `ok false EEXEC exit:1` | Read stderr field |
| `ETIMEOUT` | Command timed out | `ok false ETIMEOUT 30s exceeded` | Increase `--timeout` |
| `EMERGE_CONFLICT` | Git merge conflict | `ok false EMERGE_CONFLICT 2 files` | Resolve conflicts manually |

### slim Error Format

```
ok false
<CODE>  <path-or-context>
tip: <actionable suggestion>
```

Example:
```
ok false
ENOENT src/services/UserService.ts
tip: adt find UserService --fmt slim
```

---

## AI Workflow Protocols

---

### Protocol 1: New Project Orientation

```bash
adt platform --fmt slim          # OS, tools
adt map --fmt slim               # Structure + stack
adt stats src/ --fmt slim        # Code size
adt git status --fmt slim        # Git state
adt git log --limit 3 --fmt slim # Recent commits
adt env check DATABASE_URL REDIS_URL --fmt slim   # Env ready?
# Total: ~120 tokens
```

---

### Protocol 2: Session Start

```bash
# Load everything in ~160 tokens
adt resume --fmt slim            # Where did I leave off?
adt context get --fmt slim       # Project rules
adt task status --fmt slim       # Active task
adt git status --fmt slim        # Git state
```

---

### Protocol 3: "Where is X?"

```bash
# Fastest: single command
adt where UserService src/ --fmt slim
# → file src/services/UserService.ts  342 lines
# → sym  class UserService :18
# ~20 tokens

# All occurrences:
adt grep "UserService" src/ --fmt slim
# → every file:line
# ~45 tokens
```

---

### Protocol 4: File Reading (By Size)

```bash
adt info <file> --fmt slim        # how many lines? binary?

# <200 lines:
adt read <file> --fmt normal

# 200–500 lines:
adt peek <file> --fmt slim        # skeleton (~55 tokens)
adt read <file> --start 80 --end 140 --fmt normal

# >500 lines:
adt outline <file> --fmt slim     # TOC (~55 tokens)
# → find method create :44–118
adt read <file> --start 44 --end 118 --fmt normal
```

---

### Protocol 5: Safe Patch Loop

```bash
adt read <file> --around <line> --context 10 --fmt normal
adt verify <file> --lines <s>:<e> --contains "<text>" --fmt slim
# ok false → use outline to find line, re-verify
adt patch <file> --replace <s>:<e> --with "..." --dry-run --fmt normal
adt patch <file> --replace <s>:<e> --with "..." --fmt slim
adt read <file> --around <line> --context 5 --fmt normal  # confirm
```

---

### Protocol 6: Refactor Safety

```bash
adt impact src/services/UserService.ts --symbol createUser --fmt normal
adt refs createUser src/ --fmt slim
adt checkpoint "before-createUser-rename"
adt rename createUser createAccount src/ --dry-run --fmt slim
adt rename createUser createAccount src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
```

---

### Protocol 7: Bug Fix (Stack Trace → Fix → Test)

```bash
adt read <file> --around <error-line> --context 20 --fmt normal
adt outline <file> --fmt slim
adt callees <fn> src/ --fmt slim
adt typecheck <file> --fmt slim
adt verify <file> --line <n> --contains "<old>" --fmt slim
adt patch <file> --replace <n>:<n> --with "..." --fmt slim
adt test <file> --fmt slim
```

---

### Protocol 8: Git Feature Workflow

```bash
adt git status --fmt slim
adt git pull --fmt slim
adt git branch create feature/payment --fmt slim
# ... develop ...
adt lint src/ --fmt slim
adt test --fmt slim
adt typecheck src/ --fmt slim
adt git status --fmt slim
adt git diff --staged --fmt slim
adt git add src/ --fmt slim
adt git commit --message "feat: add payment" --fmt slim
adt git push --fmt slim
```

---

### Protocol 9: Which Commit Broke It?

```bash
adt git log --limit 10 --fmt slim
adt git log --file src/services/UserService.ts --fmt slim
adt git diff <hash> <hash>~1 --fmt normal
adt git blame <file> --lines 80:100 --fmt slim
```

---

### Protocol 10: Pre-Feature Security Check

```bash
adt security scan src/ --fmt slim        # any critical issues?
adt security secrets src/ --fmt slim     # hardcoded secrets?
adt deps vulnerable --fmt slim           # any CVEs?
adt arch check --fmt slim                # architecture violations?
```

---

### Protocol 11: Writing New Code (Convention-Aware)

```bash
# 1. Load context
adt context get --fmt slim
adt pattern find "service structure" src/ --fmt slim

# 2. Look at similar files
adt pattern similar src/services/UserService.ts --fmt slim

# 3. Generate from project convention
adt generate service PaymentService --fmt normal

# 4. Architecture check
adt arch check src/services/PaymentService.ts --fmt slim

# 5. Test skeleton
adt generate test PaymentService --fmt normal
```

---

### Protocol 12: Technical Debt Assessment

```bash
adt complexity hotspot src/ --fmt slim   # complex files
adt dead code src/ --fmt slim            # dead code
adt duplicate code src/ --fmt slim       # repeated code
adt coverage report --fmt slim           # test gaps
adt complexity debt src/ --fmt normal    # summary + recommendations
```

---

### Protocol 13: Dependency Upgrade Planning

```bash
adt deps outdated --fmt normal           # what needs upgrading?
adt deps vulnerable --fmt slim           # urgent security fixes
adt migrate scan express --fmt slim      # deprecated API usages
adt migrate plan express --from 4 --to 5 --fmt normal  # breaking changes
adt deps why lodash --fmt normal         # is lodash really needed?
```

---

## Token Optimization Guide

### Format Selection Summary

```
Asking a question       → slim   (location, existence, boolean)
Doing analysis          → normal (balanced, readable)
Processing output       → json   (nested, programmatic)
Many results            → slim   (grep, refs, log)
Single detailed result  → normal (def, peek, test failure)
Script integration      → json   (always)
```

### Command × Format Token Table

```
Command (10 results)      slim    normal   json    Recommended
──────────────────────────────────────────────────────────────
grep                        45      110       280    slim
where                       20       45       110    slim
git status                  22       38        85    slim
git log (5)                 55      120       310    slim
git diff (2 files)          80      160       380    normal
outline (10 fns)            55      120       240    normal
peek                        70      180       320    normal
symbols (8)                 35       80       180    normal
lint (5 issues)             40       90       200    slim
test (3 failures)           50      110       260    normal
env check (5)               20       55       120    slim
deps (10 imports)           45      100       220    normal
impact                      60      140       320    normal
session show                40       95       220    normal
info                        15       45        90    slim
resume                      22       65       140    slim
context get                 35       70       140    slim
task status                 20       55       110    slim
risk hotspot (top 5)        20       55       120    slim
security scan (3 issues)    25       70       160    slim
complexity hotspot          22       55       120    slim
coverage report             25       65       140    slim/normal
──────────────────────────────────────────────────────────────
slim vs json average:   5–7× more efficient
normal vs json average: 2–3× more efficient
```

---

## Session & Backup System

```
~/.adt/
├── session.json              # Active session
├── config.json               # User preferences
├── sessions/                 # Past sessions (30 days)
│   └── 2025-03-15-a3b2/
│       ├── session.json
│       └── events.jsonl      # All commands timestamped
├── backups/                  # Patch/delete backups (by hash)
│   └── a3f2b1c4/
│       └── UserService.ts
├── checkpoints/              # Manual snapshots
│   └── before-refactor/
│       ├── manifest.json
│       └── files/
├── context/                  # Project context memory
│   └── my-project/
│       └── context.json
├── tags/                     # Code tags
│   └── my-project/
│       └── .adt-tags.json
└── git-ops/                  # Git operation logs
    └── 2025-03-15.jsonl
```

### config.json

```json
{
  "defaultFmt": "normal",
  "defaultLines": 100,
  "maxCatLines": 500,
  "maxGrepResults": 100,
  "backupRetentionDays": 30,
  "excludeByDefault": ["node_modules", "dist", ".git", "build", "coverage", ".next"],
  "tokenWarningThreshold": 1000,
  "autoBackup": true,
  "defaultShell": "auto",
  "gitSafetyChecks": true,
  "patchVerifyBeforeApply": true
}
```

---

## Encoding & Format Issues

| Issue | Detection | slim Output |
|-------|-----------|------------|
| BOM UTF-8 | EF BB BF | `BOM:true utf-8` |
| BOM UTF-16 LE | FF FE | `BOM:true utf-16le` |
| Mixed CRLF | Line counter | `lineEnding:MIXED` |
| Latin-1 | Byte analysis | `encoding:latin-1 conf:87%` |
| Binary | Non-printable ratio | `binary:true EBINARY` |
| Null byte | \x00 | `binary:true nullbyte:true` |

---

## Supported Languages

| Language | Extension | Symbols | Deps | Method |
|----------|-----------|---------|------|--------|
| TypeScript | .ts .tsx | ✅ Full | ✅ | AST (Babel) |
| JavaScript | .js .mjs .cjs | ✅ Full | ✅ | AST (Babel) |
| JSX | .jsx | ✅ Full | ✅ | AST (Babel) |
| Python | .py | ✅ Good | ✅ | Regex+Indent |
| C# | .cs | ✅ Good | ✅ | Regex |
| Java | .java | ✅ Good | ✅ | Regex |
| Go | .go | ✅ Good | ✅ | Regex |
| PHP | .php | ✅ Basic | ⚡ | Regex |
| Ruby | .rb | ✅ Basic | ⚡ | Regex |
| CSS/SCSS | .css .scss | 📋 Selector | — | Regex |
| SQL | .sql | 📋 Table/Proc | — | Regex |
| Markdown | .md | 📋 Heading | — | Regex |
| JSON | .json | 📋 Key | — | JSON.parse |
| YAML | .yaml .yml | 📋 Key | — | Regex |

---

## Installation

```bash
npm install -g ai-dev-tools
adt --version

# In-project
npx adt map --fmt slim

# Set format default
adt config set defaultFmt normal
adt config set defaultFmt slim    # for token-critical environments
```

---

## Quick Reference — AI Cheat Sheet

```bash
# ─── SESSION START ──────────────────────────────────
adt resume --fmt slim                    # where did I leave off?
adt context get --fmt slim               # project rules
adt task status --fmt slim               # active task

# ─── PROJECT ORIENTATION ────────────────────────────
adt platform --fmt slim
adt map --fmt slim
adt stats src/ --fmt slim
adt git status --fmt slim
adt git log --limit 5 --fmt slim
adt env check DATABASE_URL JWT_SECRET --fmt slim

# ─── WHERE IS X? ────────────────────────────────────
adt where UserService src/ --fmt slim
adt grep "createOrder" src/ --fmt slim
adt grep "TODO|FIXME" . --regex --fmt slim
adt grep "password" src/ --no-tests --fmt slim
adt find . --name "*.service.ts" --fmt slim

# ─── FILE READING ───────────────────────────────────
adt info <file> --fmt slim
adt peek <file> --fmt slim
adt outline <file> --fmt slim
adt read <file> --start 1 --lines 100 --fmt normal
adt read <file> --around 87 --context 15 --fmt normal
adt read <file> --fn createOrder --fmt normal

# ─── SYMBOL UNDERSTANDING ───────────────────────────
adt sig createOrder src/ --fmt slim
adt def createOrder src/ --fmt normal
adt body createOrder src/ --fmt normal
adt symbols <file> --fmt normal
adt refs UserService src/ --fmt slim
adt callers createOrder src/ --fmt slim
adt callees createOrder src/ --fmt slim

# ─── DEPENDENCIES & IMPACT ──────────────────────────
adt deps <file> --file --fmt normal
adt deps <file> --who-imports --fmt slim
adt impact <file> --symbol createUser --fmt normal
adt deps src/ --circular --fmt slim

# ─── SAFE EDITING ───────────────────────────────────
adt verify <file> --lines 45:52 --contains "createOrder" --fmt slim
adt patch <file> --replace 45:52 --with "..." --dry-run --fmt normal
adt patch <file> --replace 45:52 --with "..." --fmt slim
adt diff <file> --fmt normal
adt undo <file> --fmt slim

# ─── FILE OPERATIONS ────────────────────────────────
adt create src/services/PaymentService.ts --template class --fmt slim
adt move src/utils/User.ts src/models/User.ts --fmt slim
adt rename UserService AccountService src/ --dry-run --fmt slim
adt delete src/deprecated/OldService.ts --fmt slim

# ─── GIT ────────────────────────────────────────────
adt git status --fmt slim
adt git log --limit 10 --fmt slim
adt git log --file <path> --fmt slim
adt git diff --staged --fmt normal
adt git diff HEAD~1 --fmt normal
adt git blame <file> --lines 80:100 --fmt slim
adt git branch list --fmt slim
adt git branch create feature/x --fmt slim
adt git branch switch main --fmt slim
adt git add src/ --fmt slim
adt git commit --message "feat: ..." --fmt slim
adt git push --fmt slim
adt git pull --fmt slim
adt git stash save "wip" --fmt slim
adt git stash pop --fmt slim
adt git reset --soft HEAD~1 --fmt slim
adt git merge feature/x --dry-run --fmt normal
adt git tag create v1.0.0 --message "Release" --fmt slim
adt git cherry-pick a1b2c3d --fmt slim

# ─── SHELL / EXEC ───────────────────────────────────
adt platform --fmt slim
adt which node npm tsc --fmt slim
adt exec "npm install" --fmt normal
adt exec "Get-Process" --shell powershell --fmt slim
adt run npm:build --fmt slim
adt env list --mask --fmt slim
adt env check DATABASE_URL REDIS_URL --fmt slim
adt env diff .env .env.production --fmt normal

# ─── QUALITY ────────────────────────────────────────
adt lint src/ --fmt slim
adt lint src/ --fix --fmt slim
adt test --fmt slim
adt test <file> --fmt normal
adt typecheck src/ --fmt slim
adt format src/ --check --fmt slim

# ─── CONTEXT & TASKS ────────────────────────────────
adt context get --fmt slim
adt context set "arch" "Use Repository pattern"
adt context decisions add "2025-03-15: Redis cache added"
adt task create "PaymentService refactor"
adt task step add T1 "1. Define interface"
adt task step done T1 1
adt task status --fmt slim

# ─── PATTERNS & GENERATION ──────────────────────────
adt pattern find "error handling" src/ --fmt slim
adt pattern similar src/services/UserService.ts --fmt slim
adt generate service PaymentService --fmt normal
adt generate model Payment --fields "amount:number,currency:string"
adt generate test PaymentService --fmt normal
adt api list --fmt slim
adt api find "payment" --fmt slim
adt package usage bcrypt --fmt slim

# ─── RISK & SECURITY ────────────────────────────────
adt risk hotspot src/ --fmt slim
adt risk file src/services/OrderService.ts --fmt normal
adt coverage report --fmt slim
adt coverage file src/services/OrderService.ts --fmt normal
adt coverage untested --fmt slim
adt security scan src/ --fmt slim
adt security secrets src/ --fmt slim
adt security cve --fmt slim

# ─── HISTORY & COMPLEXITY ───────────────────────────
adt history file src/services/OrderService.ts --fmt normal
adt history fn createOrder src/ --fmt normal
adt history why src/services/OrderService.ts:88 --fmt slim
adt history churn src/ --fmt slim
adt complexity file <file> --fmt normal
adt complexity hotspot src/ --fmt slim
adt complexity debt src/ --fmt normal
adt dead code src/ --fmt slim
adt dead files src/ --fmt slim
adt duplicate code src/ --fmt normal

# ─── FLOW & ARCHITECTURE ────────────────────────────
adt flow trace userId src/ --fmt normal
adt flow db src/ --fmt normal
adt contract check OrderService src/ --fmt slim
adt arch check --fmt slim
adt arch rules --fmt slim
adt arch rule add "controllers/* must not import repositories/*"

# ─── WORKSPACE & INTEGRATION ────────────────────────
adt workspace list --fmt slim
adt workspace affected src/shared/types/Order.ts --fmt normal
adt integration list src/ --fmt slim
adt integration db src/ --fmt normal
adt integration queue src/ --fmt normal

# ─── DOCUMENTATION & TAGS ───────────────────────────
adt doc coverage src/ --fmt slim
adt doc missing src/ --fmt slim
adt doc stale src/ --fmt slim
adt tag add src/services/PaymentService.ts "payment,critical,stripe"
adt tag search "payment" --fmt slim
adt tag list --fmt normal

# ─── DEPENDENCY HEALTH ──────────────────────────────
adt deps outdated --fmt normal
adt deps vulnerable --fmt slim
adt deps why lodash --fmt normal
adt migrate scan express --fmt slim
adt migrate plan express --from 4 --to 5 --fmt normal

# ─── TEST QUALITY ───────────────────────────────────
adt test generate PaymentService --fmt normal
adt test gaps src/services/OrderService.ts --fmt normal
adt test flaky --fmt normal
adt coverage untested --fmt slim

# ─── CONFIGURATION ──────────────────────────────────
adt config flags --fmt slim
adt config read DATABASE_URL --fmt slim
adt config diff .env .env.production --fmt normal

# ─── SESSION & SNAPSHOTS ────────────────────────────
adt resume --fmt normal
adt resume plan --fmt slim
adt checkpoint "before-refactor"
adt checkpoint restore "before-refactor"
adt session show --fmt normal
adt hash src/services/UserService.ts --fmt slim
```
