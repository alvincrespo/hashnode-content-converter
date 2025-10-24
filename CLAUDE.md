# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@alvin/hashnode-content-converter** is a TypeScript npm package that converts Hashnode blog exports into framework-agnostic Markdown with YAML frontmatter. It's currently a work-in-progress refactoring of a monolithic Node.js script (`convert-hashnode.js`) into a modular, type-safe, reusable package.

**Current Status**: Architecture designed, types defined, stub classes created. Core implementation still in progress.

Reference: [TRANSITION.md](TRANSITION.md) contains the full implementation roadmap and architectural design.

## Tech Stack

- **Runtime**: Node.js >=18.0.0 (using nvm for version management)
- **Language**: TypeScript 5.0+ (target: ES2020, module: CommonJS)
- **Build**: TypeScript compiler with incremental builds
- **Testing**: Vitest with @vitest/ui dashboard
- **Linting**: ESLint + @typescript-eslint
- **CLI**: commander.js for argument parsing
- **Package Manager**: npm (CommonJS, published to npm registry)

## Environment Setup (IMPORTANT)

This project uses **nvm** (Node Version Manager) to manage Node.js versions. Before running any npm or node commands, you MUST set the correct Node version:

```bash
# Set Node version from .node-version file
nvm use $(cat .node-version)

# Verify the correct version is active
node --version  # Should show v24.4.0 (or the version in .node-version)
npm --version   # Should show 11.6.0 or compatible
```

### Usage in Different Environments

**For interactive terminal work (zsh recommended)**:
- Your zsh shell should already have nvm properly initialized via your `.zshrc`
- Simply run npm commands directly - nvm will automatically use the version from `.node-version`
- This is the preferred way to work locally

**For Claude Code automated tasks**:
- Claude's bash environment doesn't persist nvm initialization across commands
- Always chain commands with `&&` to keep nvm in the shell context
- Pattern: `nvm use $(cat .node-version) && npm run build`
- Example:
  ```bash
  # Good - nvm stays active for the npm command
  nvm use $(cat .node-version) && npm run type-check && npm run build

  # Avoid - nvm state is lost between separate commands
  nvm use $(cat .node-version)
  npm run build  # ❌ npm may not be found
  ```

## Common Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Watch mode (auto-rebuild on file changes)
npm run dev

# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Open interactive test dashboard (useful for debugging)
npm run test:ui

# Generate coverage reports (includes html report)
npm run test:coverage

# Type-check without emitting (fast feedback loop)
npm run type-check

# Run full pre-publication checks (build + test)
npm run prepublishOnly
```

**Quick Feedback Loop for Development**:
```bash
# Terminal 1: Watch TypeScript compilation
npm run dev

# Terminal 2: Watch tests in background
npm run test:watch

# Terminal 3: Type checking before commit
npm run type-check
```

## High-Level Architecture

The application uses a **modular, service-oriented design** with clear separation of concerns. The conversion pipeline flows through distinct phases:

```
Hashnode Export JSON
    ↓
PostParser (extract metadata)
    ↓
MarkdownTransformer (fix Hashnode-specific issues)
    ↓
ImageProcessor (download & localize images)
    ↓
FrontmatterGenerator (create YAML frontmatter)
    ↓
FileWriter (persist to disk)
    ↓
