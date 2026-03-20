# 📦 NPM Publish Guide - AI Dev Tools

## ✅ Package Ready for Publishing!

Your package is now ready to publish to npm. Here's how to do it:

---

## 📋 Pre-Publish Checklist

### ✅ Already Done:
- ✅ package.json configured with all required fields
- ✅ README.md created with installation instructions
- ✅ LICENSE file (MIT)
- ✅ .npmignore created (excludes source files, tests)
- ✅ Build process working (`npm run build`)
- ✅ Binary entry point set (`dist/index.js`)
- ✅ Templates copied to dist/

### 🔧 Before Publishing:

1. **Update package.json metadata:**
```bash
# Update these fields in package.json:
# - author: "Your Name <email@example.com>"
# - repository.url: "https://github.com/your-username/ai-dev-tools.git"
# - bugs.url: "https://github.com/your-username/ai-dev-tools/issues"
# - homepage: "https://github.com/your-username/ai-dev-tools#readme"
```

2. **Verify the package:**
```bash
# Test dry-run to see what will be published
npm pack --dry-run

# Actually create the tarball to inspect
npm pack

# Extract and inspect
tar -xzf ai-dev-tools-1.0.0.tgz
ls package/
```

---

## 🚀 Publishing Steps

### Step 1: Create npm account (if you don't have one)
```bash
# Go to https://www.npmjs.com/signup
# Or use CLI:
npm adduser
# Follow the prompts
```

### Step 2: Login to npm
```bash
npm login
# Enter your username, password, and email (if 2FA is enabled)
```

### Step 3: Verify you're logged in
```bash
npm whoami
# Should show your username
```

### Step 4: Check package name availability
```bash
# Check if the name is taken
npm search ai-dev-tools

# Or visit: https://www.npmjs.com/package/ai-dev-tools
# If you get 404, the name is available!
```

### Step 5: Publish the package
```bash
# Option A: Public publish (recommended)
npm publish --access public

# Option B: Scoped package (if using @username/package-name)
npm publish --access public
```

---

## 📦 What Gets Published

The npm package will include:
```
ai-dev-tools-1.0.0.tgz
├── dist/                    # Compiled JavaScript
│   ├── index.js           # CLI entry point (executable)
│   ├── templates/         # Config file templates
│   ├── commands/          # All command implementations
│   ├── core/              # Core framework
│   └── utils/             # Utilities
├── README.md               # User documentation
└── LICENSE                 # MIT License
```

**Excluded** (via .npmignore):
- Source TypeScript files (*.ts)
- Test files
- node_modules/
- Development configs (.eslintrc, etc.)
- Build artifacts

---

## 🎯 After Publishing

### Users can install your package:

```bash
# Global installation (recommended for CLI)
npm install -g ai-dev-tools

# Then use it immediately
adt --help
adt doctor
```

```bash
# Or use with npx (no installation needed)
npx ai-dev-tools --help
npx ai-dev-tools doctor
```

```bash
# Local installation for projects
npm install --save-dev ai-dev-tools
# Then use via npx or node dist/index.js
```

### Verify your package is live:
```bash
# View your package on npm
open https://www.npmjs.com/package/ai-dev-tools

# Or check via CLI
npm view ai-dev-tools
npm info ai-dev-tools
```

---

## 🔄 Updating the Package

When you make changes:

```bash
# 1. Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)

# 2. Build
npm run build

# 3. Test locally
npm uninstall -g ai-dev-tools
npm install -g .
adt --help

# 4. Publish
npm publish --access public
```

---

## 🎨 Customization Options

### Change package name:
If "ai-dev-tools" is taken, try:
- `ai-dev-cli`
- `ai-toolkit`
- `dev-tools-ai`
- `@username/adt` (scoped package)

### Update package.json:
```json
{
  "name": "your-chosen-name",
  "author": "Your Name <email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/repo.git"
  },
  "bugs": {
    "url": "https://github.com/your-username/repo/issues"
  },
  "homepage": "https://github.com/your-username/repo#readme"
}
```

---

## 📊 Expected Package Size

Based on `npm pack --dry-run`:
- **Total size**: ~500KB - 1MB (compressed)
- **Files**: ~200 files (JS + d.ts + maps)
- **Download size**: Small (text-based, well-compressed)

---

## 🐛 Troubleshooting

### "Package name already taken"
```bash
# Try a different name or use scoped package
# @username/package-name
```

### "403 Forbidden" on publish
```bash
# Make sure you're logged in
npm login

# Use --access public for first publish
npm publish --access public
```

### "Cannot find module"
```bash
# Make sure build was successful
npm run build

# Check dist/index.js exists
ls -la dist/index.js
```

---

## ✅ Quick Publish Command

```bash
# All in one go!
npm run build && \
npm pack && \
npm publish --access public
```

---

## 🎉 Success!

Once published, users worldwide can:
```bash
npm install -g ai-dev-tools
adt doctor
adt init
```

**Your CLI tool is now live on npm! 🚀**
