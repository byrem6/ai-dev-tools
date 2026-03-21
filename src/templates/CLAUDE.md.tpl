# {{PROJECT_NAME}} — AI Dev Tools Setup

`adt` v{{ADT_VERSION}} is installed globally with **94 commands across 27 categories**. Use it for ALL file, search, and git operations.

## Session Start

Run these commands at the beginning of every session:

```bash
# Session initialization
adt resume --fmt slim

# Get project context and recent decisions
adt context get --fmt slim
adt context history --fmt slim

# Get AI-powered suggestions for current state
adt smart suggest
```

## Core Rules

- **NEVER** use `cat`, `grep`, `find`, `sed`, or `git` directly
- **ALWAYS** use `adt` equivalents
- **Format rule:** `--fmt slim` for location/boolean (5-7× token savings), `--fmt normal` for reading/analysis
- **Use AI features** - `smart` for suggestions, `context` for tracking decisions
- **Batch operations** - Use `batch` for multiple commands

## 🧠 AI-Powered Features (v2.0)

```bash
# Smart suggestions based on codebase state
adt smart suggest                    # Get AI recommendations
adt smart analyze                    # Deep codebase analysis
adt smart plan "<goal>"              # Create implementation plan
adt smart review                     # Review changes before commit

# Context tracking - ALWAYS track important decisions
adt context track "<decision>" --reason "<why>"  # Track decisions
adt context history                  # View all past decisions
adt context suggest                  # AI suggestions based on context
adt context search --query "<term>"  # Search decisions
adt context get                      # Get all context

# Quick operations
adt quick analyze                     # Quick codebase analysis
adt quick search "<query>"            # Quick search

# Batch operations
adt batch --file <commands.txt> --parallel
adt batch --commands "grep 'export' src/ | symbols src/index.ts"
```

## 🔍 Search & Navigation

```bash
adt where <symbol> --fmt slim                    # fastest: where is X?
adt grep "<pattern>" [path] --fmt slim           # search all files → file:line:col
adt grep "<pattern>" . --regex --fmt slim        # regex search
adt find . --name "*.service.ts" --fmt slim      # find files by name
adt refs <symbol> src/ --fmt slim                # all usages of a symbol
adt search "<pattern>" [path] --fmt normal       # deep search with context
```

## 📖 Reading Files

```bash
adt info <file> --fmt slim                       # check size, encoding, binary?
adt peek <file> --fmt slim                       # quick skeleton (imports + symbols)
adt outline <file> --fmt slim                    # TOC for files >500 lines
adt read <file> --start N --lines 100 --fmt normal  # read a chunk
adt read <file> --around N --context 15 --fmt normal # context around a line
adt read <file> --fn <functionName> --fmt normal # read a function by name
```

## 🎯 Understanding Code

```bash
adt sig <symbol> src/ --fmt slim                 # signature only (~12 tokens)
adt def <symbol> src/ --fmt normal               # definition + location
adt body <symbol> src/ --fmt normal              # full function body
adt callers <symbol> src/ --fmt slim             # who calls this?
adt callees <symbol> src/ --fmt slim             # what does this call?
adt deps <file> --file --fmt normal              # what does this file import?
adt impact <file> --symbol <name> --fmt normal   # what breaks if I change this?
```

## ✏️ Editing Files — ALWAYS Follow This Order

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

## 📊 Analysis & Quality (v2.0)

```bash
# Project health check
adt health --verbose                    # Complete health report with score

# Code complexity analysis
adt complexity src/ --top 10            # Find complex code
adt complexity <file> --action file     # Analyze single file
adt complexity src/ --action debt       # Calculate technical debt

# Find code issues
adt duplicate src/ --lines 5 --no-whitespace    # Find duplicate code
adt unused src/ --check both            # Find unused imports/exports
adt files src/ --sort size --limit 10   # List largest files
adt recent . --hours 24 --ext ts        # Recently modified files

# Quality checks
adt lint src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
adt test <file> --coverage
adt format src/ --check
```

## 🐙 Git Operations

```bash
adt git-status --fmt slim
adt git-log --limit 10 --fmt slim
adt git-diff --staged --fmt normal
adt git-commit --message "<msg>" --fmt slim
adt git-push --fmt slim
adt git-pull --fmt slim
adt git-branch list --fmt slim
adt git-branch create <name> --fmt slim

# Advanced Git
adt git-blame <file>                    # Who changed what
adt git-stash save "<msg>"             # Stash changes
adt git-reset soft HEAD~1              # Reset softly
adt git-merge feature/branch           # Merge branches
adt git-tag create v2.0.0              # Create tag
adt git-cherry-pick abc123             # Cherry-pick commit
```

