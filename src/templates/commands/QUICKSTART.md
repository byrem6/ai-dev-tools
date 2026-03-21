# ADT Quick Reference Card

## 🚀 Installation
```bash
npm install -g @byrem6/ai-dev-tools
```

## 📊 Format Guide
| Format | Use When | Savings |
|--------|----------|---------|
| `slim` | AI queries, quick checks | 5-7× |
| `normal` | Reading, analysis | 2-3× |
| `json` | Scripts, APIs | 0× |

## 🔥 Top 10 Commands

### 1. read - Read files smart
```bash
adt read src/app.ts --start 100 --lines 50
adt read src/app.ts --fn getUserById
adt read src/app.ts --around 150 --context 10
```

### 2. grep - Pattern search
```bash
adt grep "UserService" src/
adt grep "TODO\|FIXME" src/ --regex --fmt slim
```

### 3. where - Find symbols
```bash
adt where "AuthService" src/
adt where "useState" src/components/
```

### 4. patch - Safe editing
```bash
adt verify src/app.ts --lines 100:105 --contains "export"
adt patch src/app.ts --replace 100:105 --with "new" --dry-run
adt patch src/app.ts --replace 100:105 --with "new"
```

### 5. smart - AI suggestions (NEW!)
```bash
adt smart suggest
adt smart analyze
adt smart plan "refactor auth"
adt smart review
```

### 6. context - Track decisions (NEW!)
```bash
adt context track "Decision" --reason "Why"
adt context history
adt context suggest
```

### 7. complexity - Code complexity
```bash
adt complexity src/ --top 10
adt complexity . --action debt
```

### 8. batch - Automation (NEW!)
```bash
adt batch --file commands.txt --parallel
adt batch --commands "grep 'export' src/ | symbols"
```

### 9. git-status - Git status
```bash
adt git status --fmt slim
adt git diff --staged
```

### 10. health - Project health
```bash
adt health --verbose
```

## 📁 File Operations

### Reading
| Command | Use |
|---------|-----|
| `read` | Read ranges, functions |
| `peek` | Quick file info |
| `outline` | File structure TOC |

### Searching
| Command | Use |
|---------|-----|
| `grep` | Pattern search |
| `find` | Find files |
| `where` | Find symbols |
| `refs` | Find references |

### Editing
| Command | Use |
|---------|-----|
| `verify` | Check before edit |
| `patch` | Line-based edit |
| `replace` | String replace |
| `rename` | Symbol rename |

## 🎯 Common Workflows

### AI Agent Workflow
```bash
# 1. Initialize
adt resume --fmt slim
adt context get --fmt slim

# 2. Quick location
adt where "symbol" src/ --fmt slim

# 3. Read content
adt read file.ts --start N --lines 50

# 4. Safe edit
adt verify file.ts --lines N:M --contains "text"
adt patch file.ts --replace N:M --with "new"
```

### Code Review Workflow
```bash
# 1. Check health
adt health

# 2. Review changes
adt git diff --staged

# 3. Analyze complexity
adt complexity src/ --top 10

# 4. Find duplicates
adt duplicate src/ --lines 5

# 5. Smart review
adt smart review
```

### Refactoring Workflow
```bash
# 1. Track decision
adt context track "Refactor UserService" --reason "Performance"

# 2. Create plan
adt smart plan "refactor UserService"

# 3. Analyze complexity
adt complexity src/services/ --top 10

# 4. Find duplicates
adt duplicate src/services/ --lines 5

# 5. Find unused
adt unused src/ --check both

# 6. Execute batch
adt batch --file refactor.txt

# 7. Review changes
adt smart review
```

## 🧠 AI Features (NEW!)

### Smart Command
```bash
adt smart suggest    # Get AI suggestions
adt smart analyze    # Deep codebase analysis
adt smart plan "<goal>"  # Create implementation plan
adt smart review     # Review changes
```

### Context Command
```bash
adt context get              # Get all context
adt context track "decision" --reason "why"
adt context history          # View decisions
adt context suggest          # AI suggestions
adt context search --query "term"
adt context clear            # Clear context
```

### Batch Automation
```bash
# Create batch file
cat > commands.txt << EOF
grep "TODO" src/
complexity src/
health
EOF

# Run commands
adt batch --file commands.txt --parallel

# Inline commands
adt batch --commands "grep 'export' src/ | symbols"
```

## ⚡ Token Efficiency Tips

1. **Always use slim for AI queries**
   ```bash
   adt where "symbol" src/ --fmt slim  # ~50 tokens
   ```

2. **Read only what you need**
   ```bash
   adt read file.ts --start 100 --lines 50  # ~200 tokens
   # vs reading entire file: ~2000+ tokens
   ```

3. **Use batch operations**
   ```bash
   adt batch --file commands.txt --parallel  # ~40 tokens for 5 commands
   ```

4. **Leverage context tracking**
   ```bash
   adt context track "decision"  # ~25 tokens
   ```

## 🛡️ Safety Best Practices

1. **Always verify before editing**
   ```bash
   adt verify file.ts --lines N:M --contains "text"
   ```

2. **Use dry-run first**
   ```bash
   adt patch file.ts --replace N:M --with "new" --dry-run
   ```

3. **Create backups**
   ```bash
   adt delete file.ts --backup
   adt patch file.ts --replace N:M --with "new" --backup
   ```

4. **Review with smart**
   ```bash
   adt smart review  # Before committing
   ```

## 📋 Command Categories

| Category | Commands | Description |
|----------|----------|-------------|
| READ | read, peek, outline | File reading |
| SEARCH | grep, find, where, search, refs | Search & find |
| SYMBOL | symbols, sig, def, body, callers, callees | Symbol nav |
| EDIT | verify, patch, replace, create, delete, move, copy, rename | Editing |
| MAP | map, tree, stats, deps, impact | Analysis |
| GIT | status, log, diff, blame, branch, commit, stash, reset, merge, tag | Git |
| SHELL | exec, platform, run, env, which | Shell |
| QUALITY | lint, test, typecheck, format | Quality |
| AI | ai, smart, context | AI features |
| BATCH | batch | Automation |
| UTILITY | info, files, recent, duplicate, unused, health, changelog | Utils |
| SYSTEM | init, doctor | System |

## 🎨 Output Examples

### Slim Format (Token-Optimized)
```
ok true
src/service.ts:45:8:async function login(
src/controller.ts:78:12:login(
---
count: 2  ~tokens: 35
```

### Normal Format (Readable)
```
ok: true
command: grep
pattern: login
===

src/service.ts:45:8
  async function login(
    username: string,
    password: string
  ): Promise<User>

---
matches: 2  ~tokens: 120
```

## 🔗 Resources

- **Full Docs**: `adt --help`
- **Command Help**: `adt <command> --help`
- **GitHub**: https://github.com/byrem6/ai-dev-tools
- **Design**: README_DESIGN.md
- **v2.0 Features**: ADT_V2_FINAL_REPORT.md

## 💡 Pro Tips

1. Start with `adt smart suggest` for recommendations
2. Use `adt context track` to remember decisions
3. Run `adt health` before starting work
4. Use `adt batch` for multi-step workflows
5. Always use `--fmt slim` for AI queries
6. Verify before patch with `adt verify`
7. Use `adt complexity` to find refactoring targets
8. Check `adt health` regularly
9. Review with `adt smart review` before commits
10. Track decisions with `adt context`

---

**Version**: 2.0.0 | **Commands**: 60+ | **Categories**: 12

Made with ❤️ for AI agents and developers
