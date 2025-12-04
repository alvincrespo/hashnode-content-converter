# Hashnode Content Converter - Transition to NPM Package

## Problem Statement

The current `convert-hashnode.js` is a standalone Node.js script tightly coupled to:
- Hardcoded directory paths and file structures
- Specific Hashnode export JSON format
- Mixed concerns (downloading, parsing, transforming, writing, logging)
- Untyped JavaScript (difficult to maintain and extend)
- Environment variable configuration
- No ability to be consumed as a reusable library

Additionally, this script serves a valuable purpose (migrating content from Hashnode) that could benefit other users, but is not currently packagable or distributable.

## Goal

Extract the conversion logic into a modular, well-typed TypeScript npm package (`@alvin/hashnode-content-converter`) that:
- **Can be used as a CLI tool** - drop-in replacement for current script with backwards compatibility
- **Can be consumed as a library** - reusable processor for content migration in other projects
- **Is well-structured** - single responsibility principle, composition over inheritance
- **Is type-safe** - full TypeScript support with exported types for Hashnode schema
- **Is observable** - event emitters and callbacks for logging/progress tracking
- **Is testable** - unit and integration test coverage
- **Is distributable** - published to npm registry with comprehensive documentation

## High-Level Architecture

### Package Structure

```
@alvin/hashnode-content-converter/
├── src/
│   ├── types/
│   │   ├── hashnode-schema.ts          # Hashnode export JSON types
│   │   ├── converter-options.ts        # Configuration and options
│   │   └── conversion-result.ts        # Result types
│   │
│   ├── processors/
│   │   ├── post-parser.ts             # Extract fields from Hashnode post
│   │   ├── markdown-transformer.ts    # Fix Hashnode-specific markdown issues
│   │   ├── image-processor.ts         # Download images, extract hashes
│   │   └── frontmatter-generator.ts   # Generate YAML frontmatter
│   │
│   ├── services/
│   │   ├── image-downloader.ts        # HTTP downloads with retries + redirects
│   │   ├── file-writer.ts             # Write files to filesystem
│   │   └── logger.ts                  # Logging with dual output (console + file)
│   │
│   ├── converter.ts                    # Orchestrator/coordinator
│   ├── index.ts                        # Public API exports
│   │
│   └── cli/
│       └── convert.ts                  # Command-line interface
│
├── tests/
│   ├── fixtures/
│   │   ├── sample-hashnode-export.json
│   │   ├── sample-post.json
│   │   └── test-images/
│   │
│   ├── unit/
│   │   ├── processors.test.ts
│   │   ├── services.test.ts
│   │   └── utils.test.ts
│   │
│   └── integration/
│       └── converter.test.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### Core Components

#### 1. **Type System** (`types/`)
   - `HashNodePost` - Full schema of Hashnode export
   - `PostMetadata` - Extracted fields (title, slug, date, etc.)
   - `ConvertedPost` - Output representation
   - `ConversionOptions` - Configuration object
   - `ConversionResult` - Result with stats and errors
   - `LoggerConfig` - Logger configuration

#### 2. **Processors** (`processors/`)
   Each processor has single responsibility and is independently testable.

   - **PostParser**
     - Input: Hashnode post object
     - Output: Extracted metadata (title, slug, date, description, content, cover)
     - Handles: Field extraction, null checks, defaults

   - **MarkdownTransformer**
     - Input: Raw contentMarkdown from Hashnode
     - Output: Fixed markdown string
     - Handles: Remove align attributes, fix HTML entities, normalize spacing

   - **ImageProcessor**
     - Input: Markdown content, blog directory path
     - Output: Updated markdown with local image paths
     - Handles: Download images, extract hashes, replace CDN URLs, track errors

   - **FrontmatterGenerator**
     - Input: Metadata object
     - Output: YAML frontmatter string
     - Handles: Quote escaping, date formatting, tag handling

#### 3. **Services** (`services/`)
   Reusable domain-specific services.

   - **ImageDownloader**
     - Handles HTTPS GET requests with redirects
     - Implements retry logic for transient failures
     - Tracks HTTP 403 errors separately
     - Respects rate limiting (configurable delay between downloads)

   - **FileWriter**
     - Creates directories if needed
     - Writes markdown files with frontmatter + content
     - Creates post directories structure

   - **Logger**
     - Logs to console and file simultaneously
     - Tracks 403 errors for reporting
     - Generates conversion summary
     - Timestamps all entries
     - Reports duration and statistics

#### 4. **Converter** (`converter.ts`)
   Orchestrates the entire conversion pipeline.

   ```typescript
   class Converter {
     async convertAllPosts(
       hashNodeExportPath: string,
       outputDirectory: string,
       options?: ConversionOptions
     ): Promise<ConversionResult>

     async convertPost(
       post: HashnodePost,
       outputDirectory: string,
       options?: ConversionOptions
     ): Promise<ConvertedPost>
   }
   ```

#### 5. **CLI** (`cli/convert.ts`)
   Command-line entry point that mirrors current script functionality.

   ```bash
   npx @alvin/hashnode-content-converter convert \
     --export ./hashnode/export-articles.json \
     --output ./blog \
     --log-file ./conversion.log
   ```

### Data Flow Diagram

```
┌─────────────────────────┐
│  Hashnode Export JSON   │
└────────────┬────────────┘
             │
             ▼
     ┌───────────────────┐
     │  PostParser       │
     │  Extract fields   │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Markdown         │
     │  Transformer      │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Image            │
     │  Processor        │
     │  (uses            │
     │  ImageDownloader) │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Frontmatter      │
     │  Generator        │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  FileWriter       │
     │  (writes to disk) │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Logger           │
     │  (tracks errors)  │
     └───────────────────┘
