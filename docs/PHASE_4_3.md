# Phase 4.3: ImageProcessor Processor Implementation - Implementation Plan

**Issue**: [#6 - Implement ImageProcessor Processor](https://github.com/alvincrespo/hashnode-content-converter/issues/6)
**Status**: ✅ COMPLETE
**Date Started**: 2025-11-19
**Date Completed**: 2025-11-19
**Pull Request**: TBD

---

## Overview

Phase 4.3 implements the ImageProcessor, a critical component in the content conversion pipeline that handles downloading images from Hashnode's CDN and updating markdown references to use local file paths. This processor extracts image URLs from markdown content, downloads each image to the appropriate blog directory, and replaces CDN URLs with relative local paths.

**Scope**:
- Process markdown images ONLY (cover images handled separately by Converter orchestration)
- Extract image URLs from markdown syntax
- Download images using ImageDownloader service
- Replace CDN URLs with local relative paths
- Skip already-downloaded images
- Track download failures and HTTP 403 errors
- Return detailed processing statistics

**Out of Scope**:
- Cover image processing (Converter's responsibility)
- Image optimization or compression
- WebP conversion
- Alt text validation
- Directory creation (Converter's responsibility)

**Reference**: [TRANSITION.md](TRANSITION.md) (lines 340-352)

**Progress**:
- ✅ COMPLETE Step 1: Create Type Definitions
- ✅ COMPLETE Step 2: Implement Constructor and Configuration
- ✅ COMPLETE Step 3: Implement Image URL Extraction
- ✅ COMPLETE Step 4: Implement Download Loop
- ✅ COMPLETE Step 5: Implement URL Replacement
- ✅ COMPLETE Step 6: Implement Error Handling
- ✅ COMPLETE Step 7: Write Comprehensive Tests

---

## Requirements Summary

From [TRANSITION.md](TRANSITION.md) (lines 340-352):

**Functional Requirements**:
- Extract all image URLs from markdown content
- Download images using ImageDownloader service
- Replace Hashnode CDN URLs with local relative paths (e.g., `./filename.png`)
- Skip images that already exist on disk
- Handle download failures gracefully without blocking conversion
- Track HTTP 403 errors separately (permanent failures)

**Non-Functional Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation for public APIs
- Integration with existing ImageDownloader service (Phase 3.1)
- Structured error reporting for downstream logging

**Key Requirements**:
- 90%+ test coverage target
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Integration with existing architecture
- Service-oriented design (uses ImageDownloader, not direct HTTP)

---

## Architecture Design

### 1. Service API Design

#### Public Interface

```typescript
/**
 * ImageProcessor handles downloading images from Hashnode CDN and updating
 * markdown references to use local file paths.
 *
 * @example
 * ```typescript
 * const processor = new ImageProcessor({
 *   maxRetries: 3,
 *   downloadDelayMs: 200
 * });
 *
 * const result = await processor.process(
 *   markdown,
 *   '/path/to/blog/post-slug'
 * );
 *
 * console.log(`Processed ${result.imagesProcessed} images`);
 * console.log(`Downloaded ${result.imagesDownloaded} new images`);
 * console.log(`Skipped ${result.imagesSkipped} existing images`);
 * console.log(`Encountered ${result.errors.length} errors`);
 * ```
 */
export class ImageProcessor {
  /**
   * Create a new ImageProcessor instance.
   *
   * @param options - Configuration options for image downloading
   */
  constructor(options?: ImageProcessorOptions);

  /**
   * Process markdown content: extract image URLs, download images,
   * and replace CDN URLs with local relative paths.
   *
   * @param markdown - Markdown content from MarkdownTransformer
   * @param blogDir - Absolute path to blog post directory where images should be saved
   * @returns Processing result with updated markdown and statistics
   * @throws {Error} If blogDir doesn't exist or isn't accessible
   *
   * @example
   * ```typescript
   * const result = await processor.process(
   *   '![Image](https://cdn.hashnode.com/.../uuid.png)',
   *   '/blog/my-post'
   * );
   * // result.markdown === '![Image](./uuid.png)'
   * // result.imagesDownloaded === 1
   * ```
   */
  async process(
    markdown: string,
    blogDir: string
  ): Promise<ImageProcessingResult>;
}
```

#### Configuration Interface

```typescript
/**
 * Configuration options for ImageProcessor.
 * These options are passed through to the ImageDownloader service.
 */
export interface ImageProcessorOptions {
  /**
   * Maximum number of retry attempts for failed downloads.
   * Does not apply to HTTP 403 errors (permanent failures).
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay in milliseconds between retry attempts.
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Timeout in milliseconds for each download attempt.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Delay in milliseconds between consecutive downloads.
   * Helps avoid rate limiting from CDN.
   * @default 200
   */
  downloadDelayMs?: number;
}

/**
 * Result of image processing operation.
 * Contains updated markdown and detailed statistics.
 */
export interface ImageProcessingResult {
  /**
   * Markdown content with CDN URLs replaced by local relative paths.
   */
  markdown: string;

  /**
   * Total number of images found in markdown.
   */
  imagesProcessed: number;

  /**
   * Number of images successfully downloaded.
   */
  imagesDownloaded: number;

  /**
   * Number of images that already existed (skipped download).
   */
  imagesSkipped: number;

  /**
   * Errors encountered during processing.
   * Does not include skipped images (those are counted separately).
   */
  errors: ImageProcessingError[];
}

/**
 * Details about an image processing error.
 */
export interface ImageProcessingError {
  /**
   * Filename that failed to download (e.g., "uuid.png").
   */
  filename: string;

  /**
   * Original CDN URL that failed.
   */
  url: string;

  /**
   * Error message describing the failure.
   */
  error: string;

  /**
   * True if this was an HTTP 403 Forbidden error (permanent failure).
   * These should be tracked separately for reporting.
   */
  is403: boolean;
}
```

### 2. Design Patterns

**Pattern 1: Service Composition**
- ImageProcessor delegates HTTP operations to ImageDownloader service
- Follows single responsibility principle
- Testable through dependency injection

**Pattern 2: Stateless Processing**
- No internal state between process() calls
- Pure transformation with side effects (file I/O) isolated
- Configuration set at construction time

**Pattern 3: Structured Error Reporting**
- Errors collected but don't halt processing
- Detailed error metadata for downstream logging
- HTTP 403 errors flagged separately for special handling

**Key Decisions**:
1. **Cover Image Handling**: ImageProcessor handles ONLY markdown images (see Decision 1)
2. **Error Reporting Strategy**: Return structured error data instead of direct Logger integration (see Decision 2)

---

## Technical Approach

### 1. Data Flow

```
Input: Markdown (from MarkdownTransformer)
  ↓
Extract Image URLs (regex: ![alt](https://cdn.hashnode.com/...))
  ↓
For each image URL:
  ├─ Extract filename hash using ImageDownloader.extractHash()
  ├─ Check if file exists in blogDir
  ├─ If exists: skip (increment imagesSkipped)
  ├─ If not exists:
  │   ├─ Download using ImageDownloader.download()
  │   ├─ On success: increment imagesDownloaded
  │   ├─ On failure: collect error (check if 403)
  │   └─ Apply rate limiting delay
  └─ Replace URL with local path (./filename.ext)
  ↓
Return: ImageProcessingResult
  ├─ markdown (with local URLs)
  ├─ imagesProcessed (total found)
  ├─ imagesDownloaded (new downloads)
  ├─ imagesSkipped (already existed)
  └─ errors (failures with metadata)
```

### 2. Implementation Strategy

**Phase 1: Type Definitions**
- Define ImageProcessorOptions
- Define ImageProcessingResult
- Define ImageProcessingError

**Phase 2: Core Implementation**
- Implement constructor with configuration
- Implement image URL extraction regex
- Implement download loop with ImageDownloader integration
- Implement URL replacement logic

**Phase 3: Error Handling**
- Validate blogDir exists and is accessible
- Collect download errors without halting
- Track HTTP 403 errors separately
- Handle edge cases (invalid URLs, extraction failures)

**Phase 4: Testing**
- Unit tests for URL extraction
- Unit tests for URL replacement
- Integration tests with mocked ImageDownloader
- Edge case testing
- Error scenario testing

---

## Implementation Steps

### Step 1: Create Type Definitions

**Status**: 📋 PENDING

**File**: `src/types/image-processor.ts`

**Action**: Create TypeScript interfaces for configuration and results.

**Implementation**:

```typescript
/**
 * Type definitions for ImageProcessor.
 * Separated into dedicated file for reusability.
 */

/**
 * Configuration options for ImageProcessor.
 */
export interface ImageProcessorOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  downloadDelayMs?: number;
}

/**
 * Result of image processing operation.
 */
export interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  errors: ImageProcessingError[];
}

/**
 * Details about an image processing error.
 */
export interface ImageProcessingError {
  filename: string;
  url: string;
  error: string;
  is403: boolean;
}
```

**Priority**: Must complete first (dependencies for Step 2)

---

### Step 2: Implement Constructor and Configuration

**Status**: 📋 PENDING

**File**: `src/processors/image-processor.ts`

**Action**: Set up class structure, constructor, and configuration handling.

**Implementation**:

```typescript
import { ImageDownloader } from '../services/image-downloader';
import type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
} from '../types/image-processor';

export class ImageProcessor {
  private downloader: ImageDownloader;
  private options: Required<ImageProcessorOptions>;

  constructor(options?: ImageProcessorOptions) {
    // Set defaults matching reference implementation
    this.options = {
      maxRetries: options?.maxRetries ?? 3,
      retryDelayMs: options?.retryDelayMs ?? 1000,
      timeoutMs: options?.timeoutMs ?? 30000,
      downloadDelayMs: options?.downloadDelayMs ?? 200, // DECISION 4
    };

    // Create ImageDownloader with configuration
    this.downloader = new ImageDownloader({
      maxRetries: this.options.maxRetries,
      retryDelayMs: this.options.retryDelayMs,
      timeoutMs: this.options.timeoutMs,
      downloadDelayMs: this.options.downloadDelayMs,
    });
  }

  async process(
    markdown: string,
    blogDir: string
  ): Promise<ImageProcessingResult> {
    // Implementation in subsequent steps
    throw new Error('Not implemented');
  }
}
```

**Priority**: Must complete after Step 1

---

### Step 3: Implement Image URL Extraction

**Status**: 📋 PENDING

**File**: `src/processors/image-processor.ts`

**Action**: Extract all Hashnode CDN image URLs from markdown.

**Implementation**:

```typescript
/**
 * Extract all Hashnode CDN image URLs from markdown content.
 *
 * @param markdown - Markdown content to parse
 * @returns Array of [fullMatch, imageUrl] tuples
 *
 * @example
 * ```typescript
 * const matches = this.extractImageUrls('![alt](https://cdn.hashnode.com/.../image.png)');
 * // Returns: [['![alt](https://...)', 'https://...']]
 * ```
 */
private extractImageUrls(markdown: string): Array<[string, string]> {
  // Regex pattern from reference implementation (convert-hashnode.js:245)
  // Matches: ![any-text](https://cdn.hashnode.com/any-path)
  const imageRegex = /!\[[^\]]*\]\((https:\/\/cdn\.hashnode\.com[^\)]+)\)/g;

  const matches: Array<[string, string]> = [];
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(markdown)) !== null) {
    matches.push([match[0], match[1]]);
  }

  return matches;
}
```

**Priority**: Must complete after Step 2

---

### Step 4: Implement Download Loop

**Status**: 📋 PENDING

**File**: `src/processors/image-processor.ts`

**Action**: Download images using ImageDownloader service, handle existing files.

**Implementation**:

```typescript
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper: Get marker file path for tracking download attempts.
 * Markers are stored in .downloaded-markers/ subdirectory.
 */
private getMarkerPath(blogDir: string, filename: string): string {
  const markersDir = path.join(blogDir, '.downloaded-markers');

  // Ensure markers directory exists
  if (!fs.existsSync(markersDir)) {
    fs.mkdirSync(markersDir, { recursive: true });
  }

  return path.join(markersDir, `${filename}.marker`);
}

async process(
  markdown: string,
  blogDir: string
): Promise<ImageProcessingResult> {
  // DECISION 3: Validate directory exists
  if (!fs.existsSync(blogDir)) {
    throw new Error(`Blog directory does not exist: ${blogDir}`);
  }

  const imageMatches = this.extractImageUrls(markdown);
  const errors: ImageProcessingError[] = [];
  let imagesDownloaded = 0;
  let imagesSkipped = 0;
  let updatedMarkdown = markdown;

  for (const [_fullMatch, url] of imageMatches) {
    // Extract filename hash using ImageDownloader static method
    const filename = ImageDownloader.extractHash(url);

    if (!filename) {
      errors.push({
        filename: 'unknown',
        url,
        error: 'Could not extract hash from URL',
        is403: false,
      });
      continue;
    }

    const filepath = path.join(blogDir, filename);

    // DECISION 6: Marker-based retry strategy
    const markerPath = this.getMarkerPath(blogDir, filename);
    const marker403Path = markerPath + '.403';

    // Check if download succeeded previously (file exists + success marker exists)
    if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
      // Verify it's a success marker (empty file or very small)
      const stats = fs.statSync(markerPath);
      if (stats.size === 0) {
        imagesSkipped++;
        // Replace URL since file exists
        updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
        continue;
      }
      // If marker has content, it's a transient failure marker - fall through to retry
    }

    // Check if 403 error occurred previously (permanent failure - don't retry)
    if (fs.existsSync(marker403Path)) {
      imagesSkipped++;
      // Keep CDN URL (shows what's missing in rendered markdown)
      continue;
    }

    // Attempt download (either never attempted OR transient failure from previous run)
    try {
      const result = await this.downloader.download(url, filepath);

      if (result.success) {
        // Success: create empty marker file
        fs.writeFileSync(markerPath, '');
        imagesDownloaded++;
        // Replace URL only on successful download
        updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
      } else if (result.is403) {
        // HTTP 403: permanent failure, create 403 marker (don't retry)
        fs.writeFileSync(marker403Path, result.error || 'HTTP 403 Forbidden');
        errors.push({
          filename,
          url,
          error: result.error || 'HTTP 403 Forbidden',
          is403: true,
        });
        // Keep CDN URL (visible in markdown as missing image)
      } else {
        // Transient failure: create marker with error message (will retry)
        fs.writeFileSync(markerPath, result.error || 'Download failed');
        errors.push({
          filename,
          url,
          error: result.error || 'Download failed',
          is403: false,
        });
        // Keep CDN URL (will retry next run)
      }
    } catch (error) {
      // Unexpected error during download: treat as transient failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      fs.writeFileSync(markerPath, errorMsg);
      errors.push({
        filename,
        url,
        error: errorMsg,
        is403: false,
      });
      // Keep CDN URL (will retry next run)
    }
  }

  // DECISION 5: Return detailed results
  return {
    markdown: updatedMarkdown,
    imagesProcessed: imageMatches.length,
    imagesDownloaded,
    imagesSkipped,
    errors,
  };
}
```

**Priority**: Must complete after Step 3

---

### Step 5: Implement URL Replacement

**Status**: 📋 PENDING

**File**: `src/processors/image-processor.ts`

**Action**: Replace CDN URLs with local relative paths (integrated into Step 4).

**Implementation**:

```typescript
// URL replacement is handled inline during download loop (Step 4)
// Pattern: Replace "https://cdn.hashnode.com/.../uuid.png" with "./uuid.png"

updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
```

**Note**: This step is integrated into Step 4's download loop for efficiency.

**Priority**: Completed as part of Step 4

---

### Step 6: Add JSDoc Documentation

**Status**: 📋 PENDING

**File**: `src/processors/image-processor.ts`

**Action**: Add comprehensive JSDoc comments to all public methods.

**Implementation**:

```typescript
/**
 * ImageProcessor handles downloading images from Hashnode CDN and updating
 * markdown references to use local file paths.
 *
 * This processor:
 * - Extracts image URLs from markdown syntax
 * - Downloads images using the ImageDownloader service
 * - Replaces CDN URLs with local relative paths
 * - Skips already-downloaded images
 * - Tracks download failures and HTTP 403 errors
 *
 * @example
 * ```typescript
 * const processor = new ImageProcessor({
 *   maxRetries: 3,
 *   downloadDelayMs: 200
 * });
 *
 * const result = await processor.process(
 *   markdown,
 *   '/path/to/blog/post-slug'
 * );
 *
 * console.log(`Downloaded ${result.imagesDownloaded} images`);
 * if (result.errors.length > 0) {
 *   const forbidden = result.errors.filter(e => e.is403);
 *   console.log(`HTTP 403 errors: ${forbidden.length}`);
 * }
 * ```
 */
export class ImageProcessor {
  // ... (JSDoc for all methods)
}
```

**Priority**: Can be done in parallel with implementation

---

### Step 7: Export Types and Class

**Status**: 📋 PENDING

**File**: `src/index.ts`

**Action**: Export ImageProcessor and related types from main entry point.

**Implementation**:

```typescript
// Add to src/index.ts
export {
  ImageProcessor,
} from './processors/image-processor';

export type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
} from './types/image-processor';
```

**Priority**: Final step before testing

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/image-processor.test.ts`

**Test Categories**:

#### Category 1: Constructor and Configuration (4 tests)
- ✅ Creates instance with default options
- ✅ Creates instance with custom options
- ✅ Sets downloadDelayMs default to 200ms
- ✅ Passes options to ImageDownloader correctly

#### Category 2: Image URL Extraction (8 tests)
- ✅ Extracts single image URL
- ✅ Extracts multiple image URLs
- ✅ Handles markdown with no images (returns empty array)
- ✅ Handles image URLs with query parameters
- ✅ Ignores non-Hashnode CDN URLs
- ✅ Handles images with various alt text formats
- ✅ Handles escaped brackets in alt text
- ✅ Handles images with special characters in URLs

#### Category 3: Successful Image Processing (6 tests)
- ✅ Downloads new image successfully
- ✅ Replaces CDN URL with local path
- ✅ Returns correct statistics (processed, downloaded, skipped)
- ✅ Processes multiple images in one pass
- ✅ Applies rate limiting delay between downloads
- ✅ Uses ImageDownloader.extractHash() for filename

#### Category 4: Already-Downloaded Images (4 tests)
- ✅ Skips download if file and success marker both exist
- ✅ Increments imagesSkipped counter
- ✅ Replaces URL with local path for successfully downloaded images
- ✅ Mixes new downloads and skipped images correctly

#### Category 5: Error Handling (10 tests)
- ✅ Continues processing after download failure
- ✅ Tracks HTTP 403 errors separately (is403: true)
- ✅ Tracks other errors with is403: false
- ✅ Includes error details (filename, url, error message)
- ✅ Handles invalid URL (no extractable hash)
- ✅ Handles ImageDownloader throwing exception
- ✅ Throws error if blogDir doesn't exist
- ✅ Keeps CDN URLs for failed downloads (not replaced with local paths)
- ✅ Collects all errors without halting
- ✅ Returns errors array with correct structure

#### Category 6: Edge Cases (6 tests)
- ✅ Handles empty markdown string
- ✅ Handles markdown with no Hashnode images
- ✅ Handles malformed image syntax (doesn't crash)
- ✅ Handles very long markdown content
- ✅ Handles duplicate image URLs (processes once)
- ✅ Validates input types (throws on non-string markdown)

#### Category 7: Integration with ImageDownloader (5 tests)
- ✅ Calls ImageDownloader.download() with correct arguments
- ✅ Respects maxRetries configuration
- ✅ Respects timeoutMs configuration
- ✅ Respects downloadDelayMs configuration
- ✅ Uses ImageDownloader.extractHash() static method

#### Category 8: Marker-Based Retry Logic (8 tests)
- ✅ Creates .downloaded-markers/ directory if it doesn't exist
- ✅ Creates empty marker file after successful download
- ✅ Creates 403 marker file (.marker.403) for HTTP 403 errors
- ✅ Creates error marker file with error message for transient failures
- ✅ Skips download if success marker and file both exist
- ✅ Retries download if error marker exists (transient failure from previous run)
- ✅ Skips retry if 403 marker exists (permanent failure)
- ✅ Replaces URL only on successful download (keeps CDN URL for failures)

**Total Tests**: ~51 tests (targeting 90%+ coverage)

### 2. Test Coverage Targets

Following project standards:

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥90% | All code paths exercised |
| **Branches** | ≥90% | All conditions tested |
| **Functions** | ≥90% | All methods covered |
| **Lines** | ≥90% | Complete line coverage |

**Expected Results**: Based on similar processors (PostParser: 100%, MarkdownTransformer: 100%), should achieve 95%+ coverage with comprehensive test suite.

### 3. Mock Strategy

**ImageDownloader Mocking**:
```typescript
import { vi } from 'vitest';
import { ImageDownloader } from '../../src/services/image-downloader';

// Mock the download method
vi.spyOn(ImageDownloader.prototype, 'download').mockResolvedValue({
  success: true,
  is403: false,
});

// Mock the static extractHash method
vi.spyOn(ImageDownloader, 'extractHash').mockReturnValue('uuid.png');
```

**Filesystem Mocking**:
```typescript
import * as fs from 'fs';

vi.spyOn(fs, 'existsSync').mockReturnValue(false); // File doesn't exist
vi.spyOn(fs, 'existsSync').mockReturnValue(true);  // File exists
```

---

## Integration Points

### 1. Upstream (Input)
- **Source**: MarkdownTransformer processor
- **Input Type**: `string` (cleaned markdown content)
- **Integration Pattern**:
  ```typescript
  // In Converter.convertPost()
  const cleanedMarkdown = markdownTransformer.transform(rawMarkdown);
  const imageResult = await imageProcessor.process(cleanedMarkdown, blogDir);
  ```

### 2. Downstream (Output)
- **Output Type**: `ImageProcessingResult`
  - `markdown: string` → passed to FrontmatterGenerator
  - `errors: ImageProcessingError[]` → passed to Logger for tracking
- **Next Stage**: FrontmatterGenerator processor
- **Integration Pattern**:
  ```typescript
  // In Converter.convertPost()
  const imageResult = await imageProcessor.process(markdown, blogDir);

  // Pass markdown to next processor
  const frontmatter = frontmatterGenerator.generate(metadata);
  const finalMarkdown = frontmatter + '\n\n' + imageResult.markdown;

  // Log errors
  for (const error of imageResult.errors) {
    if (error.is403) {
      logger.trackHttp403(slug, error.filename, error.url);
    } else {
      logger.warn(`Failed to download ${error.filename}: ${error.error}`);
    }
  }
  ```

### 3. Service Dependencies
- **ImageDownloader Service**:
  - Used for: HTTP downloads, hash extraction, redirect handling, retry logic
  - Integration: Constructor injection via `new ImageDownloader(options)`
  - Methods used: `download(url, filepath)`, `extractHash(url)` (static)

### 4. Error Flow
- **Error Handling**: DECISION 2 - Return structured error data
  ```typescript
  interface ImageProcessingError {
    filename: string;
    url: string;
    error: string;
    is403: boolean;  // Flag for Logger to track separately
  }
  ```
- **Error Tracking**: Converter receives errors and passes to Logger
  ```typescript
  // Converter responsibility
  if (error.is403) {
    logger.trackHttp403(slug, error.filename, error.url);
  } else {
    logger.warn(`Image download failed: ${error.error}`);
  }
  ```

### 5. Converter Responsibilities

The Converter orchestrator must handle certain aspects related to marker-based retry logic:

**Directory Creation**:
- **Responsibility**: Converter must create the blog post directory (`blogDir`) before calling ImageProcessor
- **Reason**: ImageProcessor validates directory exists (DECISION 3) and will throw if missing
- **Pattern**:
  ```typescript
  // In Converter.convertPost()
  const blogDir = path.join(outputDir, slug);
  await fileWriter.ensureDirectoryExists(blogDir);

  // Now safe to call ImageProcessor
  const imageResult = await imageProcessor.process(markdown, blogDir);
  ```

**Marker Directory Cleanup** (Optional):
- **User-Facing Feature**: Provide option to clear markers and force re-download
- **Implementation Ideas**:
  - CLI flag: `--retry-failed-images` (deletes non-403 markers)
  - CLI flag: `--force-redownload-images` (deletes all markers)
  - Documented manual approach: `rm -rf blog/post-slug/.downloaded-markers/`
- **Pattern**:
  ```typescript
  // Optional: Clear markers before conversion
  if (options.retryFailedImages) {
    const markersDir = path.join(blogDir, '.downloaded-markers');
    if (fs.existsSync(markersDir)) {
      // Delete non-403 markers (retry transient failures)
      const markers = fs.readdirSync(markersDir);
      markers.forEach(marker => {
        if (!marker.endsWith('.403')) {
          fs.unlinkSync(path.join(markersDir, marker));
        }
      });
    }
  }
  ```

**Failed Image Reporting**:
- **Responsibility**: Report which images failed and whether they're permanent (403) or transient
- **Reason**: Helps users understand what needs manual intervention
- **Pattern**:
  ```typescript
  const imageResult = await imageProcessor.process(markdown, blogDir);

  if (imageResult.errors.length > 0) {
    const permanent = imageResult.errors.filter(e => e.is403);
    const transient = imageResult.errors.filter(e => !e.is403);

    if (permanent.length > 0) {
      logger.warn(`${permanent.length} images have permanent 403 errors (won't retry)`);
    }
    if (transient.length > 0) {
      logger.info(`${transient.length} images failed transiently (will retry on re-run)`);
    }
  }
  ```

**Marker Directory in .gitignore**:
- **Documentation Note**: Users should add `.downloaded-markers/` to `.gitignore`
- **Reason**: Markers are local conversion state, not content to be versioned
- **Example .gitignore**:
  ```gitignore
  # Hashnode converter markers (local conversion state)
  blog/**/.downloaded-markers/
  ```

---

## Architectural Decisions

### Decision 1: Cover Image Handling

**Question**: Should ImageProcessor handle cover images, or is that Converter's responsibility?

**Analysis**:

**Arguments FOR ImageProcessor handling covers:**
- Single place for all image downloading
- Consistent error handling for all images
- Simpler Converter logic

**Arguments AGAINST ImageProcessor handling covers:**
- Cover images aren't in markdown (different input source)
- Cover images have different naming convention (`cover.ext` vs UUID)
- Violates single responsibility (processor should process markdown only)
- Would require passing additional parameters (coverUrl, slug)

**IMPLEMENTATION DECISION: ImageProcessor handles ONLY markdown images**

**Rationale**:
1. **Single Responsibility**: ImageProcessor's job is to transform markdown content, not orchestrate all image downloads
2. **Type Safety**: Cover image URL comes from `PostMetadata`, not markdown - different data source
3. **Flexibility**: Converter can choose to skip cover download, use different logic, etc.
4. **Cleaner API**: `process(markdown, blogDir)` is simpler than `process(markdown, blogDir, coverUrl?, slug?)`
5. **Reference Implementation**: Original script separates cover download logic (lines 284-309)

**Implementation**:
```typescript
// ImageProcessor - handles markdown images only
class ImageProcessor {
  async process(markdown: string, blogDir: string): Promise<ImageProcessingResult>
}

// Converter - orchestrates cover image separately
class Converter {
  async convertPost(post: HashnodePost, outputDir: string): Promise<ConvertedPost> {
    // ... parse post, transform markdown

    // Process markdown images
    const imageResult = await imageProcessor.process(markdown, blogDir);

    // Download cover image separately
    if (metadata.coverImage) {
      await this.downloadCoverImage(metadata.coverImage, blogDir, metadata.slug);
    }

    // ... continue conversion
  }
}
```

**When to revisit**: If we add support for other image sources (e.g., embedded content) that also need processing, consider extracting a generic ImageService.

---

### Decision 2: Error Tracking Integration

**Question**: How should ImageProcessor report HTTP 403 errors and other failures?

**Analysis**:

**Option A: Accept Logger instance in constructor**
```typescript
class ImageProcessor {
  constructor(private logger: Logger, options?: ImageProcessorOptions)

  async process(markdown: string, blogDir: string): Promise<string> {
    // ... download fails
    this.logger.trackHttp403(slug, filename, url); // Problem: needs slug!
  }
}
```
- **Pros**: Direct error tracking, no need for Converter to handle errors
- **Cons**: Tight coupling to Logger, requires slug parameter, harder to test

**Option B: Return structured error data (errors array)**
```typescript
class ImageProcessor {
  async process(markdown: string, blogDir: string): Promise<ImageProcessingResult> {
    return {
      markdown,
      errors: [{ filename, url, error, is403: true }]
    };
  }
}
```
- **Pros**: Separation of concerns, testable, no Logger dependency, no slug needed
- **Cons**: Converter must handle error reporting

**Option C: Use event emitters**
```typescript
class ImageProcessor extends EventEmitter {
  async process(markdown: string, blogDir: string): Promise<string> {
    this.emit('error', { filename, url, is403 });
  }
}
```
- **Pros**: Flexible, can have multiple listeners
- **Cons**: More complex, harder to test, overkill for this use case

**IMPLEMENTATION DECISION: Return structured error data (Option B)**

**Rationale**:
1. **Separation of Concerns**: ImageProcessor doesn't need to know about Logger or how errors are reported
2. **Testability**: Easy to verify errors are collected without mocking Logger
3. **Flexibility**: Converter can choose how to report errors (console, file, both)
4. **Type Safety**: Errors are part of return type, compiler enforces handling
5. **No Slug Required**: ImageProcessor doesn't need post-specific metadata

**Implementation**:
```typescript
// ImageProcessor returns errors
interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  errors: Array<{
    filename: string;
    url: string;
    error: string;
    is403: boolean;
  }>;
}

// Converter handles error reporting
const result = await imageProcessor.process(markdown, blogDir);
for (const error of result.errors) {
  if (error.is403) {
    logger.trackHttp403(slug, error.filename, error.url);
  } else {
    logger.warn(`Failed to download ${error.filename}: ${error.error}`);
  }
}
```

**When to revisit**: If we add real-time progress tracking or need to stream errors for very large conversions.

---

### Decision 3: Directory Creation Responsibility

**Question**: Should ImageProcessor create the blogDir if it doesn't exist?

**Analysis**:

**Option A: ImageProcessor creates directory**
```typescript
async process(markdown: string, blogDir: string): Promise<ImageProcessingResult> {
  await fs.promises.mkdir(blogDir, { recursive: true });
  // ... download images
}
```
- **Pros**: Convenient, fewer errors from missing directories
- **Cons**: Violates single responsibility, needs FileWriter service dependency

**Option B: Assume directory exists, validate and throw**
```typescript
async process(markdown: string, blogDir: string): Promise<ImageProcessingResult> {
  if (!fs.existsSync(blogDir)) {
    throw new Error(`Blog directory does not exist: ${blogDir}`);
  }
  // ... download images
}
```
- **Pros**: Clear responsibility, fail fast on misconfiguration
- **Cons**: Converter must create directory first

**IMPLEMENTATION DECISION: Assume directory exists, validate and throw (Option B)**

**Rationale**:
1. **Single Responsibility**: Converter orchestrates file structure, ImageProcessor processes content
2. **Fail Fast**: If directory is missing, it indicates a bug in Converter - better to fail loudly
3. **No Service Dependency**: Doesn't need FileWriter service
4. **Clear Contract**: API documentation clearly states blogDir must exist
5. **Reference Pattern**: FileWriter service (Phase 3.2) validates paths but doesn't create parent directories

**Implementation**:
```typescript
async process(markdown: string, blogDir: string): Promise<ImageProcessingResult> {
  // Validate directory exists
  if (!fs.existsSync(blogDir)) {
    throw new Error(
      `Blog directory does not exist: ${blogDir}. ` +
      `Ensure Converter creates the directory before calling ImageProcessor.`
    );
  }

  // ... continue processing
}

// In Converter
await fileWriter.writePost(blogDir, slug, markdown); // Creates directory
const imageResult = await imageProcessor.process(markdown, blogDir); // Directory exists
```

**When to revisit**: If we add a "dry run" mode that processes without writing files, directory validation would need to be optional.

---

### Decision 4: Rate Limiting Configuration

**Question**: What's the appropriate default delay between downloads?

**Analysis**:

**Option A: No delay (0ms)**
- **Pros**: Fastest conversion
- **Cons**: Risk of rate limiting from CDN, aggressive on server

**Option B: 100ms delay**
- **Pros**: Fast, minimal rate limiting risk
- **Cons**: Arbitrary value, not based on reference implementation

**Option C: 200ms delay**
- **Pros**: Matches reference implementation (convert-hashnode.js:283)
- **Cons**: Slower for large image sets

**Option D: 500ms delay**
- **Pros**: Very safe from rate limiting
- **Cons**: Unnecessarily slow

**IMPLEMENTATION DECISION: 200ms delay (Option C), fully configurable**

**Rationale**:
1. **Reference Implementation**: Original script uses 200ms (`IMAGE_DOWNLOAD_DELAY_MS = 200`)
2. **Proven in Production**: This value has worked reliably for real Hashnode exports
3. **Configurable**: Users can override if they need faster/slower downloads
4. **Balance**: Fast enough for typical posts (5-10 images = 1-2s overhead), safe from rate limiting
5. **CDN-Friendly**: Respectful of Hashnode's infrastructure

**Implementation**:
```typescript
export interface ImageProcessorOptions {
  /**
   * Delay in milliseconds between consecutive downloads.
   * Helps avoid rate limiting from CDN.
   * @default 200 (matches reference implementation)
   */
  downloadDelayMs?: number;
}

constructor(options?: ImageProcessorOptions) {
  this.options = {
    // ... other options
    downloadDelayMs: options?.downloadDelayMs ?? 200,
  };
}
```

**When to revisit**: If Hashnode CDN implements rate limiting, adjust default upward. If downloads are too slow, users can configure `downloadDelayMs: 0`.

---

### Decision 5: Return Type Design

**Question**: Should process() return just the transformed markdown, or detailed results?

**Analysis**:

**Option A: Return only markdown (simple)**
```typescript
async process(markdown: string, blogDir: string): Promise<string>
```
- **Pros**: Simple API, matches MarkdownTransformer pattern
- **Cons**: No statistics, no error details, harder to debug

**Option B: Return detailed result object**
```typescript
interface ImageProcessingResult {
  markdown: string;
  imagesProcessed: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  errors: ImageProcessingError[];
}

async process(markdown: string, blogDir: string): Promise<ImageProcessingResult>
```
- **Pros**: Rich statistics for logging, error tracking, progress reporting
- **Cons**: Slightly more complex API, Converter must extract markdown

**IMPLEMENTATION DECISION: Return ImageProcessingResult (Option B)**

**Rationale**:
1. **Better Logging**: Converter can report "Downloaded 5 images, skipped 2, failed 1"
2. **Error Tracking**: Detailed error information for Logger integration
3. **Debugging**: Statistics help troubleshoot conversion issues
4. **User Experience**: Progress reporting shows which images succeeded/failed
5. **Reference Implementation**: Original script logs detailed statistics (lines 261, 266, 272, 276)

**Implementation**:
```typescript
const result = await imageProcessor.process(markdown, blogDir);

logger.info(`Images: ${result.imagesProcessed} total, ${result.imagesDownloaded} downloaded, ${result.imagesSkipped} skipped`);

if (result.errors.length > 0) {
  logger.warn(`Image download failures: ${result.errors.length}`);
  for (const error of result.errors) {
    if (error.is403) {
      logger.trackHttp403(slug, error.filename, error.url);
    }
  }
}

// Use the transformed markdown
const frontmatter = frontmatterGenerator.generate(metadata);
const finalMarkdown = frontmatter + '\n\n' + result.markdown;
```

**When to revisit**: Never - this is a clear win with minimal downside. The slightly more complex API is worth the debugging and UX benefits.

---

### Decision 6: Download Retry Strategy

**Question**: How should the processor handle re-processing posts with previously failed image downloads?

**Analysis**:

**The Core Problem**:
Without explicit tracking, re-running a conversion on a post with failed images creates ambiguity:
- Can't distinguish "never attempted" from "previously failed"
- Can't distinguish "permanent 403 failure" from "transient network error"
- Either waste time retrying permanent failures OR lose ability to retry transient failures

**Option A: Always replace URLs (current naive approach)**
```typescript
// Always replace CDN URL with local path, even on failure
updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
```
- **Pros**: Simple, consistent URL structure
- **Cons**: Breaks idempotency, can't distinguish failed from not-attempted, retries permanent failures

**Option B: Only replace URLs on success (simple)**
```typescript
if (downloadSuccess) {
  updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
}
// Failed images keep CDN URLs
```
- **Pros**: Very simple, failed images visible as CDN links
- **Cons**: Can't distinguish 403 (don't retry) from network error (should retry), retries all failures every run

**Option C: Marker-based tracking (intelligent)**
```typescript
// Track attempts with marker files in .downloaded-markers/
// - Success: empty .marker file
// - 403: .marker.403 file (don't retry)
// - Transient: .marker file with error (retry next run)

if (fs.existsSync(markerPath) && stats.size === 0) {
  // Successfully downloaded previously
} else if (fs.existsSync(marker403Path)) {
  // Permanent 403 failure, skip retry
} else {
  // Never attempted OR transient failure, attempt download
}
```
- **Pros**: Intelligent retry, idempotent, skips permanent failures, diagnostic value
- **Cons**: More complex, creates marker directory, slight I/O overhead

**Option D: Failure manifest file**
```typescript
// Track all failures in .image-failures.json with timestamps and attempt counts
```
- **Pros**: Explicit audit trail, queryable
- **Cons**: Most complex, duplicates error tracking, overkill for simple use case

**IMPLEMENTATION DECISION: Marker-based tracking (Option C)**

**Rationale**:
1. **Solves Idempotency Problem**: Re-runs can distinguish between never-attempted and previously-failed images
2. **Intelligent Retry**: Skips permanent 403 errors (saves time), retries transient failures (improves reliability)
3. **Visible Failures**: Failed images keep CDN URLs in markdown, showing what's missing
4. **Diagnostic Value**: Markers provide audit trail of download attempts without parsing logs
5. **User Control**: Can delete markers to force full re-download, or delete specific markers to retry select images
6. **Minimal API Impact**: No changes to public API, all logic internal to ImageProcessor
7. **Production-Proven Pattern**: Similar to package manager lock files (npm, cargo) and build caches (webpack, vite)

**Implementation**:
```typescript
class ImageProcessor {
  /**
   * Get path to marker file for tracking download status.
   * Creates .downloaded-markers/ directory if it doesn't exist.
   */
  private getMarkerPath(blogDir: string, filename: string): string {
    const markersDir = path.join(blogDir, '.downloaded-markers');
    if (!fs.existsSync(markersDir)) {
      fs.mkdirSync(markersDir, { recursive: true });
    }
    return path.join(markersDir, `${filename}.marker`);
  }

  async process(markdown: string, blogDir: string): Promise<ImageProcessingResult> {
    // ... extract URLs ...

    for (const [_, url] of imageMatches) {
      const filename = ImageDownloader.extractHash(url);
      const filepath = path.join(blogDir, filename);
      const markerPath = this.getMarkerPath(blogDir, filename);
      const marker403Path = markerPath + '.403';

      // Check if successfully downloaded (file + empty marker)
      if (fs.existsSync(filepath) && fs.existsSync(markerPath) &&
          fs.statSync(markerPath).size === 0) {
        imagesSkipped++;
        updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
        continue;
      }

      // Check if 403 error (permanent - don't retry)
      if (fs.existsSync(marker403Path)) {
        imagesSkipped++;
        continue; // Keep CDN URL
      }

      // Attempt download (never tried OR transient failure)
      const result = await this.downloader.download(url, filepath);

      if (result.success) {
        fs.writeFileSync(markerPath, ''); // Empty = success
        updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
      } else if (result.is403) {
        fs.writeFileSync(marker403Path, result.error);
        // Keep CDN URL
      } else {
        fs.writeFileSync(markerPath, result.error);
        // Keep CDN URL (retry next run)
      }
    }
  }
}
```

**Directory Structure**:
```
blog/my-post-slug/
├── index.md (markdown with local paths for successful, CDN URLs for failed)
├── a1b2c3d4.png (successfully downloaded image)
├── e5f6g7h8.png (successfully downloaded image)
└── .downloaded-markers/
    ├── a1b2c3d4.png.marker (empty file = success)
    ├── e5f6g7h8.png.marker (empty file = success)
    ├── x9y8z7w6.png.marker (contains "timeout" = transient, will retry)
    └── i5j4k3l2.png.marker.403 (contains "HTTP 403" = permanent, skip)
```

**User Workflows**:
```bash
# Retry all images (force re-download)
rm -rf blog/my-post/.downloaded-markers/

# Retry only transient failures (keep 403 markers)
find blog/my-post/.downloaded-markers/ -name "*.marker" -delete
# (keeps .marker.403 files)

# Skip retrying (keep all markers)
# Just re-run conversion - markers prevent redundant downloads
```

**When to revisit**: If marker files cause operational issues (disk space, cleanup complexity) or if users request more sophisticated retry policies (exponential backoff, attempt limits).

---

## Potential Challenges & Solutions

### Challenge 1: Idempotent Re-Processing of Failed Downloads

**Issue**: When image downloads fail (network errors, timeouts, etc.), re-running the conversion must be able to distinguish between "never attempted" and "previously failed" images to enable intelligent retry logic.

**The Problem**:
- If URLs are replaced with local paths even on failure, the markdown shows `./uuid.png` for non-existent files
- On re-run, `fs.existsSync()` returns false for both "never attempted" and "previously failed" images
- No way to distinguish HTTP 403 (permanent failure, don't retry) from network timeout (transient, should retry)
- Every re-run wastes time retrying permanent failures

**Example Scenario**:
```
Run 1:
  Image A: Downloaded ✓ → URL: ./a.png → file exists
  Image B: Failed (HTTP 403) → URL: ./b.png → file NOT exists (but should never retry)
  Image C: Failed (timeout) → URL: ./c.png → file NOT exists (should retry)

Run 2 (re-run same post):
  Image A: fs.existsSync('./a.png') = true → skip ✓
  Image B: fs.existsSync('./b.png') = false → retry ✗ (waste time on permanent failure)
  Image C: fs.existsSync('./c.png') = false → retry ✓ (good, transient might succeed now)

Problem: Can't distinguish B (don't retry) from C (should retry)
```

**Solution: Marker-Based Download Tracking**:

1. **Create marker directory** (`.downloaded-markers/`) in each blog post directory
2. **Track download attempts** with marker files:
   - **Success**: Empty `.marker` file (e.g., `uuid.png.marker`)
   - **Transient failure**: `.marker` file with error message
   - **Permanent failure (403)**: `.marker.403` file

3. **Check markers before downloading**:
   ```typescript
   const markerPath = path.join(blogDir, '.downloaded-markers', `${filename}.marker`);
   const marker403 = markerPath + '.403';

   if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
     // Downloaded successfully previously → skip
     imagesSkipped++;
   } else if (fs.existsSync(marker403)) {
     // HTTP 403 previously → skip (permanent failure)
     imagesSkipped++;
   } else {
     // Never attempted OR transient failure → attempt download
     await downloadImage(url, filepath);
   }
   ```

4. **Create appropriate markers**:
   ```typescript
   if (downloadSuccess) {
     fs.writeFileSync(markerPath, ''); // Empty = success
     updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
   } else if (result.is403) {
     fs.writeFileSync(marker403, result.error); // Mark as permanent failure
     // Keep CDN URL (shows what's missing)
   } else {
     fs.writeFileSync(markerPath, result.error); // Mark as attempted
     // Keep CDN URL (will retry next run)
   }
   ```

**Benefits**:
- ✅ **Intelligent retry**: Only retries transient failures, skips permanent 403s
- ✅ **Idempotent**: Re-runs are safe and efficient
- ✅ **Visible failures**: CDN URLs remain in markdown for failed images
- ✅ **Diagnostic**: Markers show download history and error messages
- ✅ **User control**: Can delete markers to force re-download

**Trade-offs**:
- ⚠️ **Extra files**: Creates `.downloaded-markers/` directory with marker files (~1 per image)
- ⚠️ **CDN URLs visible**: Failed images show external CDN links (not broken local paths)
- ⚠️ **Complexity**: More nuanced state machine than always-replace approach

**Risk Level**: Medium (implementation complexity) → Low (with comprehensive testing)

---

### Challenge 2: Malformed or Invalid URLs

**Issue**: Some Hashnode exports may have malformed URLs that don't match expected pattern.

**Solution**:
- Validate URL before extraction attempt
- Handle `extractHash()` returning null gracefully
- Log warning but continue processing
- Track extraction failures in errors array

**Risk Level**: Low (graceful degradation)

**Implementation**:
```typescript
const filename = ImageDownloader.extractHash(url);
if (!filename) {
  errors.push({
    filename: 'unknown',
    url,
    error: 'Could not extract hash from URL',
    is403: false,
  });
  continue; // Skip this image, process next
}
```

---

### Challenge 3: Disk Space Exhaustion

**Issue**: Downloading many large images could fill disk.

**Solution**:
- Not ImageProcessor's responsibility (Converter should check disk space)
- Let filesystem errors bubble up naturally
- Converter can catch and report disk space errors
- Future enhancement: add disk space check before download

**Risk Level**: Low (operational concern, not implementation concern)

---

### Challenge 4: Duplicate Image URLs

**Issue**: Same image URL appearing multiple times in markdown.

**Solution**:
- Process each occurrence independently (simplest approach)
- File existence check prevents re-downloading
- URL replacement works correctly for all occurrences
- Alternative: deduplicate URLs before processing (optimization for future)

**Risk Level**: Low (file existence check handles this naturally)

**Implementation**:
```typescript
// First occurrence
if (fs.existsSync(filepath)) {
  imagesSkipped++; // File already exists
}

