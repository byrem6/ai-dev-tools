# Search context
adt context search --query "<term>"

# Clear context
adt context clear
```

### ⚡ Batch & Automation (NEW!)

```bash
# Batch file execution
adt batch --file <batch-file> --parallel

# Inline commands
adt batch --commands "grep 'export' src/ | symbols src/index.ts"

# Batch file format:
# grep "TODO" src/
# complexity src/
# health
```

### 🐙 Git Operations

```bash
# Git status (slim format)
adt git status --fmt slim

# Git log
adt git log --limit 20 --fmt slim

# Git diff
adt git diff --staged --fmt normal

# Git commit
adt git commit --message "feat: add user auth"

# Branch management
adt git branch list
adt git branch create feature/auth

# Stash, reset, merge, tag, cherry-pick...
```

### 🧪 Quality & Testing

```bash
# Linting
adt lint [path] --fix

# Testing
adt test [file] --coverage

# Type checking
adt typecheck [path]

# Code formatting
adt format [path] --check
```

### 📝 Documentation

```bash
# Generate table of contents
adt toc <file>

# Split documentation
adt split <file> --chapters

# Generate docs
adt doc generate --all
```

### 🌐 Other Commands

```bash
# Session management
adt session --diff
adt session --undo

# Platform info
adt platform --fmt slim

# Environment variables
adt env --filter NODE*

# Pattern matching
adt pattern "<regex>" [path]

# Tag management
adt tag list --sort recent

# Security scan
adt security [path]

# Risk analysis
adt risk [path] --threshold high
```

---

## 🔧 Command Categories

| Category | Commands | Description |
|----------|----------|-------------|
| **READ** | read, peek, outline, cat, head, tail | Smart file reading |
| **SEARCH** | grep, find, where, search, refs | Pattern search & discovery |
| **SYMBOL** | symbols, sig, def, body, callers, callees | Symbol navigation |
| **EDIT** | verify, patch, replace, create, delete, move, copy, rename | Safe editing operations |
| **MAP** | map, tree, stats, deps, impact | Project structure & analysis |
| **GIT** | status, log, diff, blame, branch, commit, stash, reset, merge, tag | Git operations |
| **SHELL** | exec, platform, run, env, which | Shell & system commands |
| **QUALITY** | lint, test, typecheck, format | Code quality checks |
| **AI** | ai, smart, context | AI-powered features |
| **BATCH** | batch | Automation & chaining |
| **UTILITY** | info, files, recent, duplicate, unused, health, changelog, safe, quick | Developer utilities |
| **SYSTEM** | init, doctor | System setup & diagnostics |

---

## 💡 Pro Tips

### Format Selection Guide

| Situation | Best Format | Why |
|-----------|-------------|-----|
| AI agent queries | `slim` | Minimum tokens (5-7× savings) |
| Grep/search results | `slim` | Classic format, parseable |
| Human reading | `normal` | Balanced, readable |
| Code review | `normal` | Rich context, structured |
| Nested analysis | `json` | Required for complex data |
| Programmatic use | `json` | Easy to parse |

### AI Agent Best Practices

```bash
# 1. Always use slim for location queries
adt where "symbol" src/ --fmt slim

# 2. Use normal for content you'll analyze
adt read file.ts --start 100 --lines 50 --fmt normal

# 3. Batch operations for efficiency
adt batch --file commands.txt --parallel

# 4. Track context for better suggestions
adt context track "Working on auth feature"

# 5. Use smart suggestions when stuck
adt smart suggest
```

### Token Optimization

```bash
# ❌ Inefficient ( wastes tokens)
adt read large-file.ts --fmt json
# Output: ~2000 tokens

# ✅ Efficient (saves 80% tokens)
adt read large-file.ts --start 100 --lines 50 --fmt slim
# Output: ~400 tokens
```

---

## 📦 API & Integration

### Programmatic Usage

```javascript
const { ExecCommand } = require('@byrem6/ai-dev-tools');

// Use adt in your Node.js scripts
const exec = new ExecCommand();
const result = await exec.execute('npm', 'test', '--fmt', 'slim');
console.log(result.content);
```

### VS Code Integration

```json
// settings.json
{
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.profiles.windows": {
    "adt": {
      "path": "adt",
      "args": []
    }
  }
}
```

### GitHub Actions

```yaml
- name: Code Analysis
  run: |
    npm install -g @byrem6/ai-dev-tools
    adt health --exit-on-error
    adt complexity src/ --fail-above 15
```

---

## 🎨 Output Formats

### Slim Format (Token-Optimized)

```
ok true
src/services/UserService.ts:45:8:async function login(
src/controllers/AuthController.ts:78:12:login(
tests/UserService.test.ts:23:5:login(
---
count: 3  ~tokens: 45
```

### Normal Format (Human-Readable)

```
ok: true
command: grep
pattern: login
===

src/services/UserService.ts:45:8
  async function login(
    username: string,
    password: string
  ): Promise<User>

src/controllers/AuthController.ts:78:12
  login(
    req: Request,
    res: Response
  )

---
matches: 2  files: 2  ~tokens: 120
```

### JSON Format (Programmatic)

```json
{
  "ok": true,
  "command": "grep",
  "pattern": "login",
  "matches": [
    {
      "file": "src/services/UserService.ts",
      "line": 45,
      "col": 8,
      "text": "async function login("
    }
  ],
  "metadata": {
    "count": 2,
    "files": 2
  }
}
```

---

## 🛠️ Configuration

### Config File Location

```bash
~/.adt/config.json
```

### Default Config

```json
{
  "defaultFmt": "normal",
  "defaultLines": 100,
  "maxCatLines": 500,
  "maxGrepResults": 100,
  "backupRetentionDays": 7,
  "excludeByDefault": [
    "node_modules/**",
    "dist/**",
    ".git/**",
    "coverage/**"
  ],
  "tokenWarningThreshold": 1000,
  "autoBackup": true,
  "defaultShell": "auto",
  "gitSafetyChecks": true,
  "patchVerifyBeforeApply": true
}
```

---