```

## Detailed Implementation Steps

### Phase 1: Project Setup ✅ COMPLETE (2025-10-24)

#### Step 1.1: Create NPM Package Scaffold ✅
- ✅ Initialize new project directory: `hashnode-content-converter`
- ✅ Create `package.json` with:
  - ✅ name: `@alvin/hashnode-content-converter`
  - ✅ main entry point: `dist/index.js`
  - ✅ types entry point: `dist/index.d.ts`
  - ✅ bin entry point for CLI: `dist/cli/convert.js`
- ✅ Setup TypeScript compilation to `dist/` directory
- ✅ Configure build script to compile TypeScript

#### Step 1.2: Configure TypeScript ✅
- ✅ Create `tsconfig.json` with:
  - ✅ target: ES2020
  - ✅ module: commonjs
  - ✅ strict mode enabled
  - ✅ source maps for debugging
  - ✅ declaration files enabled
- ✅ Create `tsconfig.build.json` (excludes tests)

#### Step 1.3: Setup Testing Infrastructure ✅
- ✅ Install Vitest and @vitest/ui (declared, awaiting `npm install`)
- ✅ Create `vitest.config.ts`
- ✅ Create test directory structure
- ✅ Add test scripts to package.json

#### Step 1.4: Create Directory Structure ✅
- ✅ Create `src/types/` directory
- ✅ Create `src/processors/` directory
- ✅ Create `src/services/` directory
- ✅ Create `src/cli/` directory
- ✅ Create `tests/` directory with subdirectories
- ✅ Create `tests/fixtures/` with sample data

### Phase 2: Type Definitions

#### Step 2.1: Generate Hashnode Schema Types ✅ COMPLETE (2025-10-24)
- ✅ Analyzed current Hashnode export structure
- ✅ Created `src/types/hashnode-schema.ts` with:
  - ✅ `HashnodePost` interface (full schema with 18 fields)
  - ✅ `PostMetadata` interface (subset of 6 fields used for conversion)
  - ✅ `HashnodeExport` interface (root export structure)
- ✅ All interfaces properly typed with optional fields marked

#### Step 2.2: Create Converter Configuration Types ✅ COMPLETE (2025-10-24)
- ✅ Expanded `src/types/converter-options.ts`:
  - ✅ `ImageDownloadOptions` (maxRetries, retryDelayMs, timeoutMs, downloadDelayMs)
  - ✅ `LoggerConfig` (filePath, verbosity: quiet|normal|verbose)
  - ✅ `ConversionOptions` (skipExisting, downloadOptions, loggerConfig)
- ✅ Created `src/types/conversion-result.ts`:
  - ✅ `ConversionResult` (moved from converter-options.ts)
  - ✅ `ConvertedPost` (slug, title, outputPath, success, error)
  - ✅ `ConversionError` (moved from converter-options.ts)
- ✅ Updated imports in `src/converter.ts` for new type location
- ✅ Added export of `conversion-result.ts` in `src/index.ts`
- ✅ Type-check verification: PASS
- ✅ Build verification: PASS

### Phase 3: Service Layer Implementation

#### Step 3.1: Implement ImageDownloader Service ✅ COMPLETE (2025-10-26)
- ✅ Create `src/services/image-downloader.ts`
- ✅ Implement HTTPS GET with error handling
- ✅ Add redirect following logic (301/302)
- ✅ Implement retry mechanism for transient failures (not 403/404)
- ✅ Add configurable delay between downloads (rate limiting)
- ✅ Handle file stream writing to disk
- ✅ Add specific tracking for HTTP 403 errors
- ✅ Write unit tests for:
  - ✅ Successful download
  - ✅ Redirect handling
  - ✅ 403 error tracking
  - ✅ Timeout handling
- ✅ 98.36% test coverage achieved (22 tests passing)
- ✅ Fixed in commit e7d5921
- ✅ Issue #1 closed

#### Step 3.2: Implement FileWriter Service ✅ COMPLETE (2025-11-06)
- ✅ Create `src/services/file-writer.ts`
- ✅ Implement directory creation with recursive option
- ✅ Implement markdown file writing with atomic writes
- ✅ Handle path resolution and validation (security-focused)
- ✅ Write unit tests for:
  - ✅ Path validation (6 tests)
  - ✅ Directory creation (4 tests)
  - ✅ File writing (6 tests)
  - ✅ Atomic writes (4 tests)
  - ✅ Overwrite behavior (3 tests)
  - ✅ postExists() method (3 tests)k
  - ✅ Error handling (5 tests)
- ✅ 97.77% test coverage achieved (32 tests passing)
- ✅ 100% function coverage
- ✅ Issue #2 requirements met

#### Step 3.3: Implement Logger Service ✅ COMPLETE (2025-11-06)
- ✅ Create `src/services/logger.ts`
- ✅ Refactor from existing convert-hashnode.js Logger class
- ✅ Maintain dual output (console + file)
- ✅ Implement log levels (info, success, warn, error)
- ✅ Add 403 error tracking and reporting
- ✅ Implement summary generation with statistics
- ✅ Write unit tests for:
  - ✅ File writing (6 tests)
  - ✅ Log formatting (8 tests)
  - ✅ Error tracking (5 tests)
  - ✅ Summary generation (8 tests)
  - ✅ Duration/timing (4 tests)
  - ✅ Stream lifecycle (6 tests)
  - ✅ Error handling (6 tests)
  - ✅ Verbosity levels (4 tests)
- ✅ 98.85% test coverage achieved (47 tests passing)
- ✅ 100% function coverage
- ✅ Issue #3 requirements met

### Phase 4: Processor Implementation

#### Step 4.1: Implement PostParser Processor ✅ COMPLETE (2025-11-19)
- ✅ Create `src/processors/post-parser.ts`
- ✅ Extract: title, slug, dateAdded, brief, contentMarkdown, coverImage
- ✅ Validate required fields
- ✅ Handle null/undefined cases with defaults
- ✅ Write unit tests with sample posts from fixture data
- ✅ 41 comprehensive unit tests written
- ✅ 100% test coverage achieved (exceeds 90% target)
- ✅ Two-phase validation strategy implemented
- ✅ ISO 8601 date format validation
- ✅ Full JSDoc documentation
- ✅ Pull Request #32 created
- ✅ Issue #4 addressed

#### Step 4.2: Implement MarkdownTransformer Processor ✅ COMPLETE (2025-11-19)
- ✅ Create `src/processors/markdown-transformer.ts` (217 lines)
- ✅ Core transformation: Remove Hashnode align attributes (` align=\"[^\"]*\"`)
- ✅ Optional transformations: Trailing whitespace trimming with hard line break preservation
- ✅ Comprehensive unit tests: 41 tests with 100% coverage
- ✅ Full JSDoc documentation for all public APIs
- ✅ Stateless pure function design with constructor-based configuration
- ✅ Pull Request #34, Issue #5

