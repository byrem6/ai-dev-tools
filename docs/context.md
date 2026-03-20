# AI Dev Tools (adt) - Context Document

## Project Overview

**Name:** AI Dev Tools (adt)
**Type:** Node.js CLI Application
**Target Audience:** AI agents (LLMs) and human developers
**Core Philosophy:** Token-efficient output for AI agent operations

## Technical Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **CLI Framework:** Custom-built (for maximum control)
- **Output Formats:** slim, normal, json
- **Cross-platform:** Windows PowerShell + Linux/macOS Bash

## Core Principles

1. **Format-aware output:** Every command works in three modes (slim, normal, json)
2. **`ok` guarantee:** All outputs begin with an `ok` line for quick parsing
3. **Actionable errors:** Errors include actionable suggestions
4. **Token-aware:** Commands report estimated token counts
5. **Safe defaults:** Destructive operations take backups
6. **Stateless + traceable:** Each run independent, session logged
7. **Language-agnostic:** AST for JS/TS, regex for others
8. **Cross-platform:** Transparent platform support

## Architecture

### Directory Structure

```
adt/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── core/
│   │   ├── cli.ts              # CLI framework
│   │   ├── command.ts           # Base command class
│   │   ├── format.ts            # Output formatting system
│   │   ├── session.ts           # Session management
│   │   ├── config.ts            # Configuration management
│   │   └── error.ts             # Error system
│   ├── commands/
│   │   ├── read/                # READ group
│   │   ├── search/              # SEARCH group
│   │   ├── symbol/              # SYMBOL group
│   │   ├── edit/                # EDIT group
│   │   ├── map/                 # MAP group
│   │   ├── git/                 # GIT group
│   │   ├── shell/               # SHELL group
│   │   ├── quality/             # QUALITY group
│   │   ├── session/             # SESSION group
│   │   ├── utility/             # UTILITY group
│   │   ├── context/             # CONTEXT group
│   │   ├── pattern/             # PATTERN group
│   │   ├── task/                # TASK group
│   │   ├── generate/            # GENERATE group
│   │   ├── api/                 # API group
│   │   ├── risk/                # RISK & COVERAGE group
│   │   ├── security/            # SECURITY group
│   │   ├── history/             # HISTORY group
│   │   ├── complexity/          # COMPLEXITY & DEAD CODE group
│   │   ├── flow/                # FLOW & CONTRACT group
│   │   ├── arch/                # ARCHITECTURE group
│   │   ├── workspace/           # WORKSPACE group
│   │   ├── doc/                 # DOCUMENTATION group
│   │   ├── config/              # CONFIGURATION group
│   │   ├── tag/                 # TAG group
│   │   ├── integration/         # INTEGRATION group
│   │   ├── migrate/             # MIGRATION group
│   │   └── deps/                # DEPENDENCY extensions
│   ├── parsers/
│   │   ├── typescript.ts        # TypeScript/JavaScript AST parser
│   │   ├── python.ts            # Python parser
│   │   ├── generic.ts           # Generic regex parser
│   │   └── index.ts             # Parser registry
│   ├── utils/
│   │   ├── file.ts              # File utilities
│   │   ├── hash.ts              # Hash utilities
│   │   ├── git.ts               # Git utilities
│   │   ├── ast.ts               # AST utilities
│   │   ├── token.ts             # Token estimation
│   │   └── platform.ts          # Platform detection
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── test/
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

### Output Format System

#### slim Format
- Maximum token savings
- Location, status, simple lists
- Traditional grep format: `file:line:col:text`

#### normal Format
- Balanced, human-friendly
- Machine-readable but not nested
- Key-value structure with sections

#### json Format
- Full structured data
- Nested analysis
- Programmatic processing

### Command Groups (21 total)

1. **READ**: read, cat, head, tail, peek, outline
2. **SEARCH**: grep, search, find, refs, where
3. **SYMBOL**: symbols, def, sig, body, callers, callees
4. **EDIT**: patch, replace, verify, create, delete, move, copy, rename
5. **MAP**: map, tree, deps, impact, stats
6. **GIT**: status, log, diff, blame, branch, commit, stash, reset, merge, tag, cherry-pick
7. **SHELL**: exec, run, env, which, platform
8. **QUALITY**: lint, test, format, typecheck
9. **SESSION**: session, diff, undo, checkpoint, resume
10. **UTILITY**: info, safe, hash, watch
11. **CONTEXT**: context set/get/decisions/conventions
12. **PATTERN**: pattern find/similar/list
13. **TASK**: task create/step/status/list
14. **GENERATE**: generate service/model/test/controller
15. **API**: api list/find/routes, package usage
16. **RISK**: risk file/hotspot, coverage report/file/untested
17. **SECURITY**: security scan/secrets/cve
18. **HISTORY**: history file/fn/why/churn/authors
19. **COMPLEXITY**: complexity file/hotspot/debt, dead code, duplicate code
20. **FLOW**: flow trace/db, contract check/missing
21. **ARCHITECTURE**: arch rules/check/rule add
22. **WORKSPACE**: workspace list/graph/affected/run
23. **DOCUMENTATION**: doc coverage/missing/stale
24. **CONFIGURATION**: config flags/read/diff
25. **TAG**: tag add/search/list
26. **INTEGRATION**: integration list/db/queue
27. **MIGRATION**: migrate plan/scan/apply
28. **DEPS**: deps outdated/why (extended)

### Error Codes

- ENOENT: File not found
- EACCES: Permission denied
- EBINARY: Binary file
- ETOOBIG: File too large
- EENCODING: Encoding undetectable
- ENOMATCH: Symbol not found
- ECONFLICT: Line mismatch in patch
- ENOBACKUP: No backup exists
- EGIT: Git error
- EEXEC: Command failed
- ETIMEOUT: Command timed out
- EMERGE_CONFLICT: Git merge conflict

### Session System

- Located at: `~/.adt/`
- Contains: session.json, events.jsonl, backups/, checkpoints/, context/, tags/
- Tracks: All commands, file operations, token usage
- Retention: 30 days default

### Supported Languages

Full AST support: TypeScript, JavaScript, JSX
Good regex support: Python, C#, Java, Go
Basic support: PHP, Ruby
Special handling: CSS/SCSS, SQL, Markdown, JSON, YAML

## Implementation Priority

### Phase 1: Core Infrastructure
1. Project setup (package.json, tsconfig.json)
2. CLI framework (argument parsing, command routing)
3. Format system (slim/normal/json output)
4. Error system (error codes, actionable tips)
5. Configuration management
6. Session management
7. Platform detection
8. File utilities

### Phase 2: READ Group (Most Critical)
1. read command (with all options)
2. peek command
3. outline command
4. cat/head/tail commands

### Phase 3: SEARCH Group
1. grep command (core feature)
2. where command
3. find command
4. search command
5. refs command

### Phase 4: SYMBOL Group
1. symbols command
2. def command
3. sig command
4. callers/callees commands

### Phase 5: EDIT Group
1. verify command (safety critical)
2. patch command
3. replace command
4. create/delete/move commands
5. rename command

### Phase 6: Remaining Groups
6. MAP group
7. GIT group
8. SHELL group
9. QUALITY group
10. SESSION group
11. UTILITY group
12-28. New command groups

## Key Design Decisions

### Why Custom CLI Framework?
- Maximum control over output format
- Consistent error handling
- Token-efficient parsing
- AI-friendly structure

### Why Three Output Formats?
- Different AI models have different context window sizes
- Different use cases need different verbosity
- Token optimization is critical for AI operations

### Why TypeScript?
- Type safety for complex command structure
- Better tooling for large codebase
- AST parsing for JS/TS files
- Modern Node.js ecosystem

### Why Session Tracking?
- AI agents need state awareness
- Rollback capability for safety
- Token budget management
- Debugging and audit trail

## Testing Strategy

1. Unit tests for each command
2. Integration tests for command groups
3. Format validation tests (slim/normal/json)
4. Cross-platform tests (Windows/Linux)
5. Token estimation accuracy tests
6. Error handling tests

## Deployment

- npm global package: `npm install -g ai-dev-tools`
- npx support: `npx adt <command>`
- Binary distribution (optional for performance)

## Next Steps

1. Initialize Node.js project
2. Set up TypeScript configuration
3. Implement core infrastructure
4. Implement READ group commands
5. Implement SEARCH group commands
6. Continue with remaining groups
