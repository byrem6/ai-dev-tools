# AI Dev Tools (adt) - Implementation Todo List

## Phase 1: Core Infrastructure

### 1.1 Project Setup
- [x] Initialize npm project with package.json
- [x] Configure TypeScript (tsconfig.json)
- [x] Set up project directory structure
- [ ] Configure ESLint and Prettier
- [ ] Set up Jest for testing
- [x] Create build scripts

### 1.2 Core Framework
- [x] Create CLI argument parser (cli.ts)
- [x] Implement base command class (command.ts)
- [x] Implement output format system (format.ts)
  - [x] slim formatter
  - [x] normal formatter
  - [x] json formatter
- [x] Implement error system (error.ts)
  - [x] Error codes
  - [x] Error messages
  - [x] Actionable tips
- [x] Implement configuration management (config.ts)
- [x] Implement session management (session.ts)

### 1.3 Utilities
- [x] File utilities (utils/file.ts)
- [x] Hash utilities (utils/hash.ts)
- [x] Git utilities (utils/git.ts)
- [x] AST utilities (parsers/typescript.ts - implemented as parser)
- [x] Token estimation (utils/token.ts)
- [x] Platform detection (utils/platform.ts)

### 1.4 Parsers
- [x] TypeScript/JavaScript AST parser (parsers/typescript.ts)
- [ ] Python parser (parsers/python.ts)
- [ ] Generic regex parser (parsers/generic.ts)
- [ ] Parser registry (parsers/index.ts)

### 1.5 Type Definitions
- [x] Core type definitions (types/index.ts)
- [x] Command types
- [x] Format types
- [x] Session types
- [x] Error types

## Phase 2: READ Group

### 2.1 read Command
- [x] Basic file reading
- [x] Line range options (--start, --end, --lines)
- [x] Context reading (--around, --context)
- [ ] Function body reading (--fn)
- [x] Metadata only mode (--info)
- [ ] Encoding detection and support
- [x] Format outputs (slim, normal, json)

### 2.2 peek Command
- [x] File metadata extraction
- [x] Import statement parsing
- [x] Skeleton generation
- [x] First lines preview
- [x] Format outputs

### 2.3 outline Command
- [x] AST-based outline extraction
- [x] Nesting depth control
- [x] Line number information
- [x] Size information
- [x] Format outputs

### 2.4 cat/head/tail Commands
- [x] cat: Full file output (via read command)
- [x] head: First N lines (via read command)
- [x] tail: Last N lines (via read command)
- [x] Format outputs

## Phase 3: SEARCH Group

### 3.1 grep Command
- [x] Pattern matching (string and regex)
- [x] File:line:col format output
- [x] Context lines support
- [x] Case insensitive option
- [x] Word boundary option
- [x] Extension filtering
- [x] Directory exclusion
- [x] Test file exclusion
- [x] Comment exclusion
- [x] Max results limiting
- [x] Format outputs (slim default)

### 3.2 where Command
- [ ] File search
- [ ] Symbol definition search
- [ ] Combined search
- [ ] Format outputs (slim default)

### 3.3 find Command
- [ ] File name pattern matching
- [ ] Extension filtering
- [ ] Content search
- [ ] Size filtering
- [ ] Date filtering
- [ ] Type filtering (file/dir/symlink)
- [ ] Empty file detection
- [ ] Duplicate file detection
- [ ] Format outputs

### 3.4 search Command
- [ ] Multi-pattern search
- [ ] AND logic
- [ ] NOT logic
- [ ] Advanced filtering
- [ ] Format outputs

### 3.5 refs Command
- [ ] Symbol reference finding
- [ ] Import detection
- [ ] Definition detection
- [ ] Usage detection
- [ ] Categorization
- [ ] Format outputs

## Phase 3: SEARCH Group

### 3.1 grep Command
- [ ] Pattern matching (string and regex)
- [ ] File:line:col format output
- [ ] Context lines support
- [ ] Case insensitive option
- [ ] Word boundary option
- [ ] Extension filtering
- [ ] Directory exclusion
- [ ] Test file exclusion
- [ ] Comment exclusion
- [ ] Max results limiting
- [ ] Format outputs (slim default)

### 3.2 where Command
- [ ] File search
- [ ] Symbol definition search
- [ ] Combined search
- [ ] Format outputs (slim default)

### 3.3 find Command
- [ ] File name pattern matching
- [ ] Extension filtering
- [ ] Content search
- [ ] Size filtering
- [ ] Date filtering
- [ ] Type filtering (file/dir/symlink)
- [ ] Empty file detection
- [ ] Duplicate file detection
- [ ] Format outputs

### 3.4 search Command
- [ ] Multi-pattern search
- [ ] AND logic
- [ ] NOT logic
- [ ] Advanced filtering
- [ ] Format outputs