// Second occurrence of same URL
if (fs.existsSync(filepath)) {
  imagesSkipped++; // File still exists (from first occurrence or previous run)
}

// Both URLs get replaced correctly
```

---

### Challenge 5: Very Long URLs or Filenames

**Issue**: Some CDN URLs may have very long query parameters or paths.

**Solution**:
- `extractHash()` only extracts UUID portion (fixed length)
- Filesystem path length limits handled by OS
- If hash extraction fails, track as error and continue

**Risk Level**: Very Low (UUID format is predictable and short)

---

## Verification Checklist

### Pre-Implementation Checklist
- [ ] GitHub Issue #6 created
- [ ] Type definitions understood (ImageProcessingResult, ImageProcessingError)
- [ ] Reference implementation analyzed (convert-hashnode.js lines 244-309)
- [ ] ImageDownloader service API reviewed (Phase 3.1)
- [ ] Test fixture data reviewed (sample-hashnode-export.json)
- [ ] Implementation patterns from PostParser/MarkdownTransformer studied

### Implementation Verification

```bash
# Verify TypeScript compilation
nvm use $(cat .node-version) && npm run type-check
# Expected: ✅ No TypeScript errors

# Verify build succeeds
nvm use $(cat .node-version) && npm run build
# Expected: ✅ Clean build to dist/