## 🌐 API Endpoints (v2.0)

```bash
adt api-list [path]                    # List all API endpoints
adt api-find "<pattern>" [path]        # Find endpoints by pattern
adt api-routes [path]                  # Show routing details
```

## 🏗️ Architecture Rules (v2.0)

```bash
adt arch-rules list                    # List architecture rules
adt arch-check [path]                  # Check rule compliance
adt arch-rule-add <spec>               # Add new rule
```

## 🔒 Security & Risk (v2.0)

```bash
adt security [path] --severity high    # Security vulnerability scan
adt risk [path] --threshold high       # Risk analysis
adt contract-check <class> [path]      # Interface contract check
```

## 🧪 Testing & Generation (v2.0)

```bash
# Testing
adt coverage-report [path]             # Test coverage report

# Code generation
adt generate-service <name>            # Generate service class
adt generate-model <name>              # Generate model/interface
adt generate-test <name>               # Generate test file
```

## 🔄 Integration & Migration (v2.0)

```bash
adt integration-list [path]            # List external APIs
adt migrate-scan <package> [path]      # Scan deprecated APIs
adt flow-trace <symbol> [path]         # Trace data flow
```

## 📝 Documentation (v2.0)

```bash
# Generate changelog from git history
adt changelog --version 2.0.0

# Documentation helpers
adt toc <file>                          # Generate table of contents
adt split <file> --lines 400            # Split large files
adt doc coverage <file>                 # Check documentation coverage
```

## 🗂️ Workspace & Configuration (v2.0)

```bash
adt workspace-list [path]              # List monorepo packages
adt config-flags [path]                # List feature flags
adt history-file <file>                # File git history
```

## 📋 Task & Session Management (v2.0)

```bash
# Task management
adt task create "<title>"              # Create task
adt task list --status open            # List tasks
adt task step add <id> "<step>"        # Add step to task

# Session management
adt session show                       # Show session state
adt session diff                       # Show session diff
adt session undo                       # Undo last action
adt session checkpoint save "<msg>"    # Save checkpoint
adt session restore <id>               # Restore checkpoint
```

## 🎨 Patterns & Tags (v2.0)

```bash
adt pattern match "<regex>" [path]     # Match code patterns
adt pattern save "<name>" --template <file>
adt tag add "<note>" <file> --line N   # Tag code location
adt tag list --sort recent             # List tags
```

## 🛡️ Safety & Diagnostics (v2.0)

```bash
adt safe check [path]                  # Safety checks
adt doctor                              # System diagnostics
adt doctor --verbose                    # Detailed diagnostics
adt init                                # Initialize AI tool configs
```

## Typical AI Agent Workflow

```bash
# 1. Session Start
adt resume --fmt slim
adt context get --fmt slim
adt smart suggest

# 2. Explore Codebase
adt map . --fmt slim
adt health --fmt slim

# 3. Quick Location Query
adt where "UserService" src/ --fmt slim

# 4. Read Content
adt read src/UserService.ts --fn login --fmt normal

# 5. Understand Impact
adt impact UserService --symbol --scope src/

# 6. Track Decision
adt context track "Refactoring UserService for performance" --reason "User feedback"

# 7. Create Plan
adt smart plan "refactor UserService"

# 8. Execute Changes (batch for efficiency)
adt batch --file refactor-plan.txt --parallel

# 9. Review Before Commit
adt smart review
adt git-diff --staged

# 10. Commit
adt git-commit --message "refactor: optimize UserService performance"
```

## Reading Strategy by File Size

```
File size        Strategy
───────────────────────────────────────────────────
< 200 lines      adt read <file> --fmt normal
200–500 lines    adt peek --fmt slim  →  adt read --start N
> 500 lines      adt outline --fmt slim  →  adt read --start N --end M
```

## Token Optimization Tips

1. **Always use `--fmt slim` for:**
   - Location queries (`where`, `find`)
   - Symbol searches (`grep`, `refs`)
   - Boolean checks (`verify`)
   - Status commands (`git-status`, `health`)

2. **Use `--fmt normal` for:**
   - Reading file content
   - Analysis output
   - Context display
   - Git diffs

