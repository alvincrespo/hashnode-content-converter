# Phase 5.1: Converter Class Implementation Plan

**Issue**: [#8 - Implement Converter Class](https://github.com/alvincrespo/hashnode-content-converter/issues/8)
**PR**: [#37](https://github.com/alvincrespo/hashnode-content-converter/pull/37)
**Status**: 🔄 IN REVIEW (PR feedback pending)
**Date Started**: 2025-11-25

---

## Overview

Implement the Converter class that orchestrates the full Hashnode content conversion pipeline: PostParser → MarkdownTransformer → ImageProcessor → FrontmatterGenerator → FileWriter. The Converter serves as the main entry point for both CLI and programmatic usage.

**Scope**:
- Implement `convertAllPosts()` and `convertPost()` methods
- Add event emitter support for progress tracking
- Robust error handling with continue-on-failure
- Integration tests with 90%+ coverage

**Reference**: [TRANSITION.md](TRANSITION.md) (lines 366-401)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Class name | `Converter` | Consistency with TRANSITION.md, intuitive for users |
| Event naming | Explicit lifecycle | Clear timing semantics (`-ing` = starting, `-ed` = completed) |
| Logger creation | Always create by default | Matches reference implementation behavior |
| `skipExisting` default | `true` | Matches reference implementation behavior |

---

## Architecture Design

### Class Structure

```typescript
import { EventEmitter } from 'events';

export class Converter extends EventEmitter {
  constructor(options?: ConverterOptions);

  async convertAllPosts(
    exportPath: string,
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConversionResult>;

  async convertPost(
    post: HashnodePost,
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConvertedPost>;
}
```

### Event System

Events with explicit lifecycle naming:
- `'conversion-starting'` - Before each post conversion begins
- `'conversion-completed'` - After each post conversion completes
- `'image-downloaded'` - After each image download attempt
- `'conversion-error'` - When any error occurs during conversion

**Event Type Definitions** (new file: `src/types/converter-events.ts`):

```typescript
export interface ConversionStartingEvent {
  post: HashnodePost;
  index: number;  // 1-based
  total: number;
}

export interface ConversionCompletedEvent {
  result: ConvertedPost;
  index: number;
  total: number;
  durationMs: number;
}

export interface ImageDownloadedEvent {
  filename: string;
  postSlug: string;
  success: boolean;
  error?: string;
  is403?: boolean;
}

export interface ConversionErrorEvent {
  type: 'parse' | 'transform' | 'image' | 'write' | 'fatal';
  slug?: string;
  message: string;
}
```

### Dependency Injection (for testing)

```typescript
interface ConverterDependencies {
  postParser?: PostParser;
  markdownTransformer?: MarkdownTransformer;
  imageProcessor?: ImageProcessor;
  frontmatterGenerator?: FrontmatterGenerator;
  fileWriter?: FileWriter;
  logger?: Logger;
}
```

---

## Error Handling Strategy

### Error Classification

| Error Type | Behavior | Example |
|------------|----------|---------|
| **Fatal** | Throw, halt conversion | Export file not found, invalid JSON |
| **Recoverable** | Log, skip post, continue | PostParser throws, FileWriter fails |
| **Tracked** | Log separately, continue | HTTP 403 image failures |

### Pipeline Error Flow

```
convertAllPosts()
├── loadAndValidateExport() → FATAL on failure
├── ensureOutputDirectory() → FATAL on failure
└── FOR EACH post:
    └── TRY convertPost()
        ├── PostParser.parse() → CATCH → errors.push(), continue
        ├── MarkdownTransformer.transform() → CATCH → errors.push(), continue
        ├── ImageProcessor.process() → RETURNS errors (track 403s)
        ├── FrontmatterGenerator.generate() → never throws
        └── FileWriter.writePost() → CATCH → errors.push(), continue
```

### Key Error Handling Patterns

1. **Extract slug safely** for error tracking even with malformed posts
2. **Create blogDir before ImageProcessor** (it throws if directory doesn't exist)
3. **Track HTTP 403 errors** separately via `Logger.trackHttp403()`
4. **Continue processing** after individual post failures (batch resilience)

---

## Implementation Steps

### Step 1: Create Event Type Definitions
**File**: `src/types/converter-events.ts`
- Define ConversionStartingEvent, ConversionCompletedEvent, ImageDownloadedEvent, ConversionErrorEvent
- Export from `src/index.ts`

### Step 2: Update Converter Class Structure
**File**: `src/converter.ts`
- Extend EventEmitter
- Add constructor with optional dependencies injection
- Add private processor/service instances

### Step 3: Implement Helper Methods
- `loadAndValidateExport(exportPath)` - Read/parse JSON, validate posts array
- `ensureOutputDirectory(outputDir)` - Create if doesn't exist
- `extractSlugSafely(post, index)` - Safe slug extraction for error tracking
- `formatDuration(ms)` - Human-readable duration

### Step 4: Implement convertPost() Method
Pipeline stages:
1. Parse metadata with PostParser
2. Transform markdown with MarkdownTransformer
3. Create post directory (required by ImageProcessor)
4. Process images with ImageProcessor
5. Track 403 errors with Logger
6. Generate frontmatter with FrontmatterGenerator
7. Write file with FileWriter
8. Emit events and return ConvertedPost

### Step 5: Implement convertAllPosts() Method
Orchestration:
1. Load and validate export file
2. Ensure output directory exists
3. Initialize Logger
4. Loop through posts with error isolation
5. Emit progress events
6. Write summary and close logger
7. Return ConversionResult

### Step 6: Write Integration Tests
**File**: `tests/integration/converter.test.ts`

Test categories:
- Constructor & dependency injection (4 tests)
- Happy path conversion (5 tests)
- Skip existing behavior (3 tests)
- Error handling - fatal errors (4 tests)
- Error handling - recoverable errors (6 tests)
- Event emission (5 tests)
- Logger integration (4 tests)
- Statistics accuracy (4 tests)

**Target**: 90%+ coverage

---

## Testing Strategy

### Mocking Approach

```typescript
vi.mock('fs');
vi.mock('./processors/post-parser');
vi.mock('./processors/markdown-transformer');
vi.mock('./processors/image-processor');
vi.mock('./processors/frontmatter-generator');
vi.mock('./services/file-writer');
vi.mock('./services/logger');
```

### Key Test Scenarios

| Category | Test | Expected Behavior |
|----------|------|-------------------|
| Fatal | Export file not found | Throws error |
| Fatal | Invalid JSON | Throws error |
| Fatal | No posts array | Throws error |
| Recoverable | PostParser throws | Log error, skip post, continue |
| Recoverable | FileWriter throws | Log error, skip post, continue |
| Skip | Post exists + skipExisting=true | Increment skipped counter |
| Success | Full pipeline | converted++, emit events |
| Events | Each post | conversion-starting before, conversion-completed after |

---

## Files to Create/Modify

### New Files
- `src/types/converter-events.ts` - Event type definitions

### Modified Files
- `src/converter.ts` - Full implementation (currently stub)
- `src/types/converter-options.ts` - Update `skipExisting` default to `true`
- `src/index.ts` - Export event types
- `tests/integration/converter.test.ts` - Comprehensive tests

---

## Critical Files to Read Before Implementation

1. `src/converter.ts` - Current stub to replace
2. `src/types/conversion-result.ts` - ConversionResult, ConvertedPost interfaces
3. `src/processors/image-processor.ts` - ImageProcessingResult type, error handling pattern
4. `src/services/logger.ts` - Logger API (trackHttp403, writeSummary, close)
5. `src/services/file-writer.ts` - FileWriter API (postExists, writePost)
6. `convert-hashnode.js` - Reference implementation (lines 210-338)
7. `tests/unit/image-processor.test.ts` - Testing patterns with mocks

---

## Success Criteria

- [x] `convertAllPosts()` method fully implemented
- [x] `convertPost()` method fully implemented
- [x] Event emitters for progress/logging working
- [x] Robust error handling (continue on post failure)
- [x] Logger integration (403 tracking, summary)
- [x] 90%+ test coverage (92.70%)
- [x] No `any` types
- [x] Full JSDoc documentation
- [ ] **PR Feedback**: Fix placeholder filenames in `image-downloaded` events

---

## PR Feedback: ImageProcessingResult Refactoring

### Problem

The `image-downloaded` events for successful downloads use placeholder filenames (`image-1`, `image-2`, etc.) instead of actual filenames. This inconsistency exists because:

- Error events use actual filenames from `imageResult.errors[].filename`
- Success events only have access to `imageResult.imagesDownloaded` (a count)

**Current code** ([converter.ts:510-517](../src/converter.ts#L510-L517)):
```typescript
for (let i = 0; i < imageResult.imagesDownloaded; i++) {
  const event: ImageDownloadedEvent = {
    filename: `image-${i + 1}`,  // ❌ Placeholder, not actual filename
    postSlug,
    success: true,
  };
  this.emit('image-downloaded', event);
}
```

### Solution: Breaking Change to ImageProcessingResult

Refactor `ImageProcessingResult` to track actual filenames, not just counts.

**Current Interface** (`src/types/image-processor.ts`):
```typescript
export interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;
  imagesDownloaded: number;    // Just a count
  imagesSkipped: number;       // Just a count
  errors: ImageProcessingError[];
}
```

**New Interface**:
```typescript
export interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;
  imagesDownloaded: string[];        // Array of downloaded filenames
  imagesDownloadedTotal: number;     // Count (for convenience)
  imagesSkipped: string[];           // Array of skipped filenames
  imagesSkippedTotal: number;        // Count (for convenience)
  errors: ImageProcessingError[];
}
```

### Implementation Steps

#### Step 1: Update Type Definition
**File**: `src/types/image-processor.ts`

```typescript
export interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;

  /** Filenames of successfully downloaded images */
  imagesDownloaded: string[];

  /** Count of successfully downloaded images (convenience for imagesDownloaded.length) */
  imagesDownloadedTotal: number;

  /** Filenames of images that already existed (skipped download) */
  imagesSkipped: string[];

  /** Count of skipped images (convenience for imagesSkipped.length) */
  imagesSkippedTotal: number;

  errors: ImageProcessingError[];
}
```

#### Step 2: Update ImageProcessor Implementation
**File**: `src/processors/image-processor.ts`

Changes:
1. Replace `let imagesDownloaded = 0` with `const imagesDownloaded: string[] = []`
2. Replace `let imagesSkipped = 0` with `const imagesSkipped: string[] = []`
3. On successful download: `imagesDownloaded.push(filename)` instead of `imagesDownloaded++`
4. On skip: `imagesSkipped.push(filename)` instead of `imagesSkipped++`
5. Update return statement:
```typescript
return {
  markdown: updatedMarkdown,
  imagesProcessed: imageMatches.length,
  imagesDownloaded,
  imagesDownloadedTotal: imagesDownloaded.length,
  imagesSkipped,
  imagesSkippedTotal: imagesSkipped.length,
  errors,
};
```

#### Step 3: Update Converter to Use Actual Filenames
**File**: `src/converter.ts`

Update `emitImageDownloadedEvents()` method:
```typescript
private emitImageDownloadedEvents(
  imageResult: ImageProcessingResult,
  postSlug: string
): void {
  // Emit success events with actual filenames
  imageResult.imagesDownloaded.forEach((filename) => {
    const event: ImageDownloadedEvent = {
      filename,  // ✅ Actual filename
      postSlug,
      success: true,
    };
    this.emit('image-downloaded', event);
  });

  // Emit error events (unchanged - already has filenames)
  imageResult.errors.forEach((err) => {
    const event: ImageDownloadedEvent = {
      filename: err.filename,
      postSlug,
      success: false,
      error: err.error,
      is403: err.is403,
    };
    this.emit('image-downloaded', event);
  });
}
```

Also update method signature type annotation from inline type to `ImageProcessingResult`.

#### Step 4: Update Tests

**File**: `tests/unit/image-processor.test.ts`
- Update all mock return values to use new shape
- Add tests verifying actual filenames are returned
- Update assertions from `.imagesDownloaded` (number) to `.imagesDownloadedTotal`

**File**: `tests/integration/converter.test.ts`
- Update mock `ImageProcessor.process()` return values
- Update event emission tests to verify actual filenames

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/image-processor.ts` | Add `imagesDownloaded[]`, `imagesDownloadedTotal`, `imagesSkipped[]`, `imagesSkippedTotal` |
| `src/processors/image-processor.ts` | Track filenames in arrays, update return |
| `src/converter.ts` | Update `emitImageDownloadedEvents()` to iterate array |
| `tests/unit/image-processor.test.ts` | Update mocks and assertions |
| `tests/integration/converter.test.ts` | Update mocks and event tests |

### Breaking Change Notice

This is a **breaking change** to the public `ImageProcessingResult` interface. Consumers accessing:
- `result.imagesDownloaded` expecting a `number` must update to `result.imagesDownloadedTotal`
- `result.imagesSkipped` expecting a `number` must update to `result.imagesSkippedTotal`

Since we're pre-1.0, this is acceptable.
