# AI Dev Tools (adt) - Complete Command Reference

Version: 2.0.0
Total Commands: 94
Categories: 12

## QUICK REFERENCE

### Most Used Commands
- read          - Smart file reading
- grep          - Pattern search
- where         - Find symbols
- patch         - Safe line editing
- smart         - AI suggestions
- context       - Decision tracking
- batch         - Command automation
- complexity    - Code complexity

---

## COMMAND CATEGORIES

### 1. READ - File Reading & Navigation

Commands: read, peek, outline

#### read
Description: Smart file reader with multiple modes
Usage: adt read <file> [options]
Options:
  --start N           Start line number (1-indexed)
  --lines N           Number of lines to read
  --around N          Read N lines around specific line
  --context N         Same as --around
  --fn <name>         Read function by name
  --head N            Read first N lines
  --tail N            Read last N lines
  --fmt slim|normal|json  Output format

Examples:
  adt read src/app.ts --start 100 --lines 50
  adt read src/app.ts --around 150 --context 10
  adt read src/app.ts --fn getUserById
  adt read src/app.ts --head 20 --fmt slim

Output formats:
  slim: Line numbers + content (token-optimized)
  normal: Line numbers + metadata
  json: Full structured data

#### peek
Description: Quick file overview with metadata
Usage: adt peek <file> [options]

Examples:
  adt peek src/components/Header.ts
  adt peek src/utils/helpers.ts --fmt slim

Output:
  File type, size, line count, encoding, language

#### outline
Description: File structure table of contents
Usage: adt outline <file> [options]

Examples:
  adt outline src/services/UserService.ts
  adt outline src/app.ts --fmt slim

Output:
  Symbols with line ranges (classes, functions, methods)

---

### 2. SEARCH - Pattern Search & Discovery

Commands: grep, find, where, search, refs

#### grep
Description: Project-wide pattern search (grep-compatible)
Usage: adt grep "<pattern>" [path] [options]
Options:
  --ext <exts>        Filter by extension (ts,js,tsx,jsx)
  --regex             Enable regex mode
  --whole-word        Match whole words only
  --case-sensitive    Case sensitive search
  --max-results N     Limit results
  --fmt slim|normal|json

Examples:
  adt grep "UserService" src/
  adt grep "TODO\|FIXME" src/ --ext ts --regex
  adt grep "function.*login" src/ --regex --fmt slim
  adt grep "export class" src/ --whole-word

Output (slim):
  file:line:col:text
  src/service.ts:45:8:export class UserService

#### find
Description: Find files by name pattern
Usage: adt find "<pattern>" [path] [options]
Options:
  --ext <exts>        Filter by extension
  --type file|dir     File or directory
  --max-depth N       Maximum depth

Examples:
  adt find "*.service.ts" src/
  adt find "*.test.*" src/ --ext ts
  adt find "package.json" . --max-depth 2

#### where
Description: Locate symbol definitions and references
Usage: adt where <symbol> [path] [options]

Examples:
  adt where "UserService" src/
  adt where "AuthService.login" src/
  adt where "useEffect" src/ --fmt slim

#### refs
Description: Find all references to a symbol
Usage: adt refs <symbol> [path] [options]

Examples:
  adt refs "AuthService" src/
  adt refs "useState" src/components/
  adt refs "interface User" src/ --fmt slim

#### search
Description: Deep search with file context
Usage: adt search "<pattern>" [path] [options]

Examples:
  adt search "login" src/
  adt search "async.*fetch" src/ --regex

---

### 3. SYMBOL - Symbol Navigation

Commands: symbols, sig, def, body, callers, callees

#### symbols
Description: List all symbols in a file
Usage: adt symbols <file> [options]
Options:
  --type class|function|interface  Filter by type
  --exported              Show only exported symbols

Examples:
  adt symbols src/app.ts
  adt symbols src/app.ts --type class --fmt slim
  adt symbols src/app.ts --exported

#### sig
Description: Show function/method signature
Usage: adt sig <symbol> [path]

Examples:
  adt sig UserService.login src/
  adt sig "getUserById" src/services/

#### def
Description: Go to symbol definition
Usage: adt def <symbol> [path]

Examples:
  adt def UserService src/
  adt def AuthService src/services/

#### body
Description: Extract function body
Usage: adt body <function> [path]

Examples:
  adt body login src/services/AuthService.ts
  adt body getUserById src/