### 3.5 refs Command
- [ ] Symbol reference finding
- [ ] Import detection
- [ ] Definition detection
- [ ] Usage detection
- [ ] Categorization
- [ ] Format outputs

## Phase 4: SYMBOL Group

### 4.1 symbols Command
- [x] Symbol extraction from AST
- [x] Class/method/function/interface detection
- [x] Export detection
- [x] Line number tracking
- [x] Format outputs

### 4.2 def Command
- [x] Symbol definition finding
- [x] Signature extraction
- [x] Body location
- [x] Class context
- [x] Format outputs

### 4.3 sig Command
- [x] Signature-only output
- [x] Parameter extraction
- [x] Return type extraction
- [x] Async detection
- [x] Format outputs (slim default)

### 4.4 body Command
- [x] Function body extraction
- [x] Method body extraction
- [x] Format outputs

### 4.5 callers Command
- [x] Call site detection
- [x] Caller identification
- [x] Context extraction
- [x] Format outputs

### 4.6 callees Command
- [x] Callee detection
- [x] Internal/external classification
- [x] Format outputs

## Phase 5: EDIT Group

### 5.1 verify Command
- [x] Line content validation
- [x] Exact match mode
- [x] Contains mode
- [x] Regex match mode
- [x] Format outputs (slim default)

### 5.2 patch Command
- [x] Line replacement
- [x] Line insertion (before/after)
- [x] Line deletion
- [x] Backup creation
- [x] Checksum generation
- [x] Diff output
- [x] Dry-run mode
- [x] Format outputs

### 5.3 replace Command
- [x] String replacement
- [x] Regex replacement
- [x] Multi-file replacement
- [x] Dry-run mode
- [x] Format outputs

### 5.4 create Command
- [x] File creation
- [x] Directory creation
- [x] Template support (8 templates)
- [x] Format outputs

### 5.5 delete Command
- [x] Safe file deletion
- [x] Backup before delete
- [x] Format outputs

### 5.6 move Command
- [x] File/directory moving
- [x] Import path updating
- [x] Format outputs

### 5.7 copy Command
- [x] File/directory copying
- [x] Format outputs

### 5.8 rename Command
- [x] Symbol renaming
- [x] File renaming
- [x] Project-wide updates
- [x] Import path updates
- [x] Dry-run mode
- [x] Format outputs

## Phase 6: MAP Group

### 6.1 map Command
- [x] Project structure analysis
- [x] Technology stack detection
- [x] Format outputs

### 6.2 tree Command
- [x] Directory tree visualization
- [x] Depth control
- [x] Extension filtering
- [x] Size/line information
- [x] Gitignore respect
- [x] Format outputs

### 6.3 deps Command
- [x] Import/require extraction
- [x] Dependency graph
- [x] Internal/external classification
- [x] Reverse dependency lookup
- [x] Circular dependency detection
- [x] Format outputs

### 6.4 impact Command
- [x] Change impact analysis
- [x] Direct dependents
- [x] Indirect dependents
- [x] Test coverage impact
- [x] Risk scoring
- [x] Format outputs

### 6.5 stats Command
- [x] Line counting
- [x] Code/comment/blank breakdown
- [x] Extension breakdown
- [x] Largest files
- [x] Complexity metrics
- [x] Format outputs

## Phase 7: GIT Group

### 7.1 git status
- [x] Branch information
- [x] Staged files
- [x] Unstaged files
- [x] Untracked files
- [x] Conflict detection
- [x] Format outputs

### 7.2 git log
- [x] Commit listing
- [x] Author filtering
- [x] Date filtering
- [x] File filtering
- [x] Message searching
- [x] Format outputs

### 7.3 git diff
- [x] Unstaged diff
- [x] Staged diff
- [x] Commit comparison
- [x] Summary mode
- [x] Format outputs

### 7.4 git blame
- [x] Line-by-line blame
- [x] Author tracking
- [x] Date tracking
- [x] Format outputs

### 7.5 git branch
- [ ] Branch listing
- [ ] Branch creation
- [ ] Branch deletion
- [ ] Branch switching
- [ ] Branch renaming
- [ ] Current branch info
- [ ] Format outputs

### 7.6 git commit
- [ ] Commit creation
- [ ] Message handling
- [ ] Amend support
- [ ] Format outputs

### 7.7 git stash
- [ ] Stash save
- [ ] Stash list
- [ ] Stash pop/apply
- [ ] Stash drop
- [ ] Stash show
- [ ] Stash clear
- [ ] Format outputs

### 7.8 git reset
- [ ] Soft reset
- [ ] Mixed reset
- [ ] Hard reset
- [ ] File unstage
- [ ] Format outputs

### 7.9 git merge
- [ ] Branch merging
- [ ] Conflict detection
- [ ] Dry-run mode
- [ ] Format outputs

