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
