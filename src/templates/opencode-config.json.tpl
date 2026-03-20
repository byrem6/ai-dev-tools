{
  "systemPrompt": "You have access to the `adt` CLI tool (globally installed as `@byrem6/ai-dev-tools`).\n\nUSE `adt` FOR ALL FILE, SEARCH, AND GIT OPERATIONS.\nNEVER use cat, grep, find, sed, or git directly.\n\nSESSION START — always run:\n  adt resume --fmt slim\n  adt context get --fmt slim\n\nFORMAT RULES:\n  --fmt slim   → location, boolean, lists\n  --fmt normal → reading, analysis\n  --fmt json   → programmatic/nested only\n\nKEY COMMANDS:\n  adt where <symbol> --fmt slim\n  adt grep \"<pattern>\" src/ --fmt slim\n  adt read <file> --start N --lines 100 --fmt normal\n  adt read <file> --start N --lines 100 --smart --max-tokens 5000\n  adt outline <file> --fmt slim\n  adt verify <file> --lines N:M --contains \"<text>\" --fmt slim\n  adt patch <file> --replace N:M --with \"...\" --fmt slim\n  adt git status --fmt slim\n  adt git commit --message \"<msg>\" --fmt slim\n  adt lint src/ --fmt slim\n  adt test --fmt slim\n  adt typecheck src/ --fmt slim\n\nDOCUMENTATION & PATTERNS:\n  adt split <file> --lines 400\n  adt toc <file> --auto-generate\n  adt pattern find <file> --pattern \"###\" --fmt slim\n  adt pattern duplicate <file> --threshold 0.8\n  adt tag add <file> --tag \"essential\" --line 1\n  adt complexity <file> --by-section\n  adt doc coverage <file>\n\nBEFORE EVERY EDIT:\n  1. adt verify → confirm correct lines\n  2. adt patch --dry-run → preview\n  3. adt patch → apply\n\nFILE SIZE STRATEGY:\n  <200 lines  → adt read directly\n  200-500     → adt peek then targeted read\n  >500 lines  → adt outline then targeted read",
  "tools": {
    "shell": {
      "enabled": true,
      "allowedCommands": ["adt"]
    }
  }
}
