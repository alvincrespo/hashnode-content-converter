# Getting Started

This guide walks you through installing and using the Hashnode Content Converter.

## Prerequisites

- Node.js >= 18.0.0
- A Hashnode export JSON file

## Exporting from Hashnode

1. Go to your Hashnode dashboard
2. Navigate to **Settings** > **Export**
3. Click **Export** to download your blog data as JSON
4. Save the file (e.g., `hashnode-export.json`)

## Installation

### Global Installation (Recommended for CLI usage)

```bash
npm install -g @alvincrespo/hashnode-content-converter
```

### Local Installation (For programmatic usage)

```bash
npm install @alvincrespo/hashnode-content-converter
```

## Basic Usage

### Using the CLI

After global installation:

```bash
hashnode-converter convert \
  --export ./hashnode-export.json \
  --output ./blog/posts
```

Or with npx:

```bash
npx @alvincrespo/hashnode-content-converter convert \
  --export ./hashnode-export.json \
  --output ./blog/posts
```

### Using the API

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

// Simple one-liner
const result = await Converter.fromExportFile('./export.json', './blog');

console.log(`Converted: ${result.converted}`);
console.log(`Skipped: ${result.skipped}`);
console.log(`Errors: ${result.errors}`);
```

## Output Structure

After conversion, your output directory will contain:

```
blog/
├── my-first-post/
│   ├── index.md          # Converted markdown with frontmatter
│   └── images/           # Downloaded images
│       ├── hero.png
│       └── screenshot.jpg
├── another-post/
│   ├── index.md
│   └── images/
└── ...
```

## Frontmatter Format

Each converted file includes YAML frontmatter:

```yaml
---
title: "My First Post"
slug: "my-first-post"
date: "2024-01-15T10:30:00.000Z"
tags:
  - javascript
  - tutorial
coverImage: "./images/hero.png"
---

Your markdown content here...
```

## Next Steps

- [CLI Usage](./cli-usage.md) - Full CLI reference with all options
- [Programmatic API](./programmatic-api.md) - Advanced API usage
- [Advanced Usage](./advanced.md) - Custom processors and events