### 7.10 git tag
- [ ] Tag listing
- [ ] Tag creation
- [ ] Tag deletion
- [ ] Tag pushing
- [ ] Format outputs

### 7.11 git cherry-pick
- [ ] Cherry-pick operation
- [ ] Format outputs

### 7.5 git branch
- [ ] Branch listing
- [ ] Branch creation
- [ ] Branch deletion
- [ ] Branch switching
- [ ] Branch renaming
- [ ] Current branch info
- [ ] Format outputs

### 7.6 git commit
- [ ] Commit creation
- [ ] Message handling
- [ ] Amend support
- [ ] Format outputs

### 7.7 git stash
- [ ] Stash save
- [ ] Stash list
- [ ] Stash pop/apply
- [ ] Stash drop
- [ ] Stash show
- [ ] Stash clear
- [ ] Format outputs

### 7.8 git reset
- [ ] Soft reset
- [ ] Mixed reset
- [ ] Hard reset
- [ ] File unstage
- [ ] Format outputs

### 7.9 git merge
- [ ] Branch merging
- [ ] Conflict detection
- [ ] Dry-run mode
- [ ] Format outputs

### 7.10 git tag
- [ ] Tag listing
- [ ] Tag creation
- [ ] Tag deletion
- [ ] Tag pushing
- [ ] Format outputs

### 7.11 git cherry-pick
- [ ] Cherry-pick operation
- [ ] Format outputs

## Phase 8: SHELL Group

### 8.1 exec Command
- [x] Command execution
- [x] Shell detection (bash/PowerShell/cmd)
- [x] Working directory support
- [x] Environment variable support
- [x] Timeout handling
- [x] Exit code capture
- [x] Stdout/stderr capture
- [x] Format outputs

### 8.2 run Command
- [ ] NPM script execution
- [ ] Direct file execution
- [ ] Argument passing
- [ ] Format outputs

### 8.3 env Command
- [ ] Environment variable listing
- [ ] Variable retrieval
- [ ] Variable checking
- [ ] .env file loading
- [ ] .env file comparison
- [ ] Variable setting
- [ ] Format outputs

### 8.4 which Command
- [ ] Command location finding
- [ ] Version detection
- [ ] Multiple commands
- [ ] Format outputs

### 8.5 platform Command
- [x] OS detection
- [x] Shell detection
- [x] Tool versions (Node, npm, git, etc.)
- [x] Path information
- [x] CI/WSL detection
- [x] Format outputs

## Phase 9: QUALITY Group

### 9.1 lint Command
- [x] Linter detection (ESLint, pylint, etc.)
- [x] Linter execution
- [x] Output normalization
- [x] Fix support
- [x] Format outputs

### 9.2 test Command
- [x] Test runner detection (Jest, pytest, etc.)
- [x] Test execution
- [x] Output normalization
- [x] Coverage support
- [x] Format outputs

### 9.3 typecheck Command
- [ ] TypeScript type checking
- [ ] Error formatting
- [ ] Format outputs

### 9.4 format Command
- [ ] Formatter detection (Prettier, black, etc.)
- [ ] Format execution
- [ ] Check-only mode
- [ ] Format outputs

## Phase 10: SESSION Group

### 10.1 session Command
- [ ] Session display
- [ ] Read history
- [ ] Write history
- [ ] Token summary
- [ ] Session clearing
- [ ] Format outputs

### 10.2 diff Command
- [ ] File diff display
- [ ] Checksum comparison
- [ ] Format outputs

### 10.3 undo Command
- [ ] Backup restoration
- [ ] Format outputs

### 10.4 checkpoint Command
- [ ] Snapshot creation
- [ ] Snapshot restoration
- [ ] Snapshot listing
- [ ] Snapshot diff
- [ ] Format outputs

## Phase 11: UTILITY Group

### 11.1 info Command
- [ ] File metadata
- [ ] Encoding detection
- [ ] Line ending detection
- [ ] BOM detection
- [ ] Binary detection
- [ ] Format outputs

### 11.2 safe Command
- [ ] Binary file check
- [ ] Readability check
- [ ] Format outputs

### 11.3 hash Command
- [ ] SHA256 calculation
- [ ] MD5 calculation
- [ ] SHA1 calculation
- [ ] Recursive hashing
- [ ] Format outputs

### 11.4 watch Command
- [ ] File watching
- [ ] Command execution on change
- [ ] Extension filtering
- [ ] Format outputs

## Phase 12: CONTEXT Group

### 12.1 context Command
- [ ] Context setting
- [ ] Context retrieval
- [ ] Decision logging
- [ ] Convention tracking
- [ ] Context clearing
- [ ] Format outputs

## Phase 13: PATTERN Group