# Run tests
nvm use $(cat .node-version) && npm test
# Expected: ✅ All tests passing

# Generate coverage report
nvm use $(cat .node-version) && npm run test:coverage
# Expected: ✅ 90%+ coverage across all metrics
```

### Verification Table (Actual Results)

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript compilation | TBD | No type errors |
| Build process | TBD | Clean build output |
| Unit tests passing | TBD | All ~43 tests pass |
| Statement coverage ≥90% | TBD | Target: 95%+ |
| Branch coverage ≥90% | TBD | Target: 95%+ |
| Function coverage ≥90% | TBD | Target: 100% |
| Line coverage ≥90% | TBD | Target: 95%+ |
| No `any` types used | TBD | Full type safety |
| JSDoc documentation | TBD | Complete for public APIs |

---

## Success Criteria

### Functional Requirements
- ✅ Extracts all Hashnode CDN image URLs from markdown
- ✅ Downloads images using ImageDownloader service
- ✅ Replaces CDN URLs with local relative paths (./filename.ext)
- ✅ Skips images that already exist on disk
- ✅ Handles download failures without blocking conversion
- ✅ Tracks HTTP 403 errors separately in error metadata
- ✅ Returns detailed processing statistics

### Non-Functional Requirements
- ✅ 90%+ test coverage (targeting 95%+)
- ✅ Response time: <5 seconds for typical post (10 images)
- ✅ Memory efficient: processes images sequentially
- ✅ Configurable rate limiting (default 200ms)

### Code Quality Requirements
- ✅ Zero `any` types in implementation
- ✅ Full JSDoc documentation for public APIs
- ✅ Comprehensive inline comments for complex logic
- ✅ Error messages include actionable context
- ✅ Follows established patterns from PostParser/MarkdownTransformer

### Integration Requirements
- ✅ Exports properly defined in src/index.ts
- ✅ Integrates with ImageDownloader service (Phase 3.1)
- ✅ Compatible with MarkdownTransformer output (Phase 4.2)
- ✅ Output ready for FrontmatterGenerator (Phase 4.4)
- ✅ Error format compatible with Logger service (Phase 3.3)

---

## Reference Implementation Comparison

### Original Script (convert-hashnode.js)

**Lines 244-282**: Main image processing logic

```javascript
// Original: Tightly coupled, untyped
const imageRegex = /!\[[^\]]*\]\((https:\/\/cdn\.hashnode\.com[^\)]+)\)/g;
const matches = [...fixedContent.matchAll(imageRegex)];