Logger (track results & errors)
```

### Key Directories

- **[src/types/](src/types/)** - TypeScript interfaces defining the Hashnode export schema, conversion options, and result types
- **[src/processors/](src/processors/)** - Single-responsibility classes that transform content (parsing, markdown fixing, image processing, frontmatter generation)
- **[src/services/](src/services/)** - Infrastructure services (HTTP downloads, filesystem I/O, logging)
- **[src/cli/](src/cli/)** - Command-line interface using commander.js
- **[src/converter.ts](src/converter.ts)** - Main orchestrator that coordinates the pipeline
- **[tests/](tests/)** - Unit and integration tests with vitest (currently one integration test exists but is skipped)
- **[tests/fixtures/](tests/fixtures/)** - Sample Hashnode export JSON for testing

### Core Classes (Current Implementation Status)

| Class | Location | Status | Purpose |
|-------|----------|--------|---------|
| `Converter` | [src/converter.ts](src/converter.ts) | **Stub** | Orchestrates entire conversion pipeline |
| `PostParser` | [src/processors/post-parser.ts](src/processors/post-parser.ts) | **Stub** | Extracts metadata from Hashnode posts |
| `MarkdownTransformer` | [src/processors/markdown-transformer.ts](src/processors/markdown-transformer.ts) | **Partial** | Removes align attributes (working); other transforms needed |
| `ImageProcessor` | [src/processors/image-processor.ts](src/processors/image-processor.ts) | **Stub** | Downloads images and replaces CDN URLs with local paths |
| `FrontmatterGenerator` | [src/processors/frontmatter-generator.ts](src/processors/frontmatter-generator.ts) | **Stub** | Generates YAML frontmatter from metadata |
| `FileWriter` | [src/services/file-writer.ts](src/services/file-writer.ts) | **Stub** | Writes markdown files to filesystem |
| `ImageDownloader` | [src/services/image-downloader.ts](src/services/image-downloader.ts) | **Stub** | HTTPS downloads with retry logic |
| `Logger` | [src/services/logger.ts](src/services/logger.ts) | **Stub** | Dual logging (console + file) |

**Reference Implementation**: [convert-hashnode.js](convert-hashnode.js) contains a complete 343-line working implementation of the original script. Use this for reference when implementing stub classes.

## Working with Specific Areas

### Adding a Processor

Processors handle content transformation with single responsibility. When implementing a new processor:

1. Define input/output types in [src/types/](src/types/)
2. Create processor class in [src/processors/](src/processors/) with a single `process()` or `transform()` method
3. Add unit tests in [tests/unit/](tests/unit/)
4. Integrate into the pipeline in [src/converter.ts](src/converter.ts)

Example pattern:
```typescript
class MyProcessor {
  process(input: Input): Output {
    // single responsibility transformation
    return output;
  }
}
```

### Adding a Service

Services handle infrastructure concerns (I/O, networking). Create in [src/services/](src/services/) following the dependency injection pattern:

```typescript
class MyService {
  constructor(private config?: ServiceConfig) {}

  async doWork(): Promise<Result> {
    // ...
  }
}
```

### Writing Tests

Tests use Vitest. Follow this pattern:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ClassToTest } from '../src/path/to/class';

describe('ClassToTest', () => {
  it('should do something', async () => {
    // Arrange
    const instance = new ClassToTest();

    // Act
    const result = await instance.method();

    // Assert
    expect(result).toEqual(expected);
  });
});
```

Use [tests/fixtures/](tests/fixtures/) sample data for realistic test cases. Mock external dependencies (HTTP, filesystem) for unit tests.

## Type System

The Hashnode schema is defined in [src/types/hashnode-schema.ts](src/types/hashnode-schema.ts). Key types:

- **`HashnodePost`** - Full post schema from export
- **`PostMetadata`** - Subset of fields extracted by PostParser
- **`ConversionOptions`** - Configuration (skipExisting, downloadDelayMs)
- **`ConversionResult`** - Result with stats (converted, skipped, errors, duration)

Always use these types when working with the data pipeline to catch errors early.

## CLI Entry Point

The CLI is defined in [src/cli/convert.ts](src/cli/convert.ts) and registered in `package.json` as the `hashnode-converter` binary. It should:

1. Parse arguments using commander.js
2. Validate paths and options
3. Create a Converter instance
4. Call `convertAllPosts()`
5. Display results and exit with appropriate status code

Expected usage:
```bash
npx @alvin/hashnode-content-converter convert --export ./export.json --output ./blog
```

## Package Configuration

