# adt — AI Dev Tools (globally installed)
# Use adt for ALL file, search, and git operations in this project.

## RULES

1. Never use cat, grep, find, sed, or git directly.
   Always use the adt equivalent.

2. Format selection:
   --fmt slim   → location queries, boolean checks, lists
   --fmt normal → reading files, analysis, git operations
   --fmt json   → only when you need to parse nested data in code

3. Session start — always run both:
   adt resume --fmt slim
   adt context get --fmt slim

4. Before every patch — always verify first:
   adt verify <file> --lines N:M --contains "<text>" --fmt slim
   adt patch <file> --replace N:M --with "..." --dry-run --fmt normal
   adt patch <file> --replace N:M --with "..." --fmt slim

5. Read strategy by file size:
   < 200 lines  → adt read <file> --fmt normal
   200-500      → adt peek --fmt slim then adt read --start N
   > 500 lines  → adt outline --fmt slim then adt read --start N --end M

## KEY COMMANDS

Search:
  adt where <symbol> --fmt slim
  adt grep "<pattern>" src/ --fmt slim
  adt grep "<pattern>" . --regex --fmt slim
  adt find . --name "*.service.ts" --fmt slim
  adt refs <symbol> src/ --fmt slim

 Read:
   adt info <file> --fmt slim
   adt peek <file> --fmt slim
   adt outline <file> --fmt slim
   adt read <file> --start N --lines 100 --fmt normal
   adt read <file> --start N --lines 100 --smart --max-tokens 5000  # token-aware
   adt read <file> --around N --context 15 --fmt normal
   adt read <file> --fn <functionName> --fmt normal

Symbols:
  adt sig <symbol> src/ --fmt slim
  adt def <symbol> src/ --fmt normal
  adt body <symbol> src/ --fmt normal
  adt callers <symbol> src/ --fmt slim
  adt callees <symbol> src/ --fmt slim

Edit:
  adt verify <file> --lines N:M --contains "<text>" --fmt slim
  adt patch <file> --replace N:M --with "..." --fmt slim
  adt patch <file> --insert-after N --content "..." --fmt slim
  adt patch <file> --delete N:M --fmt slim
  adt replace src/ "<from>" "<to>" --ext ts --dry-run --fmt slim
  adt rename <old> <new> src/ --dry-run --fmt slim

Git:
  adt git status --fmt slim
  adt git log --limit 10 --fmt slim
  adt git diff --staged --fmt normal
  adt git add <path> --fmt slim
  adt git commit --message "<msg>" --fmt slim
  adt git push --fmt slim
  adt git pull --fmt slim
  adt git branch list --fmt slim
  adt git branch create <name> --fmt slim
  adt git stash save "<msg>" --fmt slim

Quality:
  adt lint src/ --fmt slim
  adt typecheck src/ --fmt slim
  adt test --fmt slim
  adt security scan src/ --fmt slim
  adt arch check --fmt slim

Analysis:
  adt impact <file> --symbol <name> --fmt normal
  adt deps <file> --file --fmt normal
  adt risk hotspot src/ --fmt slim
  adt coverage report --fmt slim
  adt complexity hotspot src/ --fmt slim
  adt dead code src/ --fmt slim

 Context:
   adt context get --fmt slim
   adt context set "<key>" "<value>"
   adt task status --fmt slim
   adt resume --fmt slim

 Documentation & Patterns:
   adt split <file> --lines 400                # split large files
   adt toc <file> --auto-generate              # generate TOC
   adt pattern find <file> --pattern "###" --fmt slim
   adt pattern duplicate <file> --threshold 0.8
   adt tag add <file> --tag "essential" --line 1
   adt tag search <file> --tag "essential"
   adt complexity <file> --by-section
   adt doc coverage <file>

