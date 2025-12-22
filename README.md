# @alvin/hashnode-content-converter

[![codecov](https://codecov.io/gh/alvincrespo/hashnode-content-converter/graph/badge.svg)](https://codecov.io/gh/alvincrespo/hashnode-content-converter)
[![Tests](https://github.com/alvincrespo/hashnode-content-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/alvincrespo/hashnode-content-converter/actions/workflows/ci.yml)

Convert Hashnode blog exports to framework-agnostic Markdown with YAML frontmatter. This TypeScript package transforms your Hashnode content into portable Markdown files with proper frontmatter, localized images, and cleaned formatting—ready for any static site generator or blog platform.

> **Status**: Production-ready with 99.36% test coverage. All core components, CLI, and programmatic API are complete.

## Features

- **Metadata Extraction**: Parse Hashnode exports and extract essential post metadata (title, slug, dates, tags, cover image)
- **Markdown Transformation**: Clean Hashnode-specific formatting quirks (align attributes, trailing whitespace)
- **Image Localization**: Download CDN images and replace URLs with local paths
- **Intelligent Retry**: Marker-based strategy to skip already-downloaded images and permanent failures
- **YAML Frontmatter**: Generate framework-agnostic frontmatter from post metadata
- **Atomic File Operations**: Safe, atomic writes with directory traversal protection
- **Comprehensive Logging**: Dual-channel output (console + file) with detailed error tracking
- **Type-Safe**: Full TypeScript with strict mode and comprehensive test coverage (98%+)

## Installation

```bash
npm install @alvin/hashnode-content-converter
```

**Requirements**: Node.js >= 18.0.0 (Unix-like systems only: macOS, Linux)

## Usage

### CLI

The CLI provides a simple interface for converting Hashnode exports:

```bash
# Basic usage
npx @alvin/hashnode-content-converter convert \
  --export ./hashnode/export-articles.json \
  --output ./blog

# With all options
npx @alvin/hashnode-content-converter convert \
  --export ./hashnode/export-articles.json \
  --output ./blog \
  --log-file ./conversion.log \
  --verbose

# Overwrite existing posts (default is to skip)
npx @alvin/hashnode-content-converter convert \
  --export ./export.json \
  --output ./blog \
  --no-skip-existing
```

**Options**:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--export <path>` | `-e` | Path to Hashnode export JSON file | Required |
| `--output <path>` | `-o` | Output directory for converted posts | Required |
| `--log-file <path>` | `-l` | Path to log file | Optional |
| `--skip-existing` | | Skip posts that already exist | `true` |
| `--no-skip-existing` | | Overwrite existing posts | |
| `--verbose` | `-v` | Show detailed output including image downloads | `false` |
| `--quiet` | `-q` | Suppress all output except errors | `false` |

**Exit Codes**:
- `0` - Conversion completed successfully
- `1` - Conversion completed with errors, or validation failed

### Programmatic API

#### Quick Start

The simplest way to convert a Hashnode export:

```typescript
import { Converter } from '@alvin/hashnode-content-converter';

// One-liner conversion
const result = await Converter.fromExportFile('./export.json', './blog');
console.log(`Converted ${result.converted} posts in ${result.duration}`);
```

#### With Progress Tracking

Track conversion progress with a simple callback:

```typescript
import { Converter } from '@alvin/hashnode-content-converter';

const converter = Converter.withProgress((current, total, title) => {
  console.log(`[${current}/${total}] Converting: ${title}`);
});

const result = await converter.convertAllPosts('./export.json', './blog');
```

#### Full Control with Events

For complete control, use the event-driven API:

```typescript
import { Converter } from '@alvin/hashnode-content-converter';

const converter = new Converter();

// Progress tracking
converter.on('conversion-starting', ({ index, total, post }) => {
  console.log(`[${index}/${total}] Starting: ${post.title}`);
});

converter.on('conversion-completed', ({ result, durationMs }) => {
  console.log(`Completed in ${durationMs}ms: ${result.title}`);
});

// Error handling
converter.on('conversion-error', ({ type, slug, message }) => {
  console.error(`[${type}] ${slug}: ${message}`);
});

// Image tracking
converter.on('image-downloaded', ({ filename, success, is403 }) => {
  if (!success) console.warn(`Failed to download: ${filename}`);
});

const result = await converter.convertAllPosts('./export.json', './blog', {
  skipExisting: true,
  downloadOptions: { downloadDelayMs: 100 }
});
```

#### Advanced: Custom Processors

For custom pipelines, use individual processors:

```typescript
import {
  PostParser,
  MarkdownTransformer,
  ImageProcessor,
  FrontmatterGenerator,
  FileWriter
} from '@alvin/hashnode-content-converter';

// Parse metadata
const parser = new PostParser();
const metadata = parser.parse(hashnodePost);

// Transform markdown
const transformer = new MarkdownTransformer({ trimTrailingWhitespace: true });
const cleanedMarkdown = transformer.transform(metadata.contentMarkdown);

// Process images
const imageProcessor = new ImageProcessor({ downloadDelayMs: 100 });
const imageResult = await imageProcessor.process(cleanedMarkdown, './blog/my-post');

// Generate frontmatter
const generator = new FrontmatterGenerator();
const frontmatter = generator.generate(metadata);

// Write file
const writer = new FileWriter();
await writer.writePost('./blog', metadata.slug, frontmatter, imageResult.markdown);
```

## Current Status

All components are **feature-complete** with 99.36% test coverage (363 tests):

| Component | Description | Coverage |
|-----------|-------------|----------|
| Converter | Main orchestrator with event-driven progress tracking | 99.27% |
| PostParser | Extract metadata from Hashnode posts | 100% |
| MarkdownTransformer | Clean Hashnode-specific formatting | 100% |
| ImageProcessor | Download and localize images with marker-based retry | 98%+ |
| FrontmatterGenerator | Generate YAML frontmatter from metadata | 100% |
| ImageDownloader | HTTP downloads with retry logic and 403 tracking | 98.36% |
| FileWriter | Atomic file operations with path validation | 97.77% |
| Logger | Dual-channel logging with error tracking | 98.85% |
| CLI | Command-line interface with progress display | 98%+ |

See [docs/TRANSITION.md](docs/TRANSITION.md) for the complete implementation history.

## Architecture

The package uses a modular, service-oriented design with clear separation of concerns:

```
Hashnode Export JSON
    ↓
PostParser (extract metadata)
    ↓
MarkdownTransformer (fix formatting)
    ↓
ImageProcessor (download & localize images)
    ↓
FrontmatterGenerator (create YAML frontmatter)
    ↓
FileWriter (persist to disk)
    ↓
Logger (track results & errors)
```

**Key Directories**:
- [src/types/](src/types/) - TypeScript interfaces and type definitions
- [src/processors/](src/processors/) - Content transformation classes
- [src/services/](src/services/) - Infrastructure services (HTTP, filesystem, logging)
- [src/cli/](src/cli/) - Command-line interface
- [tests/](tests/) - Unit and integration tests (363 tests, 99.36% coverage)

## Development

### Setup

This project uses nvm for Node.js version management:

```bash
# Set correct Node version
nvm use $(cat .node-version)

# Install dependencies
npm install
```

### Common Commands

```bash
# Build TypeScript to dist/
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests with coverage
npm test

# Watch tests
npm run test:watch

# Interactive test dashboard
npm run test:ui

# Type-check without emitting
npm run type-check

# Lint code
npm run lint

# Full pre-publication checks
npm run prepublishOnly
```

### Testing

The project uses Vitest with comprehensive test coverage:

- **363 tests** across 9 test files
- **99.36% code coverage** overall
- **Test patterns**: AAA (Arrange-Act-Assert), mocked dependencies, comprehensive edge cases

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| Unit Tests | 305 | 98%+ |
| Integration Tests | 58 | 99%+ |

```bash
npm run test:coverage  # Generate detailed coverage report
```

## Migrating from convert-hashnode.js

If you're migrating from the original `convert-hashnode.js` script, here are the key differences:

### Configuration Changes

| Original Script | This Package |
|-----------------|--------------|
| Environment variables (`EXPORT_DIR`, `READ_DIR`) | CLI arguments (`--export`, `--output`) |
| Hardcoded paths | User-specified paths |
| Single output format | Same output format, more control |

### Migration Steps

1. **Install the package**:
   ```bash
   npm install @alvin/hashnode-content-converter
   ```

2. **Replace script invocation**:
   ```bash
   # Old way (convert-hashnode.js)
   EXPORT_DIR=blog READ_DIR=blog node convert-hashnode.js

   # New way
   npx @alvin/hashnode-content-converter convert \
     --export ./hashnode/export-articles.json \
     --output ./blog
   ```

3. **Output format**: The generated Markdown files maintain the same structure:
   - YAML frontmatter with title, date, description, cover image
   - Cleaned markdown content (align attributes removed)
   - Downloaded images in post directories

### Programmatic Migration

If you were importing functions from the original JavaScript script, you can now use the new typed API:

```javascript
// Old: CommonJS JavaScript (no type information)
const { processPost, downloadImage } = require('./convert-hashnode');
```

```typescript
// New: TypeScript with full type support
import { Converter, PostParser, ImageProcessor } from '@alvin/hashnode-content-converter';
```

## Documentation

- [docs/TRANSITION.md](docs/TRANSITION.md) - Architecture and implementation history
- [CLAUDE.md](CLAUDE.md) - Project guidelines for development
- [docs/phases/](docs/phases/) - Phase-by-phase implementation plans

## Contributing

This project follows strict TypeScript and testing standards:

- **TypeScript**: Strict mode, no `any` types in critical paths
- **Testing**: 90%+ coverage required for new implementations
- **Documentation**: JSDoc on all public APIs
- **Code Style**: ESLint enforced

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

## License

MIT
