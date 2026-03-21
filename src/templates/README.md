# Templates Directory

This directory contains template files for various AI tools and documentation.

## Files

### AI Tool Templates
- `CLAUDE.md.tpl` - Claude AI instructions template
- `copilot-instructions.md.tpl` - GitHub Copilot instructions template
- `cursorrules.tpl` - Cursor IDE rules template
- `opencode-config.json.tpl` - OpenCode configuration template

### Command Templates (commands/)
- `COMMANDS.md` - Complete command reference (94 commands across 27 categories)
- `QUICKSTART.md` - Quick reference card
- `EXAMPLES.md` - Real-world usage examples
- `README.txt` - Template information

## Usage

Templates are used by the `adt init` command to generate configuration files for AI tools.

```bash
# Generate all configs
adt init

# Generate specific tool config
adt init --tools claude
adt init --tools cursor
```

## Command Categories (94 Total)

1. **READ** (3 commands) - Smart file reading
   - read, peek, outline

2. **SEARCH** (5 commands) - Pattern search & discovery
   - grep, find, where, search, refs

3. **SYMBOL** (6 commands) - Symbol navigation
   - symbols, sig, def, body, callers, callees

4. **EDIT** (8 commands) - Safe editing operations
   - verify, patch, replace, create, delete, move, copy, rename

5. **MAP** (5 commands) - Project structure & analysis
   - map, tree, stats, deps, impact

6. **GIT** (11 commands) - Git operations
   - git-status, git-log, git-diff, git-blame, git-branch, git-commit, git-stash, git-reset, git-merge, git-tag, git-cherry-pick

7. **SHELL** (5 commands) - Shell & system commands
   - exec, platform, run, env, which

8. **QUALITY** (4 commands) - Code quality checks
   - lint, test, typecheck, format

9. **AI** (4 commands) - AI-powered features
   - ai, smart, quick, batch

10. **CONTEXT** (1 command) - Decision tracking
    - context

11. **UTILITY** (8 commands) - Developer utilities
    - info, files, recent, duplicate, unused, health, changelog, safe

12. **DOCUMENTATION** (3 commands) - Documentation tools
    - doc, split, toc

13. **ARCHITECTURE** (3 commands) - Architecture rules
    - arch-rules, arch-check, arch-rule-add

14. **PATTERN** (2 commands) - Code patterns
    - pattern, tag

15. **SECURITY** (2 commands) - Security analysis
    - security, risk

16. **TESTING** (1 command) - Test coverage
    - coverage-report

17. **GENERATION** (3 commands) - Code generation
    - generate-service, generate-model, generate-test

18. **API** (3 commands) - API endpoints
    - api-list, api-find, api-routes

19. **INTEGRATION** (1 command) - External integrations
    - integration-list

20. **MIGRATION** (1 command) - Migration tools
    - migrate-scan

21. **FLOW** (1 command) - Data flow
    - flow-trace

22. **CONTRACT** (1 command) - Interface contracts
    - contract-check

23. **CONFIGURATION** (1 command) - Configuration
    - config-flags

24. **WORKSPACE** (1 command) - Monorepo workspace
    - workspace-list

25. **HISTORY** (1 command) - File history
    - history-file

26. **SESSION** (2 commands) - Session management
    - session, resume

27. **TASK** (1 command) - Task management
    - task

28. **SYSTEM** (2 commands) - System setup & diagnostics
    - init, doctor

## Adding New Templates

To add a new template:

1. Create template file in `src/templates/`
2. Add `.tpl` extension
3. Update `src/commands/init/init.ts` to handle new template
4. Rebuild: `npm run build`

Template variables:
- `{{PROJECT_NAME}}` - Project name from package.json
- `{{AUTHOR}}` - Author name from package.json
- `{{DATE}}` - Current date
- `{{VERSION}}` - Current adt version
- `{{ADT_VERSION}}` - Current adt version

## Command Documentation

All 94 commands are fully documented in `commands/COMMANDS.md` with:
- Descriptions
- Usage syntax
- Options
- Examples
- Output formats

## Version Information

- **adt version**: 2.0.0
- **Total commands**: 94
- **Categories**: 27
- **Last updated**: 2025-03-21
