# @alvin/hashnode-content-converter

[![codecov](https://codecov.io/gh/alvincrespo/hashnode-content-converter/graph/badge.svg)](https://codecov.io/gh/alvincrespo/hashnode-content-converter)
[![Tests](https://github.com/alvincrespo/hashnode-content-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/alvincrespo/hashnode-content-converter/actions/workflows/ci.yml)

Convert Hashnode blog exports to framework-agnostic Markdown with YAML frontmatter. This TypeScript package transforms your Hashnode content into portable Markdown files with proper frontmatter, localized images, and cleaned formatting—ready for any static site generator or blog platform.

> **Status**: Core implementation in progress (4 of 5 major components complete). See [Current Status](#current-status) for details.

## Features

- **Metadata Extraction**: Parse Hashnode exports and extract essential post metadata (title, slug, dates, tags, cover image)
- **Markdown Transformation**: Clean Hashnode-specific formatting quirks (align attributes, trailing whitespace)
- **Image Localization**: Download CDN images and replace URLs with local paths
- **Intelligent Retry**: Marker-based strategy to skip already-downloaded images and permanent failures
- **YAML Frontmatter**: Generate framework-agnostic frontmatter from post metadata *(coming soon)*
- **Atomic File Operations**: Safe, atomic writes with directory traversal protection
- **Comprehensive Logging**: Dual-channel output (console + file) with detailed error tracking
- **Type-Safe**: Full TypeScript with strict mode and comprehensive test coverage (98%+)

## Installation

```bash
npm install @alvin/hashnode-content-converter
```

**Requirements**: Node.js >= 18.0.0 (Unix-like systems only: macOS, Linux)

## Usage

### CLI (Coming Soon)

Once implementation is complete, the CLI will provide a simple interface:

```bash
npx @alvin/hashnode-content-converter convert \
  --export ./hashnode/export-articles.json \
  --output ./blog \
  --log-file ./conversion.log
```

### Programmatic API

You can use the individual processors and services directly:

```typescript
import {
  PostParser,
  MarkdownTransformer,
  ImageProcessor,
  FrontmatterGenerator,
  ImageDownloader,
  FileWriter,
  Logger
} from '@alvin/hashnode-content-converter';

// Parse Hashnode post metadata
const parser = new PostParser();
const metadata = parser.parse(hashnodePost);

// Transform markdown content
const transformer = new MarkdownTransformer({
  removeAlignAttributes: true,
  trimTrailingWhitespace: true
});
const cleanedMarkdown = await transformer.transform(post.contentMarkdown);

// Download and localize images
const imageProcessor = new ImageProcessor(
  new ImageDownloader(),
  new Logger()
);
const localizedMarkdown = await imageProcessor.process(
  cleanedMarkdown,
  './images',
  { downloadDelayMs: 100 }
);

// Generate frontmatter (coming soon)
const generator = new FrontmatterGenerator();
const frontmatter = generator.generate(metadata);

// Write final markdown file
const writer = new FileWriter();
await writer.writeFile(
  './blog/my-post.md',
  `${frontmatter}\n\n${localizedMarkdown}`
);
```

## Current Status

**Completed Components** (98%+ test coverage):
- ✅ PostParser - Extract metadata from Hashnode posts
- ✅ MarkdownTransformer - Clean Hashnode-specific formatting
- ✅ ImageProcessor - Download and localize images with marker-based retry
- ✅ ImageDownloader - HTTP downloads with retry logic and 403 tracking
- ✅ FileWriter - Atomic file operations with path validation
- ✅ Logger - Dual-channel logging with error tracking

**In Progress**:
- ⏳ FrontmatterGenerator - Generate YAML frontmatter from metadata
- ⏳ Converter - Main orchestrator coordinating the pipeline
- ⏳ CLI - Command-line interface

See [TRANSITION.md](TRANSITION.md) for the complete implementation roadmap.

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
- [tests/](tests/) - Unit and integration tests (227 tests, 3,248 lines)

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

- **227 unit tests** across 6 test files
- **98%+ average coverage** for implemented components
- **Test patterns**: AAA (Arrange-Act-Assert), mocked dependencies, comprehensive edge cases
- **Coverage targets**: 80%+ overall, 90%+ for new implementations

```bash
npm run test:coverage  # Generate detailed coverage report
```

## Documentation

- [TRANSITION.md](TRANSITION.md) - Comprehensive architecture and implementation roadmap
- [CLAUDE.md](CLAUDE.md) - Project guidelines for Claude Code
- [docs/PHASE_*.md](docs/) - Phase-by-phase implementation tracking
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) - Code style conventions

## Contributing

This project follows strict TypeScript and testing standards:

- **TypeScript**: Strict mode, no `any` types in critical paths
- **Testing**: 90%+ coverage required for new implementations
- **Documentation**: JSDoc on all public APIs
- **Code Style**: ESLint enforced

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

## License

MIT
