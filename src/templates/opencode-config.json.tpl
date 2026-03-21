{
  "systemPrompt": "You have access to the `adt` CLI tool (v{{ADT_VERSION}} installed globally as `@byrem6/ai-dev-tools`).\n\nUSE `adt` FOR ALL FILE, SEARCH, AND GIT OPERATIONS.\nNEVER use cat, grep, find, sed, or git directly.\n\nSESSION START — always run these commands:\n  adt resume --fmt slim\n  adt context get --fmt slim\n  adt context history --fmt slim\n  adt smart suggest\n\nFORMAT RULES:\n  --fmt slim   → location, boolean, lists (5-7× token savings)\n  --fmt normal → reading, analysis\n  --fmt json   → programmatic/nested only\n\nAI-POWERED FEATURES (v2.0):\n  adt smart suggest                    # Get AI recommendations\n  adt smart analyze                    # Deep codebase analysis\n  adt smart plan \"<goal>\"              # Create implementation plan\n  adt smart review                     # Review changes before commit\n  adt context track \"<decision>\" --reason \"<why>\"\n  adt context history                  # View past decisions\n  adt context suggest                  # AI suggestions based on context\n  adt batch --file <commands.txt> --parallel\n\nKEY COMMANDS:\n  adt where <symbol> --fmt slim\n  adt grep \"<pattern>\" src/ --fmt slim\n  adt search \"<pattern>\" src/ --fmt normal\n  adt read <file> --start N --lines 100 --fmt normal\n  adt read <file> --fn <functionName> --fmt normal\n  adt outline <file> --fmt slim\n  adt verify <file> --lines N:M --contains \"<text>\" --fmt slim\n  adt patch <file> --replace N:M --with \"...\" --fmt slim\n  adt git status --fmt slim\n  adt git commit --message \"<msg>\" --fmt slim\n\nQUALITY & ANALYSIS:\n  adt health --verbose\n  adt complexity src/ --top 10\n  adt duplicate src/ --lines 5\n  adt unused src/ --check both\n  adt lint src/ --fmt slim\n  adt test --fmt slim\n  adt typecheck src/ --fmt slim\n\nDOCUMENTATION:\n  adt changelog --version 2.0.0\n  adt toc <file>\n  adt split <file> --lines 400\n\nBEFORE EVERY EDIT:\n  1. adt verify → confirm correct lines\n  2. adt patch --dry-run → preview\n  3. adt patch → apply\n\nTYPICAL WORKFLOW:\n  1. Session start: adt resume + adt context get + adt smart suggest\n  2. Track decisions: adt context track \"decision\" --reason \"why\"\n  3. Get suggestions: adt smart suggest\n  4. Plan work: adt smart plan \"goal\"\n  5. Execute efficiently: adt batch --file plan.txt --parallel\n  6. Review before commit: adt smart review\n\nFILE SIZE STRATEGY:\n  <200 lines  → adt read directly\n  200-500     → adt peek then targeted read\n  >500 lines  → adt outline then targeted read",
  "tools": {
    "shell": {
      "enabled": true,
      "allowedCommands": ["adt"]
    }
  },
  "recommendedWorkflows": [
    {
      "name": "AI Agent Session Start",
      "commands": [
        "adt resume --fmt slim",
        "adt context get --fmt slim",
        "adt smart suggest"
      ]
    },
    {
      "name": "Safe Edit Workflow",
      "commands": [
        "adt verify <file> --lines N:M --contains \"<text>\" --fmt slim",
        "adt patch <file> --replace N:M --with \"<new>\" --dry-run --fmt normal",
        "adt patch <file> --replace N:M --with \"<new>\" --fmt slim"
      ]
    },
    {
      "name": "Code Review Workflow",
      "commands": [
        "adt smart review",
        "adt git diff --staged",
        "adt health"
      ]
    },
    {
      "name": "Refactoring Workflow",
      "commands": [
        "adt context track \"Refactoring X\" --reason \"Why\"",
        "adt smart plan \"refactor X\"",
        "adt complexity src/ --top 10",
        "adt batch --file refactor.txt --parallel",
        "adt smart review"
      ]
    }
  ]
}