3. **Use batch operations for multiple commands:**
   - Saves 2-3× tokens vs individual commands
   - Parallel execution saves time

4. **Leverage AI features:**
   - `smart suggest` provides contextual recommendations
   - `context track` avoids re-explaining decisions
   - `smart plan` creates efficient workflows

## Error Handling

Every `adt` command outputs `ok true` or `ok false` as the first line. Always check this before proceeding.

```bash
# If ok false:
# - Read the `tip:` line for the suggested fix
# - Common fixes:
#   ENOENT → adt find <name> --fmt slim
#   ECONFLICT → re-run adt outline to get correct line numbers
#   EGIT → check adt git-status --fmt slim first
```

## Advanced Features

### Symbol Navigation
```bash
adt symbols <file> --type class --exported    # List exported classes
adt callers <symbol> src/ --fmt slim          # Find all callers
adt callees <function> src/ --fmt slim       # Find what function calls
```

### Project Analysis
```bash
adt map src/ --depth 2                       # Project structure
adt tree src/ --files-only                   # Directory tree
adt stats src/ --by-extension                # File statistics
adt deps src/ --tree                         # Dependency tree
```

### Safety Operations
```bash
adt delete <file> --backup                   # Safe delete with backup
adt move <file> <path> --update-imports      # Move and update imports
adt rename <old> <new> --scope project       # Project-wide rename
```

## Best Practices

1. **Start every session with `smart suggest`** - Get contextual recommendations
2. **Track important decisions** - Use `context track` for major decisions
3. **Use batch operations** - More efficient than individual commands
4. **Always verify before editing** - Use `verify` + `--dry-run`
5. **Review before committing** - Use `smart review`
6. **Check health regularly** - Run `adt health` periodically
7. **Leverage AI planning** - Use `smart plan` for complex tasks
8. **Use new v2.0 features** - API, architecture, security, generation commands

## Quick Reference (94 Commands)

| Category | Commands |
|----------|----------|
| **READ** | read, peek, outline |
| **SEARCH** | grep, find, where, search, refs |
| **SYMBOL** | symbols, sig, def, body, callers, callees |
| **EDIT** | verify, patch, replace, create, delete, move, copy, rename |
| **MAP** | map, tree, stats, deps, impact |
| **GIT** | git-status, git-log, git-diff, git-blame, git-branch, git-commit, git-stash, git-reset, git-merge, git-tag, git-cherry-pick |
| **SHELL** | exec, platform, run, env, which |
| **QUALITY** | lint, test, typecheck, format |
| **AI** | ai, smart, quick, batch |
| **CONTEXT** | context |
| **UTILITY** | info, files, recent, duplicate, unused, health, changelog, safe |
| **DOCUMENTATION** | doc, split, toc |
| **ARCHITECTURE** | arch-rules, arch-check, arch-rule-add |
| **PATTERN** | pattern, tag |
| **SECURITY** | security, risk |
| **TESTING** | coverage-report |
| **GENERATION** | generate-service, generate-model, generate-test |
| **API** | api-list, api-find, api-routes |
| **INTEGRATION** | integration-list |
| **MIGRATION** | migrate-scan |
| **FLOW** | flow-trace |
| **CONTRACT** | contract-check |
| **CONFIGURATION** | config-flags |
| **WORKSPACE** | workspace-list |
| **HISTORY** | history-file |
| **SESSION** | session, resume |
| **TASK** | task |
| **SYSTEM** | init, doctor |

## Common Tasks

| Task | Command |
|------|---------|
| Find symbol | `adt where <symbol> src/ --fmt slim` |
| Read function | `adt read <file> --fn <name> --fmt normal` |
| Search pattern | `adt grep "<pattern>" src/ --fmt slim` |
| Safe edit | `adt verify ... && adt patch ...` |
| Get suggestions | `adt smart suggest` |
| Track decision | `adt context track "decision" --reason "why"` |
| Batch operations | `adt batch --file commands.txt --parallel` |
| Health check | `adt health` |
| Complexity | `adt complexity src/ --top 10` |
| List API endpoints | `adt api-list src/` |
| Check architecture | `adt arch-check src/` |
| Security scan | `adt security src/` |
| Generate service | `adt generate-service PaymentService` |
| List integrations | `adt integration-list src/` |
| Task management | `adt task create "Refactor X"` |
| Session state | `adt session show` |