### 13.1 pattern Command
- [ ] Pattern finding
- [ ] Similarity detection
- [ ] Pattern listing
- [ ] AST analysis
- [ ] Frequency statistics
- [ ] Format outputs

## Phase 14: TASK Group

### 14.1 task Command
- [ ] Task creation
- [ ] Task listing
- [ ] Task status
- [ ] Step management
- [ ] Task completion
- [ ] Task context
- [ ] Format outputs

## Phase 15: GENERATE Group

### 15.1 generate Command
- [ ] Service generation
- [ ] Model generation
- [ ] Controller generation
- [ ] Test generation
- [ ] Repository generation
- [ ] Middleware generation
- [ ] Template learning
- [ ] Format outputs

## Phase 16: API Group

### 16.1 api Command
- [ ] API endpoint listing
- [ ] Endpoint finding
- [ ] Framework detection (Express, Fastify, NestJS)
- [ ] Route extraction
- [ ] Format outputs

### 16.2 package Command
- [ ] Package usage tracking
- [ ] Usage counting
- [ ] File listing
- [ ] Format outputs

## Phase 17: RISK & COVERAGE Group

### 17.1 risk Command
- [ ] Risk scoring
- [ ] Churn analysis
- [ ] Complexity analysis
- [ ] Coverage analysis
- [ ] Hotspot detection
- [ ] Format outputs

### 17.2 coverage Command
- [ ] Coverage report
- [ ] File coverage
- [ ] Untested code
- [ ] Format outputs

## Phase 18: SECURITY Group

### 18.1 security Command
- [ ] Security scanning
- [ ] Secret detection
- [ ] CVE checking
- [ ] Vulnerability patterns
- [ ] Format outputs

## Phase 19: HISTORY Group

### 19.1 history Command
- [ ] File history
- [ ] Function history
- [ ] Line history (why)
- [ ] Churn analysis
- [ ] Author tracking
- [ ] Format outputs

## Phase 20: COMPLEXITY & DEAD CODE Group

### 20.1 complexity Command
- [ ] Cyclomatic complexity
- [ ] Cognitive complexity
- [ ] Hotspot detection
- [ ] Debt calculation
- [ ] Format outputs

### 20.2 dead code Command
- [ ] Dead function detection
- [ ] Dead file detection
- [ ] Unused export detection
- [ ] Format outputs

### 20.3 duplicate code Command
- [ ] Duplicate detection
- [ ] Similarity calculation
- [ ] Format outputs

## Phase 21: FLOW & CONTRACT Group

### 21.1 flow Command
- [ ] Data flow tracing
- [ ] DB flow analysis
- [ ] Format outputs

### 21.2 contract Command
- [ ] Contract checking
- [ ] Interface implementation
- [ ] Missing method detection
- [ ] Format outputs

## Phase 22: ARCHITECTURE Group

### 22.1 arch Command
- [ ] Rule definition
- [ ] Rule checking
- [ ] Violation detection
- [ ] Rule management
- [ ] Format outputs

## Phase 23: WORKSPACE Group

### 23.1 workspace Command
- [ ] Package listing
- [ ] Dependency graph
- [ ] Affected package detection
- [ ] Command execution
- [ ] Format outputs

## Phase 24: DOCUMENTATION Group

### 24.1 doc Command
- [ ] Coverage analysis
- [ ] Missing documentation
- [ ] Stale documentation
- [ ] Format outputs

## Phase 25: CONFIGURATION Group

### 25.1 config Command
- [ ] Feature flag detection
- [ ] Config value reading
- [ ] Config diffing
- [ ] Format outputs

## Phase 26: TAG Group

### 26.1 tag Command
- [ ] Tag addition
- [ ] Tag search
- [ ] Tag listing
- [ ] Tag removal
- [ ] Format outputs

## Phase 27: INTEGRATION Group

### 27.1 integration Command
- [ ] HTTP client detection
- [ ] External API detection
- [ ] DB connection detection
- [ ] Message queue detection
- [ ] Format outputs

## Phase 28: MIGRATION Group

### 28.1 migrate Command
- [ ] Migration planning
- [ ] Deprecated API scanning
- [ ] Codemod application
- [ ] Format outputs

## Phase 29: DEPENDENCY Extensions

### 29.1 deps Extended
- [ ] Outdated detection
- [ ] Vulnerable detection
- [ ] Usage analysis
- [ ] Format outputs

## Phase 30: Testing & Documentation

### 30.2 Documentation
- [ ] CLI help text
- [ ] Command documentation
- [ ] API documentation
- [ ] Usage examples

## Phase 31: Deployment

### 31.1 Build & Release
- [ ] Production build
- [ ] npm package preparation
- [ ] CI/CD setup
- [ ] Release automation

### 31.2 Distribution
- [ ] npm publish
- [ ] Binary builds (optional)
- [ ] Installation testing