#### Step 4.3: Implement ImageProcessor Processor ✅ COMPLETE (2025-11-19)
- ✅ Create `src/processors/image-processor.ts`
- ✅ Image hash extraction function from CDN URLs
- ✅ Find all Hashnode CDN image references in markdown
- ✅ Download each image using ImageDownloader service
- ✅ Replace CDN URLs with local relative paths (./filename)
- ✅ Marker-based retry strategy (.marker files)
- ✅ Skip already-downloaded images (.marker file exists)
- ✅ Track permanent HTTP 403 failures (.marker.403 files)
- ✅ Handle download failures gracefully with detailed error tracking
- ✅ Comprehensive unit tests: 44 tests with 98%+ coverage
- ✅ Full JSDoc documentation for all public APIs
- ✅ Configurable download delay for rate limiting
- ✅ Pull Request #35, Issue #6

#### Step 4.4: Implement FrontmatterGenerator Processor ✅ COMPLETE (2025-11-19)
- ✅ Create `src/processors/frontmatter-generator.ts`
- ✅ Generate YAML frontmatter from metadata
- ✅ Handle quote escaping in description
- ✅ Format date as ISO string
- ✅ Handle tags field (comma-separated or array)
- ✅ Write unit tests with various metadata samples
- ✅ Pull Request #36, Issue #7

