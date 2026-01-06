# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**@alvincrespo/hashnode-content-converter** is a TypeScript npm package that converts Hashnode blog exports into framework-agnostic Markdown with YAML frontmatter. It was refactored from a monolithic Node.js script (`convert-hashnode.js`) into a modular, type-safe, reusable package.

**Current Status**: Feature-complete and production-ready. All core processors, services, and CLI are fully implemented with 99.36% test coverage (363 tests). See TRANSITION.md for the implementation history.

**Platform Support**: This package is designed for Unix-like systems (macOS, Linux). Windows is not supported.

Reference: [TRANSITION.md](TRANSITION.md) contains the full implementation roadmap and architectural design.

## Tech Stack

- **Runtime**: Node.js >=18.0.0 (using nvm for version management)
- **Language**: TypeScript 5.0+ (target: ES2022, module: NodeNext)
- **Build**: TypeScript compiler with incremental builds
- **Testing**: Vitest with @vitest/ui dashboard
- **Linting**: ESLint + @typescript-eslint
- **CLI**: commander.js for argument parsing
- **Package Manager**: npm (ESM with `"type": "module"`, published to npm registry)

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
- **[tests/](tests/)** - Unit and integration tests with Vitest (363 tests, 99.36% coverage)
- **[tests/fixtures/](tests/fixtures/)** - Sample Hashnode export JSON for testing

### Core Classes (Current Implementation Status)

| Class | Location | Status | Purpose |
|-------|----------|--------|---------|
| `Converter` | [src/converter.ts](src/converter.ts) | **Complete** | Orchestrates entire conversion pipeline with event system |
| `PostParser` | [src/processors/post-parser.ts](src/processors/post-parser.ts) | **Complete** | Extracts and validates metadata from Hashnode posts |
| `MarkdownTransformer` | [src/processors/markdown-transformer.ts](src/processors/markdown-transformer.ts) | **Partial** | Align attribute removal and whitespace trimming work; callout conversion stubbed |
| `ImageProcessor` | [src/processors/image-processor.ts](src/processors/image-processor.ts) | **Complete** | Downloads images with marker-based retry strategy |
| `FrontmatterGenerator` | [src/processors/frontmatter-generator.ts](src/processors/frontmatter-generator.ts) | **Complete** | Generates YAML frontmatter with proper escaping |
| `FileWriter` | [src/services/file-writer.ts](src/services/file-writer.ts) | **Complete** | Atomic file writes with path sanitization |
| `ImageDownloader` | [src/services/image-downloader.ts](src/services/image-downloader.ts) | **Complete** | HTTPS downloads with retry logic and 403 handling |
| `Logger` | [src/services/logger.ts](src/services/logger.ts) | **Complete** | Dual logging (console + file) with HTTP 403 tracking |

**Reference Implementation**: [convert-hashnode.js](convert-hashnode.js) contains the original 343-line monolithic script that this package was refactored from.

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

The CLI is defined in [src/cli/convert.ts](src/cli/convert.ts) and registered in `package.json` as the `hashnode-converter` binary. It provides:

**Options:**
- `--export <path>` (required) - Path to Hashnode export JSON file
- `--output <path>` (required) - Output directory for converted markdown files
- `--log-file <path>` (optional) - Path for conversion log file
- `--skip-existing` / `--no-skip-existing` - Skip already converted posts (default: true)
- `--verbose` - Show detailed output including image downloads
- `--quiet` - Suppress all output except errors

**Features:**
- Comprehensive path validation with helpful error messages
- Progress bar with ASCII visualization during conversion
- Proper exit codes (0 for success, 1 for errors)

**Usage:**
```bash
npx @alvincrespo/hashnode-content-converter convert --export ./export.json --output ./blog
npx @alvincrespo/hashnode-content-converter convert --export ./export.json --output ./blog --verbose
npx @alvincrespo/hashnode-content-converter convert --export ./export.json --output ./blog --no-skip-existing
```

## Package Configuration

- **Main entry**: [dist/index.ts](src/index.ts) (compiles to dist/index.js)
- **Types entry**: dist/index.d.ts (auto-generated)
- **CLI entry**: [dist/cli/convert.js](src/cli/convert.ts)
- **Output format**: ESM (ECMAScript Modules) for Node.js >=18
- **Module settings**: `"type": "module"` in package.json, `verbatimModuleSyntax: true` in tsconfig

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

