# AI Dev Tools (adt)

> Token-efficient CLI for AI agents and developers - 5-7× less token usage than JSON output

[![npm version](https://badge.fury.io/js/ai-dev-tools.svg)](https://www.npmjs.com/package/ai-dev-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/ai-dev-tools.svg)](https://nodejs.org)

**AI Dev Tools (adt)** is a CLI tool optimized for AI agents and developers. It provides token-efficient command output (65% savings on average) while maintaining readability for humans.

## 🚀 Quick Start

```bash
# Install globally
npm install -g ai-dev-tools

# Check your environment
adt doctor

# Initialize for your AI tools
adt init
```

## ✨ Features

### 🔍 Token-Efficient Output
- **65% token savings** compared to JSON
- Three formats: `slim`, `normal`, `json`
- Optimized for AI/LLM consumption
- Still human-readable

### 📁 File Operations
```bash
adt read src/app.ts --start 100 --lines 50
adt peek src/components/Header.ts --fmt slim
adt outline src/utils/helpers.ts --fmt slim
```

### 🔎 Search & Navigation
```bash
adt grep "UserService" src/ --ext ts --fmt slim
adt where "UserController" src/ --fmt slim
adt find "*.service.ts" src/ --fmt slim
```

### 🛠️ Safe Editing
```bash
# Always verify before editing
adt verify src/app.ts --lines 45:50 --contains "export function"
adt patch src/app.ts --replace 45:50 --with "export async function"
```

### 🌲 Project Analysis
```bash
adt map src/ --fmt slim
adt stats src/ --fmt slim
adt deps src/app.ts --file
```

### 🐙 Git Operations
```bash
adt git status --fmt slim
adt git log --limit 10 --fmt slim
adt git commit --message "feat: add auth"
```

## 📖 Command Groups

| Group | Commands |
|-------|----------|
| **READ** | read, peek, outline, cat, head, tail |
| **SEARCH** | grep, find, where, search, refs |
| **SYMBOL** | symbols, sig, def, body, callers, callees |
| **EDIT** | verify, patch, replace, create, delete, move, copy, rename |
| **MAP** | map, tree, stats, deps, impact |
| **GIT** | status, log, diff, blame, branch, commit, stash, reset, merge, tag |
| **SHELL** | exec, platform, run, env, which |
| **QUALITY** | lint, test, typecheck, format |
| **SESSION** | session, diff, undo, checkpoint |
| **SYSTEM** | init, doctor |

## 🎯 Usage

### For AI Agents
```bash
# Session start
adt resume --fmt slim
adt context get --fmt slim

# Quick location queries (slim)
adt where "symbol" src/ --fmt slim

# Content reading (normal)
adt read src/file.ts --start 100 --lines 50

# Safe editing
adt verify src/file.ts --lines 10:20 --contains "expected"
adt patch src/file.ts --replace 10:20 --with "new" --dry-run
adt patch src/file.ts --replace 10:20 --with "new"
```

### For Developers
```bash
# Quick overview
adt peek src/components/Header.ts

# Find usage
adt refs "useEffect" src/

# Impact analysis
adt impact UserService --symbol update
```

## 📊 Token Efficiency

| Format | Savings | Best For |
|--------|---------|----------|
| **slim** | 5-7× | AI agents, quick queries |
| **normal** | 2-3× | Human reading |
| **json** | 0× | Programmatic |

## 🔧 Installation

```bash
# Global
npm install -g ai-dev-tools

# Local dev
npm install --save-dev ai-dev-tools

# With npx (no install)
npx ai-dev-tools --help
```

## 📋 Requirements

- Node.js >= 18.0.0
- Git (for git operations)

## 🤝 AI Tool Integration

```bash
# Auto-generate config for Claude, Cursor, etc.
adt init

# For specific tools
adt init --tools claude,cursor
```

## 📚 More Info

- Full documentation: `adt --help`
- Design spec: [README_DESIGN.md](./README_DESIGN.md)
- 50+ commands across 10 groups

## 📝 License

MIT © 2025

---

**Made with ❤️ for AI agents and developers**