### Phase 5: Converter Orchestration

#### Step 5.1: Implement Converter Class ✅ COMPLETE (2025-12-04)
- ✅ Create `src/converter.ts`
- ✅ Implement `convertAllPosts()` method:
  - ✅ Read Hashnode export JSON
  - ✅ Loop through posts
  - ✅ Call `convertPost()` for each
  - ✅ Track statistics (converted, skipped, errors)
  - ✅ Return ConversionResult
- ✅ Implement `convertPost()` method:
  - ✅ Check if post already exists (skip if so)
  - ✅ Run through processor pipeline
  - ✅ Write output files
  - ✅ Track errors
  - ✅ Return ConvertedPost
- ✅ Implement event emitters for progress/logging:
  - ✅ `on('conversion-starting', (event) => {})`
  - ✅ `on('conversion-completed', (event) => {})`
  - ✅ `on('image-downloaded', (event) => {})`
  - ✅ `on('conversion-error', (event) => {})`
- ✅ Write integration tests with:
  - ✅ Full conversion pipeline
  - ✅ Sample Hashnode export
  - ✅ Mock filesystem operations
- ✅ 99.27% test coverage achieved (51 tests passing)
- ✅ Pull Request #37, Issue #8

#### Step 5.2: Create Public API Entry Point ✅ COMPLETE (2025-12-04)
- ✅ Updated `src/index.ts` with module-level JSDoc
- ✅ Export:
  - ✅ `Converter` class with static factory methods
  - ✅ All type definitions
  - ✅ Services (ImageDownloader, FileWriter, Logger) with config types
  - ✅ Processors (PostParser, MarkdownTransformer, ImageProcessor, FrontmatterGenerator)
  - ✅ Factory methods: `Converter.fromExportFile()`, `Converter.withProgress()`
- ✅ Additional exports: `ImageDownloadConfig`, `DownloadResult`, `FileWriterConfig`, `FileWriteError`
- ✅ Document usage examples in README.md
- ✅ 313 tests passing with 99.36% coverage

### Phase 6: CLI Implementation

