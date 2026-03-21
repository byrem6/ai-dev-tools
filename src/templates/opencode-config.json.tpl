{
  "systemPrompt": "You have access to the `adt` CLI tool (v{{ADT_VERSION}} with 94 commands across 27 categories installed globally as `@byrem6/ai-dev-tools`).\n\nUSE `adt` FOR ALL FILE, SEARCH, AND GIT OPERATIONS.\nNEVER use cat, grep, find, sed, or git directly.\n\nSESSION START — always run these commands:\n  adt resume --fmt slim\n  adt context get --fmt slim\n  adt context history --fmt slim\n  adt smart suggest\n\nFORMAT RULES:\n  --fmt slim   → location, boolean, lists (5-7× token savings)\n  --fmt normal → reading, analysis\n  --fmt json   → programmatic/nested only\n\nAI-POWERED FEATURES (v2.0):\n  adt smart suggest                    # Get AI recommendations\n  adt smart analyze                    # Deep codebase analysis\n  adt smart plan \"<goal>\"              # Create implementation plan\n  adt smart review                     # Review changes before commit\n  adt context track \"<decision>\" --reason \"<why>\"\n  adt context history                  # View past decisions\n  adt context suggest                  # AI suggestions based on context\n  adt quick analyze                     # Quick analysis\n  adt quick search \"<query>\"            # Quick search\n  adt batch --file <commands.txt> --parallel\n\nKEY COMMANDS:\n  adt where <symbol> --fmt slim\n  adt grep \"<pattern>\" src/ --fmt slim\n  adt search \"<pattern>\" src/ --fmt normal\n  adt read <file> --start N --lines 100 --fmt normal\n  adt read <file> --fn <functionName> --fmt normal\n  adt outline <file> --fmt slim\n  adt verify <file> --lines N:M --contains \"<text>\" --fmt slim\n  adt patch <file> --replace N:M --with \"...\" --fmt slim\n  adt git-status --fmt slim\n  adt git-commit --message \"<msg>\" --fmt slim\n\nAPI & ARCHITECTURE (v2.0):\n  adt api-list [path]                    # List API endpoints\n  adt api-find \"<pattern>\" [path]        # Find endpoints\n  adt api-routes [path]                  # Show routes\n  adt arch-rules list                    # List architecture rules\n  adt arch-check [path]                  # Check compliance\n\nSECURITY & TESTING (v2.0):\n  adt security [path] --severity high    # Security scan\n  adt risk [path] --threshold high       # Risk analysis\n  adt contract-check <class> [path]      # Interface check\n  adt coverage-report [path]             # Test coverage\n\nGENERATION & INTEGRATION (v2.0):\n  adt generate-service <name>            # Generate service\n  adt generate-model <name>              # Generate model\n  adt generate-test <name>               # Generate test\n  adt integration-list [path]            # List integrations\n  adt migrate-scan <package> [path]      # Scan deprecated APIs\n  adt flow-trace <symbol> [path]         # Trace data flow\n\nTASKS & SESSIONS (v2.0):\n  adt task create \"<title>\"              # Create task\n  adt task list --status open            # List tasks\n  adt session show                       # Session state\n  adt session diff                       # Session diff\n  adt session undo                       # Undo action\n\nQUALITY & ANALYSIS:\n  adt health --verbose\n  adt complexity src/ --top 10\n  adt duplicate src/ --lines 5\n  adt unused src/ --check both\n  adt lint src/ --fmt slim\n  adt test --fmt slim\n  adt typecheck src/ --fmt slim\n\nDOCUMENTATION:\n  adt changelog --version 2.0.0\n  adt toc <file>\n  adt split <file> --lines 400\n\nWORKSPACE & CONFIG:\n  adt workspace-list [path]              # List packages\n  adt config-flags [path]                # List flags\n  adt history-file <file>                # File history\n\nPATTERNS & TAGS:\n  adt pattern match \"<regex>\" [path]     # Match patterns\n  adt tag add \"<note>\" <file> --line N   # Tag code\n\nBEFORE EVERY EDIT:\n  1. adt verify → confirm correct lines\n  2. adt patch --dry-run → preview\n  3. adt patch → apply",
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
        "adt git-diff --staged",
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
    },
    {
      "name": "API Development Workflow (v2.0)",
      "commands": [
        "adt api-list src/",
        "adt api-find \"<pattern>\" src/",
        "adt arch-check src/",
        "adt contract-check <class> src/",
        "adt smart review"
      ]
    },
    {
      "name": "Security Check Workflow (v2.0)",
      "commands": [
        "adt security src/ --severity high",
        "adt risk src/ --threshold high",
        "adt complexity src/ --top 20",
        "adt health"
      ]
    }
  ]
}
