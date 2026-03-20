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