#### Step 6.1: Implement CLI Interface
- Create `src/cli/convert.ts`
- Use commander.js or similar for argument parsing
- Implement command: `convert`
- Arguments:
  - `--export <path>` - Path to Hashnode export JSON
  - `--output <path>` - Output directory for converted posts
  - `--log-file <path>` - Optional log file path
  - `--skip-existing` - Skip posts that already exist
- Implement options parsing and validation
- Call Converter with parsed options
- Display progress and results
- Exit with appropriate status code

#### Step 6.2: Add CLI Entry Point
- Update `package.json` bin field to point to CLI
- Create shell script wrapper if needed
- Test CLI invocation: `npx @alvin/hashnode-content-converter convert --help`

### Phase 7: Testing & Quality

#### Step 7.1: Create Test Fixtures
- Extract sample Hashnode export JSON
- Create sample posts with various markdown formats
- Create mock images for download tests
- Document fixture structure

#### Step 7.2: Write Unit Tests
- Test each processor independently
- Test each service independently
- Mock external dependencies (HTTP, filesystem)
- Aim for 80%+ code coverage
- Include edge cases and error scenarios

#### Step 7.3: Write Integration Tests
- Test full conversion pipeline
- Use temporary directories for output
- Test with fixture data
- Verify file structure and content
- Test error handling and recovery

#### Step 7.4: Setup CI/CD
- Configure GitHub Actions workflow
- Run tests on push/PR
- Check TypeScript compilation
- Check code coverage
- Lint code style

### Phase 8: Documentation & Publishing

#### Step 8.1: Create README
- Project overview
- Installation instructions
- Quick start guide
- CLI usage examples
- Library usage examples
- API documentation
- Migration guide from convert-hashnode.js
- Contributing guidelines

#### Step 8.2: Create CHANGELOG
- Document version history
- List breaking changes
- List new features
- List bug fixes

#### Step 8.3: Create Migration Guide
- Document how to migrate existing blog repo
- Provide setup script
- Document differences from original script
- Document any breaking changes

#### Step 8.4: Prepare npm Publication
- Update package.json metadata
- Add repository field
- Add keywords (hashnode, content, migration, blog)
- Create .npmignore file
- Add license file
- Setup npm access tokens
- Publish to registry

### Phase 9: Integration with Current Blog

#### Step 9.1: Create Migration Script
- Script to:
  1. Create new project directory
  2. Initialize npm package
  3. Add @alvin/hashnode-content-converter as dependency
  4. Copy sample .env or config file
  5. Create usage script
- Make script executable and documented

#### Step 9.2: Update Blog Repository
- Remove convert-hashnode.js (or archive it)
- Update CLAUDE.md with new approach
- Add migration documentation
- Add npm script to run converter
- Update .gitignore if needed

#### Step 9.3: Test Full Migration
- Run migration script
- Verify new package works with current data
- Verify output matches original script
- Document any manual steps needed

## Success Criteria

1. **Functionality** - New package produces identical output to original script
2. **Type Safety** - Full TypeScript with no `any` types in critical paths
3. **Testing** - 80%+ code coverage with unit and integration tests
4. **Documentation** - README, API docs, and migration guide
5. **Usability** - Works as both CLI tool and library
6. **Maintainability** - Clean code with single responsibility principle
7. **Distribution** - Published to npm with proper versioning

## Timeline Estimate

- Phase 1-2: Setup & Types (foundation work)
- Phase 3: Services (parallel with Phase 4)
- Phase 4: Processors (parallel with Phase 3)
- Phase 5: Orchestration
- Phase 6: CLI
- Phase 7: Testing (ongoing throughout)
- Phase 8: Documentation
- Phase 9: Integration & Migration

## Notes

- The package should handle both CLI invocation and programmatic usage
- Services should be independently injectable for testing
- Consider creating a `Converter.fromHashnodeExport()` factory method
- Document the 403 error tracking feature as it's useful for debugging
- Consider adding a `--dry-run` flag to preview changes without writing
- Plan for future extensibility (other export formats, other transformations)