for (const match of matches) {
  const url = match[1];
  const filename = extractHash(url);

  if (!filename) {
    logger.warn(`Could not extract hash from: ${url}`);
    continue;
  }

  const filepath = path.join(blogDir, filename);

  if (fs.existsSync(filepath)) {
    logger.success(`✓ Image already exists: ${filename}`);
  } else {
    try {
      await downloadImage(url, filepath); // Direct HTTP call
      logger.success(`✓ Downloaded: ${filename}`);
    } catch (err) {
      logger.warn(`⚠ Failed to download ${filename}: ${err.message}`);
      if (err.message.includes('HTTP 403')) {
        logger.trackHttp403(slug, filename, url); // Direct Logger coupling
      }
    }
  }

  fixedContent = fixedContent.replace(url, `./${filename}`);
  await new Promise(resolve => setTimeout(resolve, IMAGE_DOWNLOAD_DELAY_MS));
}
```

**Characteristics**:
- Untyped JavaScript (no compile-time safety)
- Tightly coupled to Logger (needs slug, direct calls)
- Inline HTTP download logic (not reusable)
- No structured error tracking (just logs)
- No statistics returned (side effects only)
- Mixed concerns (downloading + logging + URL replacement)

---

### New Implementation (ImageProcessor)

```typescript
// New: Service-oriented, type-safe
export class ImageProcessor {
  private downloader: ImageDownloader; // Injected service