- **Unit Tests**: 305 tests across 8 test files covering all processors and services
- **Integration Tests**: 58 tests for full pipeline in [tests/integration/converter.test.ts](tests/integration/converter.test.ts)
- **Fixtures**: [tests/fixtures/sample-hashnode-export.json](tests/fixtures/sample-hashnode-export.json) contains real-world example data
- **Mocks**: [tests/mocks/mocks.ts](tests/mocks/mocks.ts) provides factory functions for HTTP responses, file streams, and console output

### Current Test Coverage

The project currently has **363 tests** with **99.36% code coverage**:

| Component | Tests | Coverage |
|-----------|-------|----------|
| PostParser | 51 | 100% |
| MarkdownTransformer | 41 | 100% |
| ImageProcessor | 51 | 98%+ |
| FrontmatterGenerator | 9 | 100% |
| ImageDownloader | 28 | 98.36% |
| FileWriter | 32 | 97.77% |
| Logger | 48 | 98.85% |
| CLI | 45 | 98%+ |
| Converter (integration) | 58 | 99.27% |

### Test Verification Criteria

When implementing or modifying a service or processor, verify completeness with:

1. **Tests Pass**: Run `npm test` - all tests must pass without errors
2. **Code Coverage**: Run `npm run test:coverage` - target **90%+ coverage** for the code being tested
   - Statements: ≥90%
   - Branches: ≥90% (critical for error handling paths)
   - Functions: ≥90%
   - Lines: ≥90%

**Coverage Goal**: 80%+ overall project coverage, 90%+ for new implementations. Current project coverage (99.36%) exceeds all targets.

## Releasing

This project uses an automated release workflow with GitHub Actions. Releases go through a PR-based process to ensure CI passes before publishing.

### Release Command

Use the `/release` Claude command to cut a new release:

```bash
/release patch   # Bug fixes: 0.2.2 → 0.2.3
/release minor   # New features: 0.2.2 → 0.3.0
/release major   # Breaking changes: 0.2.2 → 1.0.0
```

### Release Workflow

The `/release` command automates the following process:

1. **Create release branch**: `release/v<new-version>` from main
2. **Bump version**: Updates package.json (without creating a tag)
3. **Push and create PR**: Opens a PR for review
4. **CI runs**: Tests, linting, and type-checking must pass
5. **Merge PR**: After approval and CI passes
6. **Auto-tag** (GitHub Action): The [auto-tag-release.yml](.github/workflows/auto-tag-release.yml) workflow automatically creates and pushes the `v<version>` tag
7. **Publish** (GitHub Action): The [release.yml](.github/workflows/release.yml) workflow publishes to npm and creates a GitHub Release

### Skipping Auto-Tag

To merge a release PR without triggering the npm publish (e.g., for testing):

- Include `[SKIP RELEASE]` in the PR title
- Example: `[SKIP RELEASE] chore: bump version to 0.2.3`

After merging, you can manually tag later using `/release tag`.

### Manual Tagging

If auto-tagging was skipped, use:

```bash
/release tag
```

This will:
1. Pull the latest main branch
2. Read the version from package.json
3. Create and push the `v<version>` tag
4. Trigger the release workflow

### Related Files

- [.claude/commands/release.md](.claude/commands/release.md) - The `/release` command definition
- [.github/workflows/auto-tag-release.yml](.github/workflows/auto-tag-release.yml) - Auto-tags merged release PRs
- [.github/workflows/release.yml](.github/workflows/release.yml) - Publishes to npm on tag push

## Key Files to Understand First

1. [TRANSITION.md](TRANSITION.md) - Implementation history and architectural decisions
2. [src/converter.ts](src/converter.ts) - Main orchestrator with event system (shows how pieces fit together)
3. [src/types/hashnode-schema.ts](src/types/hashnode-schema.ts) - Data shapes throughout the pipeline
4. [src/index.ts](src/index.ts) - Public API exports with JSDoc documentation
5. [tests/integration/converter.test.ts](tests/integration/converter.test.ts) - Full pipeline integration tests (58 tests)
