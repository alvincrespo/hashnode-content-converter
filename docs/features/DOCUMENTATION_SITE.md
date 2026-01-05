# Developer Documentation Implementation Plan

## Overview

Implement developer documentation for `@alvincrespo/hashnode-content-converter` using TypeDoc for API reference and manually written guides, deployed to GitHub Pages via GitHub Actions on release tags.

**Related Issue**: [#31 - Add JSDoc to Public API Exports](https://github.com/alvincrespo/hashnode-content-converter/issues/31)

## Examples to Reference

| Project | Site | Approach |
|---------|------|----------|
| [Commander.js](https://github.com/tj/commander.js) | [tj.github.io/commander.js](https://tj.github.io/commander.js/) | TypeDoc + gh-pages branch |
| [TypeDoc](https://github.com/TypeStrong/typedoc) | [typedoc.org](https://typedoc.org/) | GitHub Actions + deploy-pages |
| [TSDoc Action](https://github.com/marketplace/actions/tsdoc-action) | - | Zero-config GitHub Action |

---

## Implementation Steps

### Step 1: Install TypeDoc

Add TypeDoc as a dev dependency:

```bash
npm install --save-dev typedoc
```

**Files to modify**:
- `package.json` - add typedoc dependency and scripts

### Step 2: Create TypeDoc Configuration

Create `typedoc.json` in the project root:

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/index.ts"],
  "out": "docs-site",
  "name": "@alvincrespo/hashnode-content-converter",
  "readme": "docs/guides/README.md",
  "includeVersion": true,
  "excludePrivate": true,
  "excludeInternal": true,
  "navigationLinks": {
    "GitHub": "https://github.com/alvincrespo/hashnode-content-converter",
    "npm": "https://www.npmjs.com/package/@alvincrespo/hashnode-content-converter"
  },
  "plugin": [],
  "githubPages": true
}
```

**Files to create**:
- `typedoc.json`

### Step 3: Add npm Scripts

Add documentation scripts to `package.json`:

```json
{
  "scripts": {
    "docs": "typedoc",
    "docs:watch": "typedoc --watch",
    "docs:serve": "npx serve docs-site"
  }
}
```

**Files to modify**:
- `package.json`

### Step 4: Create Documentation Guides Structure

Create a `docs/guides/` directory with manually written guides:

```
docs/
├── guides/
│   ├── README.md           # Landing page for TypeDoc (overview + quick links)
│   ├── getting-started.md  # Installation and basic usage
│   ├── cli-usage.md        # CLI command reference
│   ├── programmatic-api.md # Using the converter programmatically
│   └── advanced.md         # Custom processors, event handling
```

**Files to create**:
- `docs/guides/README.md`
- `docs/guides/getting-started.md`
- `docs/guides/cli-usage.md`
- `docs/guides/programmatic-api.md`
- `docs/guides/advanced.md`

### Step 5: Enhance JSDoc Comments (Issue #31)

Add/enhance JSDoc comments to all public exports in:

- `src/index.ts` - Package documentation (already has good JSDoc)
- `src/converter.ts` - Converter class with all public methods
- `src/types/*.ts` - All interfaces and type definitions
- `src/services/*.ts` - ImageDownloader, FileWriter, Logger
- `src/processors/*.ts` - PostParser, MarkdownTransformer, ImageProcessor, FrontmatterGenerator

Follow JSDoc best practices from Issue #31:
- Include `@example` for non-obvious usage
- Use `@default` for optional parameters
- Add `@throws` for error conditions
- Keep descriptions concise

**Files to modify**:
- `src/converter.ts`
- `src/types/hashnode-schema.ts`
- `src/types/converter-options.ts`
- `src/types/conversion-result.ts`
- `src/types/converter-events.ts`
- `src/types/image-processor.ts`
- `src/services/image-downloader.ts`
- `src/services/file-writer.ts`
- `src/services/logger.ts`
- `src/processors/post-parser.ts`
- `src/processors/markdown-transformer.ts`
- `src/processors/image-processor.ts`
- `src/processors/frontmatter-generator.ts`

### Step 6: Create GitHub Actions Workflow

Create `.github/workflows/docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:  # Allow manual trigger

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Generate documentation
        run: npm run docs

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Files to create**:
- `.github/workflows/docs.yml`

### Step 7: Update .gitignore

Add the generated documentation directory to `.gitignore`:

```
# Generated documentation
docs-site/
```

**Files to modify**:
- `.gitignore`

### Step 8: Enable GitHub Pages in Repository Settings

After merging, manually configure in GitHub:

1. Go to repository Settings > Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. The workflow will automatically deploy on the next release tag

### Step 9: Update README with Documentation Link

Add a link to the documentation site in the README:

```markdown
## Documentation

Full API documentation is available at: https://alvincrespo.github.io/hashnode-content-converter/
```

**Files to modify**:
- `README.md`

---

## Final Directory Structure

```
hashnode-content-converter/
├── .github/
│   └── workflows/
│       ├── ci.yml          # existing
│       ├── release.yml     # existing
│       └── docs.yml        # NEW
├── docs/
│   ├── guides/             # NEW - manually written guides
│   │   ├── README.md
│   │   ├── getting-started.md
│   │   ├── cli-usage.md
│   │   ├── programmatic-api.md
│   │   └── advanced.md
│   └── ... (existing docs)
├── docs-site/              # Generated by TypeDoc (gitignored)
├── src/                    # Enhanced JSDoc comments
├── typedoc.json            # NEW
├── package.json            # Updated scripts
└── README.md               # Updated with docs link
```

---

## Documentation URL

After deployment, documentation will be available at:
**https://alvincrespo.github.io/hashnode-content-converter/**

---

## Validation Checklist

- [ ] TypeDoc generates documentation without errors
- [ ] All public classes/methods have JSDoc
- [ ] All interfaces have JSDoc with property descriptions
- [ ] At least one `@example` per major class
- [ ] IDE shows helpful tooltips when hovering over exports
- [ ] GitHub Pages workflow runs successfully on tag push
- [ ] Documentation site is accessible at the GitHub Pages URL
- [ ] Navigation works correctly (no 404s on subpages)
