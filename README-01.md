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
