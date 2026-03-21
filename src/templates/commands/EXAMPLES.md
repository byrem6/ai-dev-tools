# ADT Examples - Real-World Usage Scenarios

This document provides practical examples for common development workflows.

## 📚 Table of Contents

1. [AI Agent Workflows](#ai-agent-workflows)
2. [Developer Workflows](#developer-workflows)
3. [Code Refactoring](#code-refactoring)
4. [Debugging](#debugging)
5. [Code Review](#code-review)
6. [Project Analysis](#project-analysis)
7. [Git Operations](#git-operations)
8. [Automation](#automation)

---

## 🤖 AI Agent Workflows

### Scenario 1: Understanding a Codebase

**Goal**: An AI agent needs to understand a new codebase efficiently.

```bash
# Step 1: Get project overview
adt map . --fmt slim
# Output: Shows directory structure

# Step 2: Check project health
adt health --fmt slim
# Output: score: 75/100, issues: 3

# Step 3: Get AI suggestions
adt smart suggest
# Output: 3-5 actionable suggestions

# Step 4: Find main entry points
adt find "index.ts" src/ --fmt slim
adt find "main.ts" src/ --fmt slim
adt find "app.ts" src/ --fmt slim

# Step 5: Explore key files
adt peek src/index.ts --fmt slim
adt outline src/index.ts --fmt slim

# Step 6: Understand architecture
adt deps src/index.ts --file --fmt normal

# Step 7: Track context
adt context track "Project uses TypeScript + Express" --reason "Architecture analysis"

# Total tokens: ~300 (vs ~2000+ with traditional tools)
```

### Scenario 2: Finding and Modifying Code

**Goal**: Locate a function and understand its usage.

```bash
# Step 1: Find function definition
adt where "UserService.login" src/ --fmt slim
# Output: src/services/UserService.ts:45:8

# Step 2: Read function
adt read src/services/UserService.ts --fn login --fmt normal
# Output: Full function body

# Step 3: Find all usages
adt refs "UserService.login" src/ --fmt slim
# Output: 5 references found

# Step 4: Check callers
adt callers "UserService.login" src/ --fmt normal
# Output: Who calls this function

# Step 5: Check what it calls
adt callees "UserService.login" src/ --fmt normal
# Output: Dependencies

# Step 6: Verify before editing
adt verify src/services/UserService.ts --lines 45:80 --contains "async function login"

# Step 7: Edit safely
adt patch src/services/UserService.ts --replace 45:80 --with "new implementation" --dry-run
adt patch src/services/UserService.ts --replace 45:80 --with "new implementation"

# Total tokens: ~500 (vs ~3000+ with cat + grep)
```

### Scenario 3: Batch Code Analysis

**Goal**: Analyze multiple files in parallel.

```bash
# Create batch file
cat > analysis.txt << EOF
grep "TODO" src/
grep "FIXME" src/
grep "HACK" src/
complexity src/
health
EOF

# Run in parallel
adt batch --file analysis.txt --parallel --fmt slim

# Total tokens: ~150 for 5 commands
```

---

## 👨‍💻 Developer Workflows

### Scenario 4: Daily Development Workflow

**Goal**: Start work on a new feature.

```bash
# Morning routine
adt git status --fmt slim
adt smart suggest
adt context history --fmt slim

# Start feature
adt context track "Working on user authentication" --reason "Feature request #123"

# Plan implementation
adt smart plan "implement user authentication"

# Check related code
adt where "AuthService" src/
adt where "User" src/

# Understand current implementation
adt read src/services/AuthService.ts --fn login
adt refs "AuthService" src/

# Start coding...
# (Make changes)

# Review before commit
adt smart review
adt git diff --staged
adt git status

# Commit
adt context track "Implemented user auth" --reason "Completed feature #123"
adt git commit --message "feat: add user authentication"
```

### Scenario 5: Bug Hunting

**Goal**: Find and fix a bug.

```bash
# 1. Understand the issue
adt context track "Bug: User cannot login" --reason "Ticket #456"

# 2. Check login code
adt where "login" src/
adt read src/services/AuthService.ts --fn login

# 3. Find related code
adt refs "login" src/
adt callees "AuthService.login" src/

# 4. Check recent changes
adt git log --limit 10 --fmt slim
adt git diff HEAD~5 -- src/services/AuthService.ts

# 5. Add logging/fix
adt verify src/services/AuthService.ts --lines 45:60 --contains "async function login"
adt patch src/services/AuthService.ts --replace 50:55 --with "console.log('Login attempt:', username)"

# 6. Test
adt test src/services/AuthService.test.ts

# 7. Review
adt smart review

# 8. Commit fix
adt git commit --message "fix: resolve login bug"
adt context track "Fixed login bug" --reason "Added validation"
```

---

## 🔧 Code Refactoring

### Scenario 6: Identifying Refactoring Targets

**Goal**: Find code that needs refactoring.

```bash
# 1. Check complexity
adt complexity src/ --top 20 --fmt normal
# Output: Top 20 most complex files

# 2. Find duplicate code
adt duplicate src/ --lines 5 --no-whitespace --fmt normal
# Output: Duplicate code blocks

# 3. Find unused code
adt unused src/ --check both --fmt normal
# Output: Unused imports and exports

# 4. Check project health
adt health --verbose

# 5. Create refactoring plan
adt smart plan "refactor complex code"
# Output: Step-by-step plan

# 6. Track decision
adt context track "Refactoring UserService (65 complexity)" --reason "Too complex"

# 7. Execute refactor
adt batch --file refactor-plan.txt

# 8. Verify
adt test
adt complexity src/ --top 10
```

### Scenario 7: Renaming Symbols

**Goal**: Rename a symbol across the project.

```bash
# 1. Find all usages
adt refs "UserService" src/
adt where "UserService" src/

# 2. Understand impact
adt impact UserService --symbol --scope src/

# 3. Plan rename
adt context track "Rename UserService to UserServiceV2" --reason "API versioning"

# 4. Perform rename
adt rename UserService UserServiceV2 --scope project

# 5. Verify changes
adt grep "UserServiceV2" src/ --fmt slim
adt test

# 6. Commit
adt git diff --staged
adt git commit --message "refactor: rename UserService to UserServiceV2"
```

---

## 🐛 Debugging

### Scenario 8: Debugging a Failing Test

**Goal**: Fix a failing test.

```bash
# 1. Run failing test
adt test src/services/UserService.test.ts --verbose

# 2. Find the function
adt where "getUserById" src/
adt read src/services/UserService.ts --fn getUserById

# 3. Check related code
adt callees "getUserById" src/
adt refs "getUserById" src/

# 4. Add debug logging
adt verify src/services/UserService.ts --lines 100:105 --contains "return user"
adt patch src/services/UserService.ts --replace 103:103 --with "console.log('User:', user); return user;"

# 5. Run test again
adt test src/services/UserService.test.ts

# 6. Fix issue
adt patch src/services/UserService.ts --replace 100:110 --with "fixed code"

# 7. Remove debug logs
adt patch src/services/UserService.ts --replace 103:103 --with "return user;"

# 8. Final test
adt test
```

---

## 👀 Code Review

### Scenario 9: Reviewing a Pull Request

**Goal**: Thoroughly review changes.

```bash
# 1. Check what changed
adt git status
adt git diff --staged --fmt normal

# 2. Analyze complexity
adt complexity src/ --top 10

# 3. Check for issues
adt duplicate src/ --lines 3
adt unused src/ --check both

# 4. Smart review
adt smart review

# 5. Check specific files
adt peek src/new-feature.ts
adt outline src/new-feature.ts

# 6. Verify patterns
adt grep "TODO\|FIXME\|HACK" src/ --regex
adt grep "console\." src/ --regex

# 7. Run tests
adt test --coverage

# 8. Approve or request changes
adt context track "Reviewed PR #789 - Approved" --reason "Clean implementation"
```

---

## 📊 Project Analysis

### Scenario 10: Onboarding to a New Project

**Goal: Quickly understand a new codebase.

```bash
# 1. Project structure
adt map . --depth 2 --fmt slim

# 2. Project health
adt health --verbose

# 3. Main files
adt find "index.ts" . --max-depth 2
adt find "main.ts" . --max-depth 2
adt find "app.ts" . --max-depth 2

# 4. Key dependencies
adt deps src/index.ts --file
adt deps . --tree

# 5. AI analysis
adt smart analyze

# 6. Check patterns
adt grep "export class" src/ --regex | head -20
adt grep "export function" src/ --regex | head -20

# 7. Read key files
adt peek src/index.ts
adt outline src/index.ts

# 8. Understand architecture
adt context track "Project: Express + TypeScript + MongoDB" --reason "Tech stack"
adt context track "Entry: src/index.ts" --reason "Main entry point"
```

### Scenario 11: Dependency Analysis

**Goal**: Understand project dependencies.

```bash
# 1. All dependencies
adt deps . --tree

# 2. Specific file
adt deps src/app.ts --file

# 3. Find circular dependencies
adt grep "require\|import" src/ --regex | grep "cycle"

# 4. Check package.json
adt peek package.json --fmt slim

# 5. Find unused dependencies
adt unused src/ --check imports
```

---

## 🐙 Git Operations

### Scenario 12: Git Workflow

**Goal**: Efficient git operations.

```bash
# 1. Check status
adt git status --fmt slim

# 2. See recent commits
adt git log --limit 20 --fmt slim

# 3. See changes
adt git diff --fmt normal
adt git diff --staged

# 4. Check specific file
adt git blame src/app.ts

# 5. Commit workflow
adt git add src/
adt smart review
adt git commit --message "feat: add feature"

# 6. Branch management
adt git branch list
adt git branch create feature/new-feature
adt git checkout feature/new-feature

# 7. Merge
adt git merge feature/new-feature
```

---

## ⚡ Automation

### Scenario 13: Automated Code Quality Checks

**Goal**: Run quality checks automatically.

```bash
# Create quality check batch file
cat > quality-check.txt << EOF
lint src/
test --coverage
typecheck src/
complexity src/ --top 10
duplicate src/ --lines 5
health
EOF

# Run checks
adt batch --file quality-check.txt --parallel

# Use in CI/CD
adt batch --file quality-check.txt --continue-on-error
```

### Scenario 14: Automated Documentation

**Goal**: Generate documentation automatically.

```bash
# 1. Generate changelog
adt changelog --version 2.0.0

# 2. Generate TOC for large files
adt toc README.md

# 3. Split documentation
adt split docs/guide.md --chapters

# 4. Find undocumented symbols
adt symbols src/ --filter "!documented"
```

---

## 🎯 Advanced Workflows

### Scenario 15: Multi-Project Analysis

**Goal**: Analyze multiple projects.

```bash
# Create batch file
cat > multi-project.txt << EOF
cd project1 && adt health --fmt slim
cd project2 && adt health --fmt slim
cd project3 && adt health --fmt slim
EOF

# Run analysis
adt batch --file multi-project.txt
```

### Scenario 16: Performance Optimization

**Goal**: Identify performance bottlenecks.

```bash
# 1. Find complex code
adt complexity src/ --top 20

# 2. Find duplicate code
adt duplicate src/ --lines 5

# 3. Find inefficient patterns
adt grep "forEach\|for.*in" src/ --regex
adt grep "nested.*loop" src/ --regex

# 4. Check file sizes
adt files src/ --sort size --limit 10

# 5. Create optimization plan
adt smart plan "optimize performance"
```

---

## 💡 Tips & Best Practices

### Token Optimization
```bash
# ❌ Wastes tokens
adt read large-file.ts --fmt json  # ~2000 tokens

# ✅ Efficient
adt read large-file.ts --start 100 --lines 50 --fmt slim  # ~200 tokens
```

### Safety First
```bash
# Always verify before editing
adt verify file.ts --lines N:M --contains "expected"
adt patch file.ts --replace N:M --with "new" --dry-run
adt patch file.ts --replace N:M --with "new"
```

### Use AI Features
```bash
# Get smart suggestions
adt smart suggest

# Track decisions
adt context track "decision" --reason "why"

# Create plans
adt smart plan "goal"
```

### Batch Operations
```bash
# Execute multiple commands efficiently
adt batch --file commands.txt --parallel

# Chain commands
adt batch --commands "grep 'export' src/ | symbols"
```

---

## 🎓 Learning Path

### Beginner
1. Start with `adt --help`
2. Try `adt smart suggest`
3. Learn basic commands: read, grep, where
4. Practice with `adt batch`

### Intermediate
1. Master output formats (slim, normal, json)
2. Use context tracking
3. Learn editing commands (verify, patch)
4. Explore analysis commands (complexity, deps)

### Advanced
1. Create custom batch workflows
2. Use smart planning for complex tasks
3. Integrate with CI/CD
4. Contribute to adt

---

For more examples:
- Command Reference: COMMANDS.md
- Quick Start: QUICKSTART.md
- Main README: ../../README.md
