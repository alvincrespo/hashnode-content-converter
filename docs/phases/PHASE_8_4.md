# Phase 8.4: Prepare npm Publication - Implementation Plan

**Issue**: [#19 - Prepare npm Publication](https://github.com/alvincrespo/hashnode-content-converter/issues/19)
**Status**: ✅ COMPLETE
**Date**: 2025-12-22
**Phase**: Phase 8 - Documentation & Publishing

---

## Overview

Prepare the `@alvincrespo/hashnode-content-converter` package for npm publication by adding missing metadata fields, creating an `.npmignore` file to reduce package size, and setting up GitHub Actions for automated releases.

**Scope**:
- IN SCOPE: package.json metadata, .npmignore, GitHub Actions release workflow, README release docs
- OUT OF SCOPE: Actual publishing (manual step after implementation)

---

## Current State

**package.json** - Missing npm metadata fields:
- repository, homepage, bugs fields

**Already Complete**:
- Keywords (7 keywords present)
- LICENSE file exists (MIT)
- prepublishOnly script configured

**Issue**: No `.npmignore` - package includes unnecessary files (~915KB unpacked vs ~50KB needed)

---

## Implementation Steps

### Step 1: Update package.json Metadata

**File**: `package.json`

**Add fields after "license"**:
```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/alvincrespo/hashnode-content-converter.git"
},
"homepage": "https://github.com/alvincrespo/hashnode-content-converter#readme",
"bugs": {
  "url": "https://github.com/alvincrespo/hashnode-content-converter/issues"
},
```

---

### Step 2: Create .npmignore

**File**: `.npmignore` (new file)

**Content**:
```
# Source files (dist/ is published)
src/

# Tests
tests/
vitest.config.ts
*.test.ts

# Development configs
tsconfig.json
tsconfig.build.json
.eslintrc*
eslint.config.*

# CI/CD and tooling
.github/
.claude/
.node-version

# Documentation (keep README, LICENSE, CHANGELOG)
docs/

# Original script (historical reference, not needed in package)
convert-hashnode.js

# Editor/IDE
.vscode/
.idea/
*.swp
*.swo

# Coverage
coverage/

# Misc
CLAUDE.md
scripts/
```

---

### Step 3: Create GitHub Actions Release Workflow

**File**: `.github/workflows/release.yml` (new file)

**Content**:
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
```

**Key features**:
- `generate_release_notes: true` - Auto-generates release notes from PRs/commits since last release
- `prerelease` detection - Tags with "alpha", "beta", or "rc" are marked as pre-releases
- `contents: write` permission - Required to create GitHub releases

---

### Step 4: Add Releasing Section to README

**File**: `README.md`

**Location**: Add after the "Development" section, before "Migrating from convert-hashnode.js"

**Content to add**:
```markdown
## Releasing

This package uses GitHub Actions for automated npm publishing.

### Automated Release (Recommended)

1. **Update version** in `package.json`:
   ```bash
   npm version patch  # or minor, major
   ```

2. **Push the tag** to trigger the release workflow:
   ```bash
   git push origin main --tags
   ```

3. The GitHub Action will automatically:
   - Run tests
   - Build the package
   - Publish to npm

### Manual Release

For manual publishing:

```bash
# Build and test
npm run prepublishOnly

# Login to npm (first time only)
npm login

# Publish
npm publish --access public
```

### Pre-release Checklist

- [ ] All tests passing (`npm test`)
- [ ] CHANGELOG.md updated with new version
- [ ] Version bumped in package.json
- [ ] No uncommitted changes
```

---

### Step 5: Verify Package Contents

**Commands to run**:
```bash
# Check what will be published
npm pack --dry-run

# Verify tarball size (should be ~50-100KB, not 900KB)
npm pack
ls -la *.tgz
```

**Expected contents**:
- dist/ (compiled JS + type definitions)
- package.json
- README.md
- LICENSE
- CHANGELOG.md

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `package.json` | Add repository, homepage, bugs fields |
| `.npmignore` | Create new file |
| `.github/workflows/release.yml` | Create new file |
| `README.md` | Add "Releasing" section |

---

## Success Criteria

- [ ] package.json has repository, homepage, bugs fields
- [ ] .npmignore excludes src/, tests/, docs/, .github/, .claude/
- [ ] `npm pack --dry-run` shows only essential files
- [ ] Package size reduced from ~915KB to ~50-100KB
- [ ] GitHub Actions release workflow created with:
  - [ ] npm publish step
  - [ ] GitHub Release with auto-generated release notes
  - [ ] Pre-release detection for alpha/beta/rc tags
- [ ] README.md has "Releasing" section with automated and manual instructions
- [ ] TRANSITION.md Step 8.4 marked complete

---

## Verification Commands

```bash
# Type check
npm run type-check

# Build
npm run build

# Test
npm test

# Verify package contents
npm pack --dry-run

# Check tarball size
npm pack && ls -la *.tgz && rm *.tgz
```

---

## Post-Implementation: Manual Steps (Not Part of This PR)

1. **Set up NPM_TOKEN secret** in GitHub repo settings
2. **Create and push tag** to trigger release:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. **Manual publish alternative**:
   ```bash
   npm login
   npm publish --access public
   ```

---

## Summary

**Phase 8.4** will prepare the package for npm publication by:
- Adding standard npm metadata (repository, homepage, bugs)
- Creating .npmignore to reduce package size by ~90%
- Setting up GitHub Actions for automated releases on tag push
- Auto-generating GitHub Release notes from PRs/commits
- Pre-release detection for alpha/beta/rc tags
- Documenting release process in README (automated + manual options)

No actual publishing occurs - that's a manual step after merge.