  async process(
    markdown: string,
    blogDir: string
  ): Promise<ImageProcessingResult> {
    const imageMatches = this.extractImageUrls(markdown);
    const errors: ImageProcessingError[] = [];
    let imagesDownloaded = 0;
    let imagesSkipped = 0;
    let updatedMarkdown = markdown;

    for (const [_fullMatch, url] of imageMatches) {
      const filename = ImageDownloader.extractHash(url);

      if (!filename) {
        errors.push({
          filename: 'unknown',
          url,
          error: 'Could not extract hash from URL',
          is403: false,
        });
        continue;
      }

      const filepath = path.join(blogDir, filename);

      if (fs.existsSync(filepath)) {
        imagesSkipped++;
        updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
        continue;
      }

      try {
        const result = await this.downloader.download(url, filepath);

        if (result.is403) {
          errors.push({
            filename,
            url,
            error: result.error || 'HTTP 403 Forbidden',
            is403: true, // Structured error tracking
          });
        } else if (!result.success) {
          errors.push({
            filename,
            url,
            error: result.error || 'Download failed',
            is403: false,
          });
        } else {
          imagesDownloaded++;
        }
      } catch (error) {
        errors.push({
          filename,
          url,
          error: error instanceof Error ? error.message : String(error),
          is403: false,
        });
      }

      updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
    }

    return {
      markdown: updatedMarkdown,
      imagesProcessed: imageMatches.length,
      imagesDownloaded,
      imagesSkipped,
      errors, // Structured errors for Converter to handle
    };
  }
}
```

**Improvements**:
- ✅ **Type Safety**: Full TypeScript with strict mode
- ✅ **Service Injection**: Uses ImageDownloader service (testable)
- ✅ **Separation of Concerns**: No Logger dependency, returns structured data
- ✅ **Structured Errors**: Detailed error metadata instead of logs
- ✅ **Statistics**: Returns comprehensive processing stats
- ✅ **Single Responsibility**: Only processes markdown images
- ✅ **Testability**: Easy to mock ImageDownloader, verify behavior
- ✅ **Reusability**: Can be used in different contexts (not just convert script)
- ✅ **Marker-Based Retry**: Intelligent retry logic skips permanent failures, retries transient ones

---

## User Workflow for Retrying Failed Downloads

The marker-based retry strategy enables flexible workflows for handling failed image downloads. This section documents common scenarios and how users can manage them.

### Scenario 1: First Conversion with Some Failures

**Situation**: Running the converter for the first time, some images fail to download (network issues, 403 errors, etc.).

**What Happens**:
```
blog/my-post-slug/
├── index.md
│   Contains:
│   - Local paths for successful downloads: ![Success](./uuid-123.png)
│   - CDN URLs for failed downloads: ![Failed](https://cdn.hashnode.com/.../uuid-456.png)
├── uuid-123.png (successfully downloaded)
└── .downloaded-markers/
    ├── uuid-123.png.marker (empty file = success)
    ├── uuid-456.png.marker.403 (HTTP 403 = permanent failure)
    └── uuid-789.png.marker (contains "timeout" = transient failure)
```

**User Actions**:
```bash
# Check the log to see which images failed
grep "Failed to download" conversion.log

# Review the markdown to see CDN URLs still present
grep "cdn.hashnode.com" blog/my-post-slug/index.md

# Identify permanent vs transient failures
ls blog/my-post-slug/.downloaded-markers/
```

---

### Scenario 2: Retry All Failed Images

**Situation**: Network was down, want to retry all failed downloads.

**Solution**: Delete all marker files (forces complete re-check):
```bash
# Remove all markers for this post
rm -rf blog/my-post-slug/.downloaded-markers/

# Re-run conversion
npm run convert -- --export hashnode/export.json --output blog/

# ImageProcessor will:
# - Skip images that already exist (file check)
# - Attempt to download all failed images again
# - Create new markers based on new results
```

---

### Scenario 3: Retry Only Transient Failures (Skip 403s)

**Situation**: Some images got 403 errors (permanent), others had network timeouts (transient). Want to retry only the transient failures.

**Solution**: Delete only non-403 markers:
```bash
# Remove transient failure markers (keeps .403 markers)
find blog/my-post-slug/.downloaded-markers/ -name "*.marker" -type f -delete

# Re-run conversion
npm run convert -- --export hashnode/export.json --output blog/

# ImageProcessor will:
# - Skip successful downloads (file exists + marker exists)
# - Skip 403 failures (403 marker exists)
# - Retry transient failures (no marker or error marker deleted)
```

---

### Scenario 4: Force Re-Download Specific Images

**Situation**: One image is corrupted or you want to re-download it.

**Solution**: Delete both the image file and its marker:
```bash
# Remove image and marker
rm blog/my-post-slug/uuid-123.png
rm blog/my-post-slug/.downloaded-markers/uuid-123.png.marker

# Re-run conversion
npm run convert -- --export hashnode/export.json --output blog/

# ImageProcessor will re-download that specific image
```

---

### Scenario 5: Understanding Marker Files

**Marker Types**:

**1. Success Marker** (empty file):
```bash
$ ls -lh blog/my-post-slug/.downloaded-markers/uuid-123.png.marker
-rw-r--r--  1 user  staff     0B Nov 19 10:30 uuid-123.png.marker
                                ^ 0 bytes = success

# Meaning: Image uuid-123.png was successfully downloaded
# Action: Will be skipped on re-run
```

**2. Permanent Failure Marker** (.403 extension):
```bash
$ cat blog/my-post-slug/.downloaded-markers/uuid-456.png.marker.403
HTTP 403 Forbidden

# Meaning: Image uuid-456.png returned HTTP 403 (permanent)
# Action: Will be skipped on re-run (don't waste time retrying)
```

**3. Transient Failure Marker** (contains error message):
```bash
$ cat blog/my-post-slug/.downloaded-markers/uuid-789.png.marker
Error: request timeout after 30000ms

# Meaning: Image uuid-789.png failed with timeout (transient)
# Action: Will be retried on re-run (might succeed now)
```

---

### Scenario 6: CLI Integration (Future Enhancement)

**Proposed CLI Flags** (for Converter implementation):

```bash
# Retry all failed images (deletes all markers)
npm run convert -- --export export.json --output blog/ --force-redownload

# Retry only transient failures (keeps 403 markers)
npm run convert -- --export export.json --output blog/ --retry-failed

# Skip retrying (default - respect all markers)
npm run convert -- --export export.json --output blog/
```

**Implementation Note**: These flags would be implemented in the Converter, not ImageProcessor. Converter would delete appropriate markers before calling ImageProcessor.

---

### Best Practices

**1. Add .downloaded-markers/ to .gitignore**:
```gitignore
# Hashnode converter markers (local conversion state)
blog/**/.downloaded-markers/

# Alternative if you want to version markers (not recommended)
# !blog/**/.downloaded-markers/*.403  # Track permanent failures only
```

**2. Review Failures Before Publishing**:
```bash
# Find all posts with failed images (CDN URLs still present)
grep -r "cdn.hashnode.com" blog/*/index.md

# Find all posts with 403 errors
find blog -name "*.marker.403" -exec dirname {} \;
```

**3. Handle Permanent 403s**:
- Option A: Remove the image reference from markdown manually
- Option B: Replace with placeholder image
- Option C: Download manually and place in blog directory (then delete marker to prevent re-download)

**4. Periodic Cleanup**:
```bash
# After successful conversion, markers can be kept for debugging
# Or deleted to save disk space:
find blog -type d -name ".downloaded-markers" -exec rm -rf {} +
```

---

### Troubleshooting

**Problem**: ImageProcessor still tries to download an image that should be skipped.

**Solution**: Check marker file exists and is in correct location:
```bash
ls -la blog/my-post-slug/.downloaded-markers/

# Verify marker for the problematic image exists
# Success markers should be 0 bytes
# 403 markers should have .403 extension
```

**Problem**: Can't tell which images are failing.

**Solution**: Check conversion logs and ImageProcessingResult.errors:
```typescript
const result = await imageProcessor.process(markdown, blogDir);
console.log(`Failed: ${result.errors.length} images`);
result.errors.forEach(error => {
  console.log(`- ${error.filename}: ${error.error} (403: ${error.is403})`);
});
```

**Problem**: Want to see what will happen without actually downloading.

**Solution**: Implement dry-run mode in Converter (future enhancement):
```typescript
// Proposed: Converter checks markers and reports what would happen
if (options.dryRun) {
  const analysis = await imageProcessor.analyzeRetries(markdown, blogDir);
  console.log(`Would download: ${analysis.wouldDownload.length}`);
  console.log(`Would skip: ${analysis.wouldSkip.length}`);
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Malformed URLs causing crashes | Low | Medium | Validate URLs, handle null returns from extractHash(), continue on errors |
| Rate limiting from CDN | Low | Medium | Configurable delay (default 200ms), retry logic in ImageDownloader |
| Disk space exhaustion | Low | High | Not handled (operational concern), Converter should check before conversion |
| Very large image files | Low | Medium | ImageDownloader has timeout (30s default), configurable |
| Concurrent access to same file | Very Low | Low | Sequential processing prevents conflicts |
| Missing directory causing failures | Low | High | Validate directory exists, throw clear error message |

---

## Timeline Estimate

**Total Estimated Time**: Implementation-focused (no time estimates per project philosophy)

**Implementation Phases**:

- **Phase 1: Core Implementation**
  - Create type definitions
  - Implement constructor and configuration
  - Implement URL extraction logic
  - Implement download loop
  - Implement URL replacement

- **Phase 2: Error Handling**
  - Add directory validation
  - Implement error collection
  - Handle edge cases (invalid URLs, extraction failures)
  - Add comprehensive error messages

- **Phase 3: Testing**
  - Write unit tests (43 tests across 7 categories)
  - Achieve 90%+ coverage
  - Test edge cases and error scenarios
  - Integration testing with ImageDownloader

- **Phase 4: Documentation & Integration**
  - Add JSDoc to all public methods
  - Export types and class in src/index.ts
  - Verify build and type-checking
  - Create comprehensive test coverage report

---

## Next Steps

After Phase 4.3 completion:

### **Phase 4.4: FrontmatterGenerator Processor Implementation**
- Generate YAML frontmatter from PostMetadata
- Handle quote escaping in description field
- Format date as ISO 8601 string
- Handle tags field (array or comma-separated)
- Create comprehensive unit tests
- Target 90%+ test coverage

**Reference**: [TRANSITION.md](TRANSITION.md) lines 354-360

---

## Files to Create/Modify

### New Files
- [ ] [src/types/image-processor.ts](../src/types/image-processor.ts) - Type definitions (ImageProcessorOptions, ImageProcessingResult, ImageProcessingError)
- [ ] [src/processors/image-processor.ts](../src/processors/image-processor.ts) - Main implementation (~250-300 lines with marker logic)
- [ ] [tests/unit/image-processor.test.ts](../tests/unit/image-processor.test.ts) - Unit tests (~500-600 lines, 51 tests)

### Modified Files
- [ ] [src/index.ts](../src/index.ts) - Add exports for ImageProcessor and related types

### Runtime-Generated Files (per blog post)
- [ ] `blog/[post-slug]/.downloaded-markers/` - Directory containing marker files (created automatically by ImageProcessor)
  - `*.marker` - Empty files indicating successful downloads
  - `*.marker` with content - Files containing error messages for transient failures
  - `*.marker.403` - Files indicating permanent HTTP 403 errors

**Note**: Users should add `.downloaded-markers/` to `.gitignore` as these are local conversion state files, not content to be versioned.

### Verification Files (after completion)
- [ ] Coverage report: `coverage/index.html` - Should show 90%+ coverage for image-processor.ts
- [ ] Build output: `dist/processors/image-processor.js` - Compiled JavaScript
- [ ] Type declarations: `dist/processors/image-processor.d.ts` - TypeScript declarations

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `src/types/image-processor.ts` with all type definitions
- [ ] Create `src/processors/image-processor.ts` class skeleton
- [ ] Implement constructor with options handling
- [ ] Implement ImageDownloader service instantiation
- [ ] Implement `getMarkerPath()` private method (creates .downloaded-markers/ directory)
- [ ] Implement `extractImageUrls()` private method
- [ ] Implement main `process()` method with download loop
- [ ] Implement marker-based retry logic (check markers before download)
- [ ] Implement marker creation (success, 403, transient failure)
- [ ] Implement conditional URL replacement (only on success)
- [ ] Implement file existence checking with marker validation

### Phase 2: Error Handling
- [ ] Add blogDir validation (throw if doesn't exist)
- [ ] Implement error collection array
- [ ] Handle extractHash() returning null
- [ ] Handle ImageDownloader.download() failures
- [ ] Track HTTP 403 errors separately (is403: true)
- [ ] Continue processing after errors (don't halt)
- [ ] Add input validation (markdown must be string)

### Phase 3: Testing
- [ ] Create `tests/unit/image-processor.test.ts`
- [ ] Write constructor tests (4 tests)
- [ ] Write URL extraction tests (8 tests)
- [ ] Write successful processing tests (6 tests)
- [ ] Write skip logic tests (4 tests)
- [ ] Write error handling tests (10 tests)
- [ ] Write edge case tests (6 tests)
- [ ] Write ImageDownloader integration tests (5 tests)
- [ ] Write marker-based retry logic tests (8 tests)
  - [ ] Creates .downloaded-markers/ directory if it doesn't exist
  - [ ] Creates empty marker file after successful download
  - [ ] Creates 403 marker file for HTTP 403 errors
  - [ ] Creates error marker file with error message for transient failures
  - [ ] Skips download if success marker and file both exist
  - [ ] Retries download if error marker exists
  - [ ] Skips retry if 403 marker exists
  - [ ] Replaces URL only on successful download
- [ ] Run coverage report, verify 90%+ across all metrics
- [ ] Fix any uncovered code paths

### Phase 4: Documentation & Integration
- [ ] Add JSDoc to ImageProcessor class
- [ ] Add JSDoc to constructor
- [ ] Add JSDoc to process() method
- [ ] Add JSDoc to extractImageUrls() method
- [ ] Add JSDoc to getMarkerPath() method
- [ ] Add usage examples to JSDoc (including retry scenarios)
- [ ] Export ImageProcessor in `src/index.ts`
- [ ] Export ImageProcessorOptions type
- [ ] Export ImageProcessingResult type
- [ ] Export ImageProcessingError type
- [ ] Run `npm run type-check` (verify no errors)
- [ ] Run `npm run build` (verify clean build)
- [ ] Run `npm test` (verify all tests pass)

### Phase 5: Verification
- [ ] Create GitHub Issue #6
- [ ] Verify TypeScript compilation succeeds
- [ ] Verify all 51 tests passing (43 original + 8 marker-based)
- [ ] Verify 90%+ coverage achieved
- [ ] Verify no `any` types in implementation
- [ ] Verify JSDoc complete for all public APIs
- [ ] Verify exports in src/index.ts
- [ ] Create Pull Request
- [ ] Update TRANSITION.md with completion status

---

## Implementation Decisions Summary

This specification includes **6 key implementation decisions** that guide the Phase 4.3 implementation:

1. **Cover Image Handling** → ImageProcessor handles ONLY markdown images; Converter handles cover separately
2. **Error Tracking** → Return structured error data; Converter passes to Logger
3. **Directory Creation** → Assume directory exists; validate and throw if missing
4. **Rate Limiting** → Default 200ms delay (matches reference implementation), fully configurable
5. **Return Type** → Return ImageProcessingResult with detailed statistics
6. **Download Retry Strategy** → Marker-based tracking enables intelligent retry (skip 403s, retry transient failures)

These decisions maintain:
- ✅ Single Responsibility Principle
- ✅ Separation of Concerns
- ✅ Testability
- ✅ Type Safety
- ✅ Flexibility for Converter orchestration
- ✅ Idempotent re-processing

---

## Summary

**Phase 4.3 Status**: 📋 PLANNED

**Implementation Scope**:
- ✅ Process markdown images using ImageDownloader service
- ✅ Extract URLs, download files, replace with local paths
- ✅ Skip already-downloaded images with marker-based tracking
- ✅ Intelligent retry logic (skip permanent 403s, retry transient failures)
- ✅ Track errors with detailed metadata (including HTTP 403 flags)
- ✅ Return comprehensive statistics
- ✅ Marker-based idempotent re-processing

**Out of Scope**:
- ❌ Cover image processing (Converter's responsibility)
- ❌ Directory creation (Converter's responsibility)
- ❌ Direct Logger integration (returns errors for Converter to log)
- ❌ Image optimization (future enhancement)

**Quality Targets**:
- 90%+ test coverage (targeting 95%+)
- Zero `any` types
- Full JSDoc documentation
- 51 comprehensive unit tests (43 original + 8 marker-based)

**Deliverables**:
- `src/types/image-processor.ts` - Type definitions
- `src/processors/image-processor.ts` - Main implementation (~250-300 lines)
- `tests/unit/image-processor.test.ts` - Comprehensive test suite (~500-600 lines)
- Updated `src/index.ts` - Exports
- Runtime `.downloaded-markers/` directories (per blog post)

---

**Phase 4.3 Start Date**: 2025-11-19
**Phase 4.3 Completion Date**: 2025-11-19
**Phase 4.3 Status**: ✅ COMPLETE
**Pull Request**: TBD

---

## Implementation Results

### Test Coverage

All 51 tests passing with excellent coverage:

```
Test Results: 51 passed (51)
Coverage for image-processor.ts:
- Statements:  100%
- Branches:    91.17%
- Functions:   100%
- Lines:       100%
```

### Test Breakdown by Category

1. ✅ Constructor and Configuration (4 tests) - All passing
2. ✅ Image URL Extraction (8 tests) - All passing
3. ✅ Successful Image Processing (6 tests) - All passing
4. ✅ Already-Downloaded Images (4 tests) - All passing
5. ✅ Error Handling (10 tests) - All passing
6. ✅ Edge Cases (6 tests) - All passing
7. ✅ Integration with ImageDownloader (5 tests) - All passing
8. ✅ Marker-Based Retry Logic (8 tests) - All passing

### Files Created

- ✅ [src/types/image-processor.ts](../src/types/image-processor.ts) - 93 lines
- ✅ [src/processors/image-processor.ts](../src/processors/image-processor.ts) - 265 lines
- ✅ [tests/unit/image-processor.test.ts](../tests/unit/image-processor.test.ts) - 813 lines, 51 tests
- ✅ Updated [src/index.ts](../src/index.ts) - Added exports

### Files Modified

- ✅ [src/services/image-downloader.ts](../src/services/image-downloader.ts) - Changed return type from void to DownloadResult
- ✅ [tests/unit/image-downloader.test.ts](../tests/unit/image-downloader.test.ts) - Updated tests for new return type

### Verification

| Check | Status | Result |
|-------|--------|--------|
| TypeScript compilation | ✅ | No type errors |
| Build process | ✅ | Clean build output |
| Unit tests passing | ✅ | 51/51 tests pass |
| Statement coverage ≥90% | ✅ | 100% |
| Branch coverage ≥90% | ✅ | 91.17% |
| Function coverage ≥90% | ✅ | 100% |
| Line coverage ≥90% | ✅ | 100% |
| No `any` types used | ✅ | Full type safety |
| JSDoc documentation | ✅ | Complete for all public APIs |

---

**Next Action**: Create Pull Request for Phase 4.3 implementation.
