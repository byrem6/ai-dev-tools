# {{PROJECT_NAME}} — AI Dev Tools Rules

`adt` v{{ADT_VERSION}} is installed globally. Use adt for ALL file, search, and git operations.

## CORE RULES

1. **NEVER** use cat, grep, find, sed, or git directly. Always use adt equivalents.

2. **Format selection:**
   - `--fmt slim` → location queries, boolean checks, lists (5-7× token savings)
   - `--fmt normal` → reading files, analysis, git operations
   - `--fmt json` → only when parsing nested data in code

3. **Session start** - always run these:
   ```bash
   adt resume --fmt slim
   adt context get --fmt slim
   adt context history --fmt slim
   adt smart suggest
   ```

4. **Before every patch** - always verify first:
   ```bash
   adt verify <file> --lines N:M --contains "<text>" --fmt slim
   adt patch <file> --replace N:M --with "..." --dry-run --fmt normal
   adt patch <file> --replace N:M --with "..." --fmt slim
   ```

5. **Read strategy by file size:**
   - < 200 lines → `adt read <file> --fmt normal`
   - 200-500 → `adt peek --fmt slim` then `adt read --start N`
   - > 500 → `adt outline --fmt slim` then `adt read --start N --end M`

6. **Always track important decisions:**
   ```bash
   adt context track "<decision>" --reason "<why>"
   ```

## AI-POWERED FEATURES (v2.0)

### Smart Command
```bash
adt smart suggest                    # Get AI recommendations based on codebase
adt smart analyze                    # Deep codebase analysis with metrics
adt smart plan "<goal>"              # Create step-by-step implementation plan
adt smart review                     # Review changes before commit
```

### Context Tracking
```bash
adt context track "<decision>" --reason "<why>"
adt context history                  # View all past decisions
adt context suggest                  # AI suggestions based on context
adt context search --query "<term>"  # Search through decisions
adt context get                      # Get all project context
```

### Batch Operations
```bash
adt batch --file <commands.txt> --parallel
adt batch --commands "grep 'export' src/ | symbols src/index.ts"
```

## KEY COMMANDS

### Search
```bash
adt where <symbol> --fmt slim
adt grep "<pattern>" src/ --fmt slim
adt grep "<pattern>" . --regex --fmt slim
adt find . --name "*.service.ts" --fmt slim
adt refs <symbol> src/ --fmt slim
adt search "<pattern>" src/ --fmt normal
```

### Read
```bash
adt info <file> --fmt slim
adt peek <file> --fmt slim
adt outline <file> --fmt slim
adt read <file> --start N --lines 100 --fmt normal
adt read <file> --around N --context 15 --fmt normal
adt read <file> --fn <functionName> --fmt normal
```

### Symbols
```bash
adt sig <symbol> src/ --fmt slim
adt def <symbol> src/ --fmt normal
adt body <symbol> src/ --fmt normal
adt callers <symbol> src/ --fmt slim
adt callees <symbol> src/ --fmt slim
adt symbols <file> --type class --exported
```

### Edit
```bash
adt verify <file> --lines N:M --contains "<text>" --fmt slim
adt patch <file> --replace N:M --with "..." --fmt slim
adt patch <file> --insert-after N --content "..." --fmt slim
adt patch <file> --delete N:M --fmt slim
adt replace src/ "<from>" "<to>" --ext ts --dry-run --fmt slim
adt rename <old> <new> src/ --dry-run --fmt slim
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
adt git stash save "<msg>" --fmt slim
```

### Quality & Analysis
```bash
adt lint src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
adt security scan src/ --fmt slim
adt health --verbose                   # Complete health report
adt complexity src/ --top 10           # Find complex code
adt duplicate src/ --lines 5           # Find duplicate code
adt unused src/ --check both           # Find unused code
```

### Documentation
```bash
adt changelog --version 2.0.0          # Generate changelog
adt toc <file>                         # Generate TOC
adt split <file> --lines 400           # Split large files
adt doc coverage <file>                # Check documentation
```

## TYPICAL WORKFLOW

```bash
# Session start
adt resume --fmt slim
adt context get --fmt slim
adt smart suggest

# Explore
adt where "UserService" src/ --fmt slim
adt peek src/UserService.ts --fmt slim

# Understand
adt callers "UserService.login" src/ --fmt slim
adt deps src/UserService.ts --file

# Track decision
adt context track "Refactoring login for performance" --reason "User reports"

# Plan
adt smart plan "optimize login performance"

# Execute
adt batch --file plan.txt --parallel

# Review
adt smart review
adt git diff --staged

# Commit
adt git commit --message "refactor: optimize login"
```

## BEST PRACTICES

1. Start with `adt smart suggest` for recommendations
2. Track decisions with `adt context track`
3. Use `adt batch` for multiple commands (saves tokens!)
4. Always verify before editing
5. Use `adt smart review` before committing
6. Check `adt health` periodically
7. Use `--fmt slim` for queries, `--fmt normal` for content
