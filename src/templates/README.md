# Templates Directory

This directory contains template files for various AI tools and documentation.

## Files

### AI Tool Templates
- `CLAUDE.md.tpl` - Claude AI instructions template
- `copilot-instructions.md.tpl` - GitHub Copilot instructions template
- `cursorrules.tpl` - Cursor IDE rules template
- `opencode-config.json.tpl` - OpenCode configuration template

### Command Templates (commands/)
- `COMMANDS.md` - Complete command reference (60+ commands)
- `QUICKSTART.md` - Quick reference card
- `EXAMPLES.md` - Real-world usage examples (16 scenarios)

## Usage

Templates are used by the `adt init` command to generate configuration files for AI tools.

```bash
# Generate all configs
adt init

# Generate specific tool config
adt init --tools claude
adt init --tools cursor
```

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
