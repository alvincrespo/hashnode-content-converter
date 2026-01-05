# @alvincrespo/hashnode-content-converter

Convert Hashnode blog exports to framework-agnostic Markdown with YAML frontmatter.

## Features

- Converts Hashnode export JSON to clean Markdown files
- Generates YAML frontmatter with metadata (title, date, tags, etc.)
- Downloads and localizes images from Hashnode CDN
- Handles Hashnode-specific markdown quirks (align attributes, etc.)
- Provides both CLI and programmatic APIs
- Includes progress tracking and event-based monitoring

## Quick Links

- [Getting Started](./getting-started.md) - Installation and basic usage
- [CLI Usage](./cli-usage.md) - Command-line interface reference
- [Programmatic API](./programmatic-api.md) - Using the converter in your code
- [Advanced Usage](./advanced.md) - Custom processors and event handling

## Installation

```bash
npm install @alvincrespo/hashnode-content-converter
```

## Quick Start

### CLI

```bash
npx @alvincrespo/hashnode-content-converter convert \
  --export ./hashnode-export.json \
  --output ./blog/posts
```

### Programmatic

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const result = await Converter.fromExportFile('./export.json', './blog');
console.log(`Converted ${result.converted} posts`);
```

## Links

- [GitHub Repository](https://github.com/alvincrespo/hashnode-content-converter)
- [npm Package](https://www.npmjs.com/package/@alvincrespo/hashnode-content-converter)
- [Issue Tracker](https://github.com/alvincrespo/hashnode-content-converter/issues)