#### callers
Description: Find who calls this function/symbol
Usage: adt callers <symbol> [path]

Examples:
  adt callers UserService.login src/
  adt callers useEffect src/

#### callees
Description: Find what this function calls
Usage: adt callees <function> [path]

Examples:
  adt callees login src/services/
  adt callees processData src/utils/

---

### 4. EDIT - Safe Editing Operations

Commands: verify, patch, replace, create, delete, move, copy, rename

#### verify
Description: Verify line content before editing
Usage: adt verify <file> --lines N:M --contains "<text>"

Examples:
  adt verify src/app.ts --lines 100:105 --contains "export function"
  adt verify src/config.ts --lines 5:10 --contains "const API_URL"

#### patch
Description: Line-based file editing (safe)
Usage: adt patch <file> --replace N:M --with "<new>" [options]
Options:
  --dry-run           Show changes without applying
  --backup            Create backup before editing
  --verify            Verify before apply

Examples:
  adt patch src/app.ts --replace 100:105 --with "export async function"
  adt patch src/app.ts --replace 100:105 --with "new content" --dry-run
  adt patch src/app.ts --replace 45:50 --with "modified code" --backup

#### replace
Description: String/regex replacement
Usage: adt replace "<old>" "<new>" <file> [options]
Options:
  --regex             Use regex
  --global            Replace all occurrences
  --case-sensitive    Case sensitive

