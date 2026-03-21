# {{PROJECT_NAME}} — Copilot Instructions

## Dev Tooling

`adt` (ai-dev-tools) v{{ADT_VERSION}} is installed globally. Use `adt` for ALL file operations, search, and git tasks.

## When suggesting terminal commands, always use adt:

### AI-Powered Features (v2.0)

```bash
# Smart suggestions based on codebase state
adt smart suggest                    # Get AI recommendations
adt smart analyze                    # Deep codebase analysis
adt smart plan "<goal>"              # Create implementation plan
adt smart review                     # Review changes before commit

# Context tracking
adt context track "<decision>" --reason "<why>"
adt context history                  # View past decisions
adt context suggest                  # AI suggestions based on context

# Batch operations
adt batch --file <commands.txt> --parallel
```

### Instead of `grep`

```bash
adt grep "<pattern>" src/ --fmt slim
adt grep "<pattern>" . --regex --fmt slim
adt search "<pattern>" src/ --fmt normal
```

### Instead of `cat` / reading files

```bash
adt peek <file> --fmt slim              # quick overview
adt outline <file> --fmt slim           # table of contents (>500 lines)
adt read <file> --start N --lines 100 --fmt normal
adt read <file> --fn <functionName> --fmt normal
```

### Instead of `find`

```bash
adt find . --name "*.service.ts" --fmt slim
adt where <symbol> --fmt slim
adt files src/ --sort size --limit 10
```

### Instead of `sed` / file editing

```bash
# Always verify before patching
adt verify <file> --lines N:M --contains "<expected>" --fmt slim
adt patch <file> --replace N:M --with "<new content>" --dry-run --fmt normal
adt patch <file> --replace N:M --with "<new content>" --fmt slim
```

### Instead of `git`

```bash
adt git status --fmt slim
adt git log --limit 10 --fmt slim
adt git diff --staged --fmt normal
adt git add <path> --fmt slim
adt git commit --message "<message>" --fmt slim
adt git push --fmt slim
```

## Format Rule

- `--fmt slim` → location queries, boolean checks, file lists (5-7× token savings)
- `--fmt normal` → reading file content, analysis output
- `--fmt json` → only when processing output programmatically

## Quality & Analysis (v2.0)

```bash
# Project health
adt health --verbose

# Code complexity
adt complexity src/ --top 10
adt complexity <file> --action file

# Find issues
adt duplicate src/ --lines 5
adt unused src/ --check both
adt recent . --hours 24

# Standard quality checks
adt lint src/ --fmt slim
adt typecheck src/ --fmt slim
adt test --fmt slim
adt test <file> --coverage
```

## Typical Workflow

```bash
# Start session
adt resume --fmt slim
adt context get --fmt slim
adt smart suggest

# Track decisions
adt context track "Adding new feature" --reason "User request"

# Get recommendations
adt smart suggest

# Plan work
adt smart plan "implement user authentication"

# Execute efficiently
adt batch --file plan.txt --parallel

# Review before commit
adt smart review
adt git diff --staged
```

## Documentation

```bash
adt changelog --version 2.0.0
adt toc <file>
adt split <file> --lines 400
```

## Best Practices

1. Use `adt smart suggest` at session start
2. Track important decisions with `adt context track`
3. Use `adt batch` for multiple operations
4. Always verify before patching
5. Use `adt smart review` before commits
6. Check `adt health` regularly