- **Main entry**: [dist/index.ts](src/index.ts) (compiles to dist/index.js)
- **Types entry**: dist/index.d.ts (auto-generated)
- **CLI entry**: [dist/cli/convert.js](src/cli/convert.ts)
- **Output format**: CommonJS for Node.js >=18

Build configuration excludes tests and uses [tsconfig.build.json](tsconfig.build.json).

## Code Comments & Documentation

### Commenting Philosophy

**Comments should explain the "why" and "what's non-obvious", not restate the code.**

**ADD comments when**:
- Explaining non-obvious algorithmic choices
- Clarifying why a certain error handling strategy was chosen
- Documenting gotchas, edge cases, or side effects that aren't obvious
- Adding business logic or domain knowledge needed to understand intent
- Explaining performance considerations or tradeoffs

**SKIP comments for**:
- Simple boolean checks where variable names are self-explanatory
- Standard control flow (if/else, loops)
- What standard library functions do
- Code that clearly states what it does

**Example**:
```typescript
// Bad: Just restates what the code does
if (result.is403) {
  return result;
}

// Good: Explains why we don't retry
// Don't retry on 403 - indicates the URL is permanently inaccessible
// rather than a transient network failure, so further attempts are wasteful
if (result.is403) {
  return result;
}
```

### JSDoc for Public APIs

Use JSDoc for:
- Public methods, functions, and interfaces
- Complex configuration options
- Return types and error conditions
- Usage examples for non-obvious behavior

Keep JSDoc concise but complete.

## Implementation Notes

### Design Patterns Used

- **Service Oriented**: Each service has a single purpose
- **Dependency Injection**: Services accept configuration via constructor
- **Pipeline Pattern**: Converter orchestrates sequential processors
- **Error Tracking**: Logger tracks errors separately for reporting

### Hashnode-Specific Quirks

- Markdown includes `align="..."` attributes that need removal
- Images reference CDN URLs that should be downloaded locally
- Metadata fields may be null/undefined (handle with defaults)
- Posts have both `contentMarkdown` (raw) and `content` (HTML) - use contentMarkdown

### Image Processing

The ImageProcessor needs to:
1. Extract all image URLs from markdown
2. Download each image using ImageDownloader (with retry logic)
3. Replace CDN URLs with local relative paths
4. Handle download failures gracefully (track in Logger)
5. Skip already-downloaded images

HTTP 403 errors should be tracked separately as they indicate permission issues rather than transient failures.

## Testing Strategy

- **Unit Tests**: Test individual processors and services with mocked dependencies
- **Integration Tests**: Test full pipeline with fixture data
- **Fixtures**: [tests/fixtures/sample-hashnode-export.json](tests/fixtures/sample-hashnode-export.json) contains real-world example data

### Test Verification Criteria

When implementing or modifying a service or processor, verify completeness with:

1. **Tests Pass**: Run `npm test` - all tests must pass without errors
2. **Code Coverage**: Run `npm run test:coverage` - target **90%+ coverage** for the code being tested
   - Statements: ≥90%
   - Branches: ≥90% (critical for error handling paths)
   - Functions: ≥90%
   - Lines: ≥90%

**Coverage Goal**: 80%+ overall project coverage, 90%+ for new implementations

**Example**: [ImageDownloader](src/services/image-downloader.ts) achieved 98.36% statement coverage with comprehensive test suite.

## Key Files to Understand First

1. [TRANSITION.md](TRANSITION.md) - Comprehensive architecture and implementation roadmap
2. [src/converter.ts](src/converter.ts) - Main orchestrator (shows how pieces fit together)
3. [src/types/hashnode-schema.ts](src/types/hashnode-schema.ts) - Data shapes throughout the pipeline
4. [convert-hashnode.js](convert-hashnode.js) - Reference implementation of working script
5. [tests/integration/converter.test.ts](tests/integration/converter.test.ts) - Shows expected behavior