Examples:
  adt replace "console.log" "logger.info" src/app.ts
  adt replace "TODO" "FIXME" src/ --regex
  adt replace "function" "const" src/utils/*.ts --global

#### create
Description: Create new file with template
Usage: adt create <file> [options]
Options:
  --type ts|js|jsx|tsx  File type
  --template <name>  Template to use

Examples:
  adt create src/services/NewService.ts --type ts
  adt create src/components/Button.tsx --type tsx

#### delete
Description: Safe delete with backup
Usage: adt delete <file> [options]

Examples:
  adt delete old-file.ts --backup
  adt delete src/deprecated/ --backup

#### move
Description: Move file and update imports
Usage: adt move <source> <dest> [options]
Options:
  --update-imports     Update import statements

Examples:
  adt move src/old/Service.ts src/new/Service.ts
  adt move src/components/Header.ts src/ui/Header.tsx --update-imports

#### copy
Description: Copy file/directory
Usage: adt copy <source> <dest>

Examples:
  adt copy src/template.ts src/new-service.ts
  adt copy src/components/ src/backup/components/

#### rename
Description: Project-wide symbol rename
Usage: adt rename <old-name> <new-name> [options]
Options:
  --scope file|project  Rename scope

Examples:
  adt rename UserService UserServiceV2
  adt rename "interface User" "interface IUser" --scope project

---

### 5. MAP - Project Structure & Analysis

Commands: map, tree, stats, deps, impact

#### map
Description: Project structure overview
Usage: adt map [path] [options]

Examples:
  adt map src/
  adt map . --depth 2
  adt map src/components/ --fmt slim

#### tree
Description: Directory tree visualization
Usage: adt tree [path] [options]
Options:
  --depth N           Maximum depth
  --files-only        Show files only

Examples:
  adt tree src/
  adt tree . --depth 3
  adt tree src/components/ --files-only

#### stats
Description: Code statistics
Usage: adt stats [path] [options]
Options:
  --by-extension      Group by file extension

Examples:
  adt stats src/
  adt stats . --by-extension --fmt normal

#### deps
Description: Dependency analysis
Usage: adt deps <file|path> [options]
Options:
  --file              Analyze single file
  --tree              Show dependency tree

Examples:
  adt deps src/app.ts --file
  adt deps src/ --tree
  adt deps src/services/ --fmt slim

#### impact
Description: Change impact analysis
Usage: adt impact <symbol|file> [options]
Options:
  --symbol            Analyze symbol impact
  --scope <path>      Analysis scope

Examples:
  adt impact UserService --symbol
  adt impact src/app.ts
  adt impact AuthService --scope src/

---

### 6. GIT - Git Operations

Commands: git-status, git-log, git-diff, git-blame, git-branch, git-commit, git-stash, git-reset, git-merge, git-tag, git-cherry-pick

#### git-status
Description: Git working tree status
Usage: adt git status [options]
Options:
  --porcelain         Machine-readable output

Examples:
  adt git status --fmt slim
  adt git status --porcelain

#### git-log
Description: Git commit history
Usage: adt git log [options]
Options:
  --limit N           Limit commits
  --oneline           One line per commit

Examples:
  adt git log --limit 20
  adt git log --limit 10 --oneline --fmt slim

#### git-diff
Description: Git diff
Usage: adt git diff [options]
Options:
  --staged            Show staged changes
  --cached            Same as --staged

Examples:
  adt git diff --fmt normal
  adt git diff --staged --fmt slim

#### git-blame
Description: Show who modified each line
Usage: adt git blame <file>

Examples:
  adt git blame src/app.ts
  adt git blame src/utils/helpers.ts --fmt slim

#### git-branch
Description: Branch management
Usage: adt git branch <action> [options]
Actions: list, create, delete, current

Examples:
  adt git branch list
  adt git branch create feature/new-feature
  adt git branch delete old-branch

#### git-commit
Description: Create commit
Usage: adt git commit --message "<msg>"

Examples:
  adt git commit --message "feat: add user authentication"
  adt git commit -m "fix: resolve login bug"

#### git-stash
Description: Stash changes
Usage: adt git stash <action> [options]
Actions: save, pop, list, drop, clear

Examples:
  adt git stash save "work in progress"
  adt git stash pop
  adt git stash list

#### git-reset
Description: Reset git state
Usage: adt git reset [mode] [options]
Modes: soft, mixed, hard

Examples:
  adt git reset soft HEAD~1
  adt git reset hard HEAD

#### git-merge
Description: Merge branches
Usage: adt git merge <branch>

Examples:
  adt git merge feature/auth
  adt git merge develop --no-ff

#### git-tag
Description: Tag management
Usage: adt git tag <action> [options]
Actions: list, create, delete

Examples:
  adt git tag list
  adt git tag create v2.0.0
  adt git tag delete v1.0.0

#### git-cherry-pick
Description: Cherry-pick commits
Usage: adt git cherry-pick <commit-hash>

Examples:
  adt git cherry-pick abc123
  adt git cherry-pick def456 --no-commit

---

### 7. SHELL - Shell & System Commands

Commands: exec, platform, run, env, which

#### exec
Description: Execute shell command
Usage: adt exec <command> [args] [options]
Options:
  --shell <type>      Shell type (bash, powershell, cmd)
  --timeout N         Timeout in seconds

Examples:
  adt exec echo "Hello World"
  adt exec npm test --shell bash
  adt exec ls -la --shell powershell

#### platform
Description: Show platform information
Usage: adt platform [options]

Examples:
  adt platform --fmt slim
  adt platform --verbose

#### run
Description: Run script/commands
Usage: adt run <script> [args]

Examples:
  adt run build
  adt run test --watch

#### env
Description: Environment variables
Usage: adt env [options]
Options:
  --filter <pattern>  Filter variables

Examples:
  adt env --filter NODE
  adt env --filter "*PATH*"

#### which
Description: Locate command
Usage: adt which <command>

Examples:
  adt which node
  adt which git

---

### 8. QUALITY - Code Quality

Commands: lint, test, typecheck, format

#### lint
Description: Run linter
Usage: adt lint [path] [options]
Options:
  --fix               Auto-fix issues

Examples:
  adt lint src/
  adt lint src/ --fix
  adt lint src/app.ts --fmt slim

#### test
Description: Run tests
Usage: adt test [file] [options]
Options:
  --coverage          Generate coverage report
  --watch             Watch mode

Examples:
  adt test
  adt test src/app.test.ts
  adt test --coverage

#### typecheck
Description: Type checking
Usage: adt typecheck [path]

Examples:
  adt typecheck src/
  adt typecheck src/app.ts

#### format
Description: Code formatting
Usage: adt format [path] [options]
Options:
  --check             Check without modifying

Examples:
  adt format src/
  adt format src/ --check

---

### 9. AI - AI-Powered Features

Commands: ai, smart, context, quick, batch

#### ai
Description: General AI assistance
Usage: adt ai [options]
Options:
  --goal <desc>       Goal description
  --path <dir>        Target directory

Examples:
  adt ai --goal "refactor auth system"
  adt ai --path src/

#### smart
Description: AI-powered code analysis and suggestions
Usage: adt smart <action> [options]
Actions: suggest, analyze, plan, review

Examples:
  adt smart suggest
  adt smart analyze
  adt smart plan "refactor authentication"
  adt smart review

#### context
Description: Context and decision tracking
Usage: adt context <action> [options]
Actions: get, set, track, history, suggest, search, clear

Examples:
  adt context get
  adt context track "Use TypeScript strict mode" --reason "Type safety"
  adt context history
  adt context suggest
  adt context search --query "TypeScript"
  adt context clear

#### quick
Description: Quick operations and analysis
Usage: adt quick <action> [options]
Options:
  --query <text>      Search query
  --path <dir>        Target path

Examples:
  adt quick analyze
  adt quick search "UserService"
  adt quick overview --path src/

#### batch
Description: Execute multiple commands
Usage: adt batch [options]
Options:
  --file <path>       Batch file path
  --commands "<cmds>" Inline commands
  --parallel          Execute in parallel
  --continue-on-error Continue on error

Examples:
  adt batch --file commands.txt --parallel
  adt batch --commands "grep 'export' src/ | symbols src/index.ts"
  adt batch --file analysis.txt --continue-on-error

Batch file format:
  # Comments start with #
  grep "TODO" src/
  complexity src/
  health
  # Pipe operator for chaining
  where "UserService" src/ | symbols src/app.ts

---

### 10. UTILITY - Developer Utilities

Commands: info, files, recent, duplicate, unused, health, changelog, safe

#### info
Description: File/directory information
Usage: adt info <file|path>

Examples:
  adt info src/app.ts
  adt info src/

#### files
Description: List and filter files
Usage: adt files [path] [options]
Options:
  --ext <exts>        Filter by extension
  --sort field        Sort by (name, size, modified)
  --limit N           Limit results

Examples:
  adt files src/ --ext ts
  adt files . --sort size --limit 10
  adt files src/ --ext ts,tsx --sort modified

#### recent
Description: Recently modified files
Usage: adt recent [path] [options]
Options:
  --hours N           Time window in hours
  --ext <exts>        Filter by extension

Examples:
  adt recent . --hours 24
  adt recent src/ --hours 1 --ext ts

#### duplicate
Description: Find duplicate code
Usage: adt duplicate [path] [options]
Options:
  --lines N           Minimum lines
  --no-whitespace     Ignore whitespace

Examples:
  adt duplicate src/ --lines 5
  adt duplicate . --lines 3 --no-whitespace

#### unused
Description: Find unused code
Usage: adt unused [path] [options]
Options:
  --check imports|exports|both  What to check

Examples:
  adt unused src/ --check imports
  adt unused . --check both
  adt unused src/ --check exports --limit 20

#### health
Description: Project health report
Usage: adt health [options]
Options:
  --verbose           Detailed report

Examples:
  adt health
  adt health --verbose

Output:
  Overall score (0-100)
  Structure, docs, tests, deps, git, quality status
  Actionable suggestions

#### changelog
Description: Generate changelog
Usage: adt changelog [options]
Options:
  --version <ver>     Version number
  --since <ref>       Since commit/tag

Examples:
  adt changelog --version 2.0.0
  adt changelog --version 1.0.0 --since HEAD~10

#### safe
Description: Safety checks
Usage: adt safe <check> [path]

Examples:
  adt safe check src/
  adt safe verify src/app.ts

---

### 11. DOCUMENTATION - Documentation Tools

Commands: doc, split, toc

#### doc
Description: Documentation analysis and generation
Usage: adt doc <action> [options]
Actions: coverage, stale, generate

Examples:
  adt doc coverage src/
  adt doc stale README.md --days 30
  adt doc generate --all

#### split
Description: Split large documentation files
Usage: adt split <file> [options]
Options:
  --lines N           Lines per split (default: 400)
  --dry-run           Show splits without applying

Examples:
  adt split README.md --lines 500
  adt split docs/guide.md --dry-run

#### toc
Description: Generate table of contents
Usage: adt toc <file> [options]
Options:
  --max-level N       Maximum heading level (default: 3)

Examples:
  adt toc README.md
  adt toc docs/guide.md --max-level 2

---

### 12. ARCHITECTURE - Architecture Rules

Commands: arch-rules, arch-check, arch-rule-add

#### arch-rules
Description: Manage architecture rules
Usage: adt arch rules <action> [options]
Actions: list, add, remove, export

Examples:
  adt arch rules list
  adt arch rules export rules.json

#### arch-check
Description: Check architecture rule compliance
Usage: adt arch check [path] [options]

Examples:
  adt arch check src/
  adt arch check src/ --fail-on-violation

#### arch-rule-add
Description: Add new architecture rule
Usage: adt arch rule add <rule-spec>
Options:
  --type <type>       Rule type: must-not-import, can-only-import, must-have-test

Examples:
  adt arch rule add "src/**" --type must-not-import --target "src/**/test/**"
  adt arch rule add "services/**" --type must-have-test

---

### 13. PATTERN - Code Patterns

Commands: pattern, tag

#### pattern
Description: Code pattern matching and templates
Usage: adt pattern <action> [options]
Actions: match, template, save, list

Examples:
  adt pattern match "class.*Service" src/
  adt pattern save "react-component" --template <file>
  adt pattern list

#### tag
Description: Tag and annotate code
Usage: adt tag <action> [options]
Actions: add, list, search, remove

Examples:
  adt tag add "TODO" src/auth.ts --line 45
  adt tag list --sort recent
  adt tag search "TODO"

---

### 14. SECURITY - Security Analysis

Commands: security, risk

#### security
Description: Security vulnerability scan
Usage: adt security [path] [options]
Options:
  --severity level    Minimum severity (low, medium, high, critical)

Examples:
  adt security src/
  adt security src/ --severity high

#### risk
Description: Code risk analysis
Usage: adt risk [path] [options]
Options:
  --threshold level   Risk threshold (low, medium, high)

Examples:
  adt risk src/
  adt risk src/ --threshold high

---

### 15. TESTING - Test Coverage

Commands: coverage-report

#### coverage-report
Description: Generate test coverage report
Usage: adt coverage report [path] [options]

Examples:
  adt coverage report src/
  adt coverage report --format json

---

### 16. GENERATION - Code Generation

Commands: generate-service, generate-model, generate-test

#### generate-service
Description: Generate service class template
Usage: adt generate service <name> [options]
Options:
  --extends <base>    Base class to extend
  --implements <iface> Interface to implement

Examples:
  adt generate service PaymentService
  adt generate service UserService --extends BaseService
  adt generate service AuthService --implements IAuthService

#### generate-model
Description: Generate model/interface template
Usage: adt generate model <name> [options]
Options:
  --fields <spec>     Field specifications

Examples:
  adt generate model User --fields "name:string,age:number"
  adt generate model Order --fields "id:string,total:number"

#### generate-test
Description: Generate test file template
Usage: adt generate test <name> [options]

Examples:
  adt generate test UserService
  adt generate test PaymentService --dry-run

---

### 17. API - API Endpoints

Commands: api-list, api-find, api-routes

#### api-list
Description: List all HTTP API endpoints
Usage: adt api list [path] [options]

Examples:
  adt api list src/
  adt api list src/ --fmt slim

#### api-find
Description: Find API endpoints by pattern
Usage: adt api find "<pattern>" [path]

Examples:
  adt api find "user" src/
  adt api find "payment" --fmt slim

#### api-routes
Description: Show detailed routing information
Usage: adt api routes [path] [options]

Examples:
  adt api routes src/
  adt api routes src/controllers/

---

### 18. INTEGRATION - External Integrations

Commands: integration-list

#### integration-list
Description: List external API integrations
Usage: adt integration list [path] [options]

Examples:
  adt integration list src/
  adt integration list --fmt slim

---

### 19. MIGRATION - Migration Tools

Commands: migrate-scan

#### migrate-scan
Description: Scan for deprecated API usage
Usage: adt migrate scan <package> [path]

Examples:
  adt migrate scan express src/
  adt migrate scan lodash --fmt slim

---

### 20. FLOW - Data Flow

Commands: flow-trace

#### flow-trace
Description: Trace data flow through code
Usage: adt flow trace <symbol> [path]

Examples:
  adt flow trace userId src/
  adt flow trace requestData src/services/

---

### 21. CONTRACT - Interface Contracts

Commands: contract-check

#### contract-check
Description: Check interface implementation
Usage: adt contract check <class> [path]

Examples:
  adt contract check UserService src/
  adt contract check PaymentController

---

### 22. CONFIGURATION - Configuration

Commands: config-flags

#### config-flags
Description: List feature flags
Usage: adt config flags [path]

Examples:
  adt config flags src/
  adt config flags --fmt slim

---

### 23. WORKSPACE - Monorepo Workspace

Commands: workspace-list

#### workspace-list
Description: List workspace packages
Usage: adt workspace list [path]

Examples:
  adt workspace list
  adt workspace list packages/

---

### 24. HISTORY - File History

Commands: history-file

#### history-file
Description: Show file git history and churn
Usage: adt history file <file>

Examples:
  adt history file src/index.ts
  adt history file src/services/UserService.ts

---

### 25. SESSION - Session Management

Commands: session, resume

#### session
Description: Session management
Usage: adt session <action> [options]
Actions: show, diff, undo, checkpoint, restore, list, clear

Examples:
  adt session show
  adt session diff
  adt session undo
  adt session checkpoint save "before refactor"
  adt session restore <checkpoint-id>
  adt session list

#### resume
Description: Resume last session
Usage: adt resume [options]

Examples:
  adt resume
  adt resume --fmt normal

---

### 26. TASK - Task Management

Commands: task

#### task
Description: Manage development tasks
Usage: adt task <action> [options]
Actions: create, list, status, step

Examples:
  adt task create "Refactor payment module"
  adt task list --status open
  adt task step add T1 "Create interface"
  adt task status

---

### 27. SYSTEM - System & Diagnostics

Commands: init, doctor

#### init
Description: Initialize AI tool configs
Usage: adt init [options]
Options:
  --tools <list>      Tools to configure

Examples:
  adt init
  adt init --tools claude,cursor

#### doctor
Description: System diagnostics
Usage: adt doctor [options]

Examples:
  adt doctor
  adt doctor --verbose

---

## OUTPUT FORMATS

### slim
- Token-optimized (5-7× savings)
- Machine-parseable
- Best for AI agents
- Example: src/file.ts:45:8:text

### normal
- Human-readable
- Structured output
- Balanced token usage
- Example: Multi-line with metadata

### json
- Full structured data
- Programmatic use
- Nested objects
- Example: {"ok": true, "data": {...}}

---

## COMMON OPTIONS

### Global Options
  --fmt slim|normal|json  Output format
  --help               Show help
  --version            Show version

### Common Options
  --ext <exts>         File extensions (comma-separated)
  --regex              Enable regex mode
  --case-sensitive     Case sensitive
  --max-results N      Limit results
  --verbose            Verbose output
  --quiet              Quiet mode

---

## EXAMPLES

### Reading Files
  # Read specific range
  adt read src/app.ts --start 100 --lines 50

  # Read around line
  adt read src/app.ts --around 150 --context 10

  # Read function
  adt read src/app.ts --fn getUserById

### Searching
  # Pattern search
  adt grep "UserService" src/

  # Find files
  adt find "*.service.ts" src/

  # Locate symbol
  adt where "AuthService.login" src/

### Editing
  # Safe edit workflow
  adt verify src/app.ts --lines 100:105 --contains "export"
  adt patch src/app.ts --replace 100:105 --with "export async" --dry-run
  adt patch src/app.ts --replace 100:105 --with "export async"

### Analysis
  # Complexity
  adt complexity src/ --top 10

  # Health check
  adt health --verbose

  # Dependencies
  adt deps src/app.ts --file

### Git
  # Status
  adt git status --fmt slim

  # Log
  adt git log --limit 20

  # Commit
  adt git commit --message "feat: add feature"

### AI Features
  # Smart suggestions
  adt smart suggest

  # Track decisions
  adt context track "Use TypeScript strict" --reason "Type safety"

  # Plan work
  adt smart plan "refactor auth system"

  # Batch operations
  adt batch --file plan.txt --parallel

---

## TIPS & TRICKS

1. Always use --fmt slim for AI agent queries
2. Use --dry-run before applying patches
3. Chain commands with pipe in batch files
4. Use context tracking for better AI suggestions
5. Run health check before starting work
6. Use smart suggest when stuck
7. Batch operations save time and tokens
8. Verify before editing critical files
9. Use complexity analysis to identify refactoring targets
10. Track decisions for project history

---

## SEE ALSO

- Main README: ../README.md
- Design Spec: ../README_DESIGN.md
- v2.0 Report: ../ADT_V2_FINAL_REPORT.md
- GitHub: https://github.com/byrem6/ai-dev-tools
- Issues: https://github.com/byrem6/ai-dev-tools/issues

---

For more help:
  adt <command> --help
  adt --version
  https://github.com/byrem6/ai-dev-tools#readme
