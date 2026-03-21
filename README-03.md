## 🤝 AI Tool Integration

### Supported Tools

```bash
# Auto-generate configs for all tools
adt init

# Specific tools
adt init --tools claude
adt init --tools cursor
adt init --tools copilot
adt init --tools claude,cursor
```

Generated configs:
- `.claude/instructions.md`
- `.cursorrules`
- `.github/copilot-instructions.md`
- `.opencode/config.json`

---

## 📈 Performance

### Benchmarks

| Operation | Time | Tokens |
|-----------|------|--------|
| Grep (1000 files) | ~2s | ~50 (slim) |
| Complexity (100 files) | ~3s | ~60 (slim) |
| Map (large project) | ~1s | ~30 (slim) |
| Batch (10 commands) | ~0.5s | ~40 (slim) |

### System Requirements

- **Node.js**: >= 18.0.0
- **OS**: Windows, Linux, macOS
- **Memory**: 512MB minimum
- **Disk**: 50MB installed

---

## 🆚 Comparison

| Feature | adt | rg + jq | ag | grep |
|---------|-----|---------|-----|------|
| Token-efficient output | ✅ | ❌ | ❌ | ❌ |
| Multi-format output | ✅ | ❌ | ❌ | ❌ |
| Symbol navigation | ✅ | ❌ | ❌ | ❌ |
| Dependency analysis | ✅ | ❌ | ❌ | ❌ |
| Safe editing | ✅ | ❌ | ❌ | ❌ |
| Git integration | ✅ | ❌ | ❌ | ❌ |
| AI-powered features | ✅ | ❌ | ❌ | ❌ |
| Cross-platform | ✅ | ✅ | ✅ | ✅ |

---

## 📚 Documentation

- **Full Design Spec**: [README_DESIGN.md](./README_DESIGN.md)
- **v2.0 Implementation**: [ADT_V2_FINAL_REPORT.md](./ADT_V2_FINAL_REPORT.md)
- **Improvements Log**: [ADT_IMPROVEMENTS.md](./ADT_IMPROVEMENTS.md)
- **v2.0 Plan**: [ADT_V2_PLAN.md](./ADT_V2_PLAN.md)

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

```bash
# Development
git clone https://github.com/byrem6/ai-dev-tools.git
cd ai-dev-tools
npm install
npm run build
npm run validate
```

---

## 📝 Changelog

### v2.0.0 (Latest)
- ✨ New `smart` command with AI-powered suggestions
- ✨ Enhanced `context` command with history and search
- ✨ Command chaining and parallel batch execution
- 🐛 Fixed complexity command for directory paths
- ⚡ 5-7× token efficiency improvements
- 📚 Comprehensive documentation

### v1.1.0
- Initial stable release
- 60+ commands across 12 categories
- Token-efficient output system

---

## 📄 License

MIT © 2025 Ramazan Hocaoglu

[GitHub](https://github.com/byrem6/ai-dev-tools) •
[NPM](https://www.npmjs.com/package/@byrem6/ai-dev-tools) •
[Issues](https://github.com/byrem6/ai-dev-tools/issues)

---

<div align="center">

**Built with ❤️ for AI agents and developers**

⭐ Star us on GitHub — it helps!

</div>
