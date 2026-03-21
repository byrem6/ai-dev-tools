# 🤖 AI Dev Tools (adt)

<div align="center">

**Token-efficient CLI for AI agents and developers**

[![npm version](https://badge.fury.io/js/@byrem6%2Fai-dev-tools.svg)](https://www.npmjs.com/package/@byrem6/ai-dev-tools)
[![Downloads](https://img.shields.io/npm/dm/@byrem6/ai-dev-tools.svg)](https://www.npmjs.com/package/@byrem6/ai-dev-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@byrem6/ai-dev-tools.svg)](https://nodejs.org)

**5-7× less token usage than JSON • 60+ commands • Cross-platform**

[Features](#-features) • [Quick Start](#-quick-start) • [Commands](#-commands) • [Examples](#-usage-examples) • [API](#-api)

</div>

---

## 📖 Overview

**AI Dev Tools (adt)** is a revolutionary CLI tool designed specifically for AI agents and developers who want maximum efficiency. By using intelligent output formatting, adt achieves **5-7× token savings** compared to traditional JSON output while maintaining full human readability.

### 🎯 Perfect For

- **AI Agents** (Claude, GPT-4, Copilot, Cursor) - Minimize context window usage
- **Developers** - Lightning-fast code navigation and analysis
- **DevOps Engineers** - Automated project analysis and health checks
- **Code Reviewers** - Intelligent change detection and impact analysis

---

## ✨ Key Features

### 🚀 Token Efficiency
- **65-80% token savings** with `slim` format
- **3 output modes**: `slim`, `normal`, `json`
- **Smart truncation** for large outputs
- **Token estimation** in every response

### 🧠 AI-Powered Intelligence
- **Smart suggestions** based on codebase state
- **Context tracking** for decision history
- **Automated planning** for complex goals
- **Change review** before commits

### ⚡ Powerful Operations
- **60+ commands** across 12 categories
- **Command chaining** with pipe operator
- **Parallel batch execution**
- **Cross-platform** (Windows, Linux, macOS)

### 🛡️ Safety First
- **Atomic operations** with automatic rollback
- **Backup creation** before destructive actions
- **Verification before** editing
- **Git safety checks**

---

## 🚀 Quick Start

### Installation

```bash
# Global installation (recommended)
npm install -g @byrem6/ai-dev-tools

# Local development
npm install --save-dev @byrem6/ai-dev-tools

# Using npx (no installation)
npx @byrem6/ai-dev-tools --help
```

### First Steps

```bash
# Check your environment
adt doctor

# Get intelligent suggestions for your project
adt smart suggest

# Explore your codebase
adt map . --fmt normal

# Initialize AI tool configs
adt init
```

---

## 📊 Token Efficiency Comparison

| Command | JSON Output | Slim Format | Savings |
|---------|-------------|-------------|---------|
| `grep` (10 matches) | ~280 tokens | ~45 tokens | **84%** |
| `git status` | ~85 tokens | ~22 tokens | **74%** |
| `complexity` (20 files) | ~320 tokens | ~60 tokens | **81%** |
| `read` (100 lines) | ~180 tokens | ~35 tokens | **81%** |
| **Average** | - | - | **~75%** |

---

## 🎯 Usage Examples

### For AI Agents

```bash
# Session initialization
adt resume --fmt slim
adt context get --fmt slim

# Quick symbol location (slim format for minimum tokens)
adt where "UserService" src/ --fmt slim
# Output: src/services/UserService.ts:45:8

# Read specific range
adt read src/services/UserService.ts --start 45 --lines 20 --fmt normal

# Safe editing workflow
adt verify src/app.ts --lines 100:105 --contains "export function"
adt patch src/app.ts --replace 100:105 --with "export async function" --dry-run
adt patch src/app.ts --replace 100:105 --with "export async function"
```

### For Developers

```bash
# Quick file overview
adt peek src/components/Header.ts

# Find all usages
adt refs "useEffect" src/

# Analyze complexity
adt complexity src/ --top 10

# Check project health
adt health --verbose

# Generate changelog
adt changelog --version 2.0.0
```

### AI-Powered Workflow

```bash
# 1. Get intelligent suggestions
adt smart suggest

# 2. Track your decisions
adt context track "Use TypeScript strict mode" --reason "Better type safety"

# 3. Create implementation plan
adt smart plan "refactor authentication system"

# 4. Execute with batch operations
adt batch --file refactor-plan.txt --parallel

# 5. Review changes before commit
adt smart review

# 6. View decision history
adt context history --fmt normal
```

---

## 📚 Commands

### 🔍 Read & Navigation

```bash
# Smart file reading
adt read <file> [options]
  --start N         Start line number
  --lines N         Number of lines to read
  --around N        Read around line (context)
  --fn <name>       Read function by name
  --fmt slim|normal|json

# Quick file overview
adt peek <file> --fmt slim
# Output: TypeScript  202 lines  11.7 KB  utf-8 CRLF

# File structure
adt outline <file> --fmt slim
# Output: class UserService :45–200
#         method constructor :50–55
#         method login :57–80

# Symbol listing
adt symbols <file> --fmt slim
```

### 🔎 Search & Discovery

```bash
# Pattern search (grep-style)
adt grep "<pattern>" [path] --fmt slim
# Output: src/service.ts:45:8:async function login(

# Find files by name/pattern
adt find "*.service.ts" src/ --fmt slim

# Locate symbols
adt where "UserService" src/ --fmt slim

# Find references
adt refs "AuthService" src/ --fmt slim

# Deep search with context
adt search "login" src/ --fmt normal
```

### 🛠️ Editing & Refactoring

```bash
# Safe editing workflow
adt verify <file> --lines N:M --contains "<text>"
adt patch <file> --replace N:M --with "<new>" --dry-run
adt patch <file> --replace N:M --with "<new>"

# String replacement
adt replace "<old>" "<new>" <file> --regex

# File operations
adt create <file> --type ts|js|jsx|tsx
adt delete <file> --backup
adt move <file> <new-path> --update-imports
adt copy <source> <dest>
adt rename <old-name> <new-name> --scope project
```

### 📊 Analysis & Metrics

```bash
# Project structure
adt map [path] --fmt slim
adt tree [path] --depth 2
adt stats [path] --by-extension

# Dependency analysis
adt deps <file> --file
adt impact <symbol> --scope <path>

# Code complexity
adt complexity [path] --top 20 --action hotspot|file|debt

# Project health
adt health --verbose
# Output: score: 75/100
#         Structure: ✓
#         Documentation: ✗
#         Testing: ⚠

# Find duplicate code
adt duplicate [path] --lines 5 --no-whitespace

# Find unused code
adt unused [path] --check imports|exports|both
```

### 🧠 AI Features (NEW!)

```bash
# Smart suggestions
adt smart suggest
# Analyzes codebase and suggests next actions

# Deep analysis
adt smart analyze
# Complete codebase health and metrics

# Goal planning
adt smart plan "<goal>"
# Generates step-by-step implementation plan

# Change review
adt smart review
# Validates changes before commit
```

### 🔄 Context & Decisions (NEW!)

```bash
# Track decisions
adt context track "<decision>" --reason "<why>"

# View context
adt context get --fmt normal

# Decision history
adt context history --fmt normal

# Get AI suggestions
adt context suggest

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

## 🤝 AI Tool Integration

### Supported Tools

```bash
# Auto-generate configs for all tools
adt init

# Specific tools
adt init --tools claude
adt init --tools cursor
adt init --tools copilot
adt init --tools claude,cursor
```

Generated configs:
- `.claude/instructions.md`
- `.cursorrules`
- `.github/copilot-instructions.md`
- `.opencode/config.json`

---

## 📈 Performance

### Benchmarks

| Operation | Time | Tokens |
|-----------|------|--------|
| Grep (1000 files) | ~2s | ~50 (slim) |
| Complexity (100 files) | ~3s | ~60 (slim) |
| Map (large project) | ~1s | ~30 (slim) |
| Batch (10 commands) | ~0.5s | ~40 (slim) |

### System Requirements

- **Node.js**: >= 18.0.0
- **OS**: Windows, Linux, macOS
- **Memory**: 512MB minimum
- **Disk**: 50MB installed

---

## 🆚 Comparison

| Feature | adt | rg + jq | ag | grep |
|---------|-----|---------|-----|------|
| Token-efficient output | ✅ | ❌ | ❌ | ❌ |
| Multi-format output | ✅ | ❌ | ❌ | ❌ |
| Symbol navigation | ✅ | ❌ | ❌ | ❌ |
| Dependency analysis | ✅ | ❌ | ❌ | ❌ |
| Safe editing | ✅ | ❌ | ❌ | ❌ |
| Git integration | ✅ | ❌ | ❌ | ❌ |
| AI-powered features | ✅ | ❌ | ❌ | ❌ |
| Cross-platform | ✅ | ✅ | ✅ | ✅ |

---

## 📚 Documentation

- **Full Design Spec**: [README_DESIGN.md](./README_DESIGN.md)
- **v2.0 Implementation**: [ADT_V2_FINAL_REPORT.md](./ADT_V2_FINAL_REPORT.md)
- **Improvements Log**: [ADT_IMPROVEMENTS.md](./ADT_IMPROVEMENTS.md)
- **v2.0 Plan**: [ADT_V2_PLAN.md](./ADT_V2_PLAN.md)

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

```bash
# Development
git clone https://github.com/byrem6/ai-dev-tools.git
cd ai-dev-tools
npm install
npm run build
npm run validate
```

---

## 📝 Changelog

### v2.0.0 (Latest)
- ✨ New `smart` command with AI-powered suggestions
- ✨ Enhanced `context` command with history and search
- ✨ Command chaining and parallel batch execution
- 🐛 Fixed complexity command for directory paths
- ⚡ 5-7× token efficiency improvements
- 📚 Comprehensive documentation

### v1.1.0
- Initial stable release
- 60+ commands across 12 categories
- Token-efficient output system

---

## 📄 License

MIT © 2025 Ramazan Hocaoglu

[GitHub](https://github.com/byrem6/ai-dev-tools) •
[NPM](https://www.npmjs.com/package/@byrem6/ai-dev-tools) •
[Issues](https://github.com/byrem6/ai-dev-tools/issues)

---

<div align="center">

**Built with ❤️ for AI agents and developers**

⭐ Star us on GitHub — it helps!

</div>
