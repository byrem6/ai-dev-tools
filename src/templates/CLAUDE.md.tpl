# {{PROJECT_NAME}} — AI Dev Tools Setup

`adt` v{{ADT_VERSION}} is installed globally. Use it for ALL file, search, and git operations.

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

## Command Reference

### 🧠 AI-Powered Features (v2.0)

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
```

### Search & Navigation

```bash
adt where <symbol> --fmt slim                    # fastest: where is X?
adt grep "<pattern>" [path] --fmt slim           # search all files → file:line:col
adt grep "<pattern>" . --regex --fmt slim        # regex search
adt find . --name "*.service.ts" --fmt slim      # find files by name
adt refs <symbol> src/ --fmt slim                # all usages of a symbol
adt search "<pattern>" [path] --fmt normal       # deep search with context
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

### ⚡ Batch Operations & Automation (v2.0)

```bash
# Execute multiple commands in parallel (token-efficient!)
adt batch --file <commands.txt> --parallel

# Inline command execution
adt batch --commands "grep 'export' src/ | symbols src/index.ts"

# Command chaining with pipe operator
echo "grep 'UserService' src/ | complexity src/ | health" > analysis.txt
adt batch --file analysis.txt --parallel

# Example batch file:
# grep "TODO" src/
# grep "FIXME" src/
# complexity src/
# health
```

### 📊 Analysis & Quality (v2.0)

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

### 📝 Documentation (v2.0)

```bash
# Generate changelog from git history
adt changelog --version 2.0.0

# Documentation helpers
adt toc <file>                          # Generate table of contents
adt split <file> --lines 400            # Split large files
adt doc coverage <file>                 # Check documentation coverage
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
adt git diff --staged

# 10. Commit
adt git commit --message "refactor: optimize UserService performance"
```

## Reading Strategy by File Size

```
File size        Strategy
────────────────────────────────────────────────────
< 200 lines      adt read <file> --fmt normal
200–500 lines    adt peek --fmt slim  →  adt read --start N
> 500 lines      adt outline --fmt slim  →  adt read --start N --end M
```

## Token Optimization Tips

1. **Always use `--fmt slim` for:**
   - Location queries (`where`, `find`)
   - Symbol searches (`grep`, `refs`)
   - Boolean checks (`verify`)
   - Status commands (`git status`, `health`)

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
#   EGIT → check adt git status --fmt slim first
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

## Quick Reference

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
