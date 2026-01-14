# Phase 3, Step 3.1: Add processWithContext Method to ImageProcessor - Implementation Plan

**Issue**: [#49 - Add processWithContext Method to ImageProcessor](https://github.com/alvincrespo/hashnode-content-converter/issues/49)
**Status**: 📋 PLANNED
**Date**: 2026-01-14
**Phase**: Phase 3: ImageProcessor Updates

---

## Overview

Add a new `processWithContext()` method to ImageProcessor that accepts an `ImageProcessorContext` object for explicit control over image directory and path prefix. This enables flat mode support where images are stored in a shared sibling directory with absolute path references (e.g., `/images/filename.png`) instead of the current nested mode structure.

**Scope**:
- Add `processWithContext()` method with context-based image processing
- Add three helper methods for directory-specific operations
- Maintain 100% backwards compatibility with existing `process()` method
- Achieve 90%+ test coverage for new code paths

**Reference**: [docs/IMPLEMENTATION_FLAT.md](docs/IMPLEMENTATION_FLAT.md) (lines 518-675)

---

## Requirements Summary

From [IMPLEMENTATION_FLAT.md](docs/IMPLEMENTATION_FLAT.md) and [Issue #49](https://github.com/alvincrespo/hashnode-content-converter/issues/49):

**Core Requirements**:
- Create `processWithContext()` method accepting `ImageProcessorContext` parameter
- Use provided `imageDir` for downloads (not inferred from parameter)
- Use provided `imagePathPrefix` for markdown URL replacement (not hardcoded `./`)
- Validate `imageDir` exists before processing
- Support optional custom `markerDir` from context

**Helper Methods**:
- `buildImagePath()` - Normalize path prefix with trailing slashes
- `getMarkerPathForDir()` - Get marker file paths for specific directory
- `recordDownloadFailureForDir()` - Record errors with directory-specific markers

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Backwards compatibility - existing `process()` method unchanged

---

## Architecture Design

### 1. Method Signatures

#### processWithContext Method

```typescript
/**
 * Process markdown with explicit image context.
 * Used for flat mode where images go to a shared directory.
 *
 * This method provides explicit control over:
 * - Image storage directory (not inferred from post structure)
 * - Image path prefix for markdown references (configurable for different SSGs)
 * - Optional custom marker directory (defaults to imageDir)
 *
 * Differences from process():
 * - Accepts ImageProcessorContext instead of blogDir string
 * - Uses context.imagePathPrefix instead of hardcoded './'
 * - Validates imageDir exists (caller must create it)
 * - Supports custom marker directory for shared image deduplication
 *
 * @param markdown - The markdown content to process
 * @param context - Image processing context with directory and path prefix
 * @returns Processing result with updated markdown and statistics
 * @throws {Error} If imageDir does not exist
 *
 * @example
 * ```typescript
 * // Flat mode: images to shared directory
 * const result = await processor.processWithContext(markdown, {
 *   imageDir: '/blog/_images',
 *   imagePathPrefix: '/images',
 * });
 * // result.markdown contains: ![alt](/images/uuid.png)
 * ```
 */
async processWithContext(
  markdown: string,
  context: ImageProcessorContext
): Promise<ImageProcessingResult>
```

#### Helper Methods

```typescript
/**
 * Build image path from prefix and filename.
 * Handles trailing slash normalization to avoid double slashes.
 *
 * @param prefix - Path prefix (e.g., '/images', '/assets/', '.')
 * @param filename - Image filename (e.g., 'uuid.png')
 * @returns Normalized path (e.g., '/images/uuid.png')
 * @private
 */
private buildImagePath(prefix: string, filename: string): string

/**
 * Get marker path for a specific directory.
 * Creates the markers directory if it doesn't exist.
 *
 * This method differs from getMarkerPath() by accepting baseDir
 * parameter instead of using class instance blogDir, enabling
 * marker files in arbitrary directories (shared image folders).
 *
 * @param baseDir - Base directory for marker storage
 * @param filename - Image filename (e.g., 'uuid.png')
 * @returns Path to marker file (e.g., '/images/.downloaded-markers/uuid.png.marker')
 * @private
 */
private getMarkerPathForDir(baseDir: string, filename: string): string

/**
 * Record download failure with marker in specified directory.
 *
 * This method differs from recordDownloadFailure() by accepting baseDir
 * parameter, enabling error markers in arbitrary directories.
 *
 * @param filename - Image filename (e.g., 'uuid.png')
 * @param url - Original CDN URL that failed
 * @param errorMessage - Error description to store in marker
 * @param isPermanent403 - If true, creates .403 marker; if false, creates regular marker
 * @param baseDir - Base directory for marker storage
 * @param errors - Error collection array to append to
 * @private
 */
private recordDownloadFailureForDir(
  filename: string,
  url: string,
  errorMessage: string,
  isPermanent403: boolean,
  baseDir: string,
  errors: ImageProcessingError[]
): void
```

### 2. Design Patterns

**Pattern Used**: Template Method with Strategy
- `process()` and `processWithContext()` share core logic
- Context object provides strategy for directory and path resolution
- Helper methods (`getMarkerPathForDir`, `recordDownloadFailureForDir`) enable directory-agnostic operations

**Key Decisions**:

1. **Separate method vs parameter**: Use separate `processWithContext()` method instead of adding optional parameter to `process()`
   - **Rationale**: Clearer API, maintains backwards compatibility, explicit intent

2. **Directory validation**: Validate `imageDir` exists before processing
   - **Rationale**: Fail fast, clear error messages, consistent with `process()` behavior

3. **Marker directory flexibility**: Support optional `markerDir` in context
   - **Rationale**: Enables advanced use cases (e.g., centralized marker storage)

4. **Path normalization**: Handle trailing slashes in `buildImagePath()`
   - **Rationale**: Prevents `/images//filename.png` malformed paths

---

## Technical Approach

### 1. Data Flow

```
Markdown Input
    ↓
Extract Image URLs (extractImageUrls)
    ↓
For each image URL:
    ↓
    Extract filename (ImageDownloader.extractHash)
    ↓
    Build image filepath: path.join(imageDir, filename)
    ↓
    Build marker path: getMarkerPathForDir(markerDir ?? imageDir, filename)
    ↓
    Build local path: buildImagePath(imagePathPrefix, filename)  ← NEW
    ↓
    Check existing markers (success / 403 / transient)
    ↓
    Download if needed (ImageDownloader.download)
    ↓
    Create marker (success / error)
    ↓
    Replace URL if successful: url → localPath
    ↓
Return ImageProcessingResult
```

### 2. Implementation Strategy

The implementation follows these principles:

1. **Reuse existing logic**: Core download loop identical to `process()`
2. **Context-driven paths**: Use context values instead of hardcoded defaults
3. **Directory-agnostic helpers**: New helper methods accept directory parameters
4. **Fail-fast validation**: Check directory exists at method entry
5. **Backwards compatibility**: Keep `process()` method unchanged

**Critical Implementation Details**:

1. **Trailing Slash Handling** (`buildImagePath`):
   - Input: `'/images/'`, `'uuid.png'` → Output: `'/images/uuid.png'`
   - Input: `'/images'`, `'uuid.png'` → Output: `'/images/uuid.png'`
   - Input: `'.'`, `'uuid.png'` → Output: `'./uuid.png'`

2. **Marker Directory Logic**:
   - Use `context.markerDir` if provided (custom location)
   - Otherwise use `context.imageDir` (default: same as images)
   - Creates `.downloaded-markers/` subdirectory in effective location

3. **Error Marker Paths**:
   - Success: `{markerDir}/.downloaded-markers/{filename}.marker` (empty file)
   - Transient error: Same path with error message content
   - Permanent 403: `{markerDir}/.downloaded-markers/{filename}.marker.403` with error

---

## Implementation Steps

### Step 1: Add Import for ImageProcessorContext

**File**: `src/processors/image-processor.ts`

**Action**: Add import statement for the new type

**Implementation**:

```typescript
// At top of file, add to existing imports (around line 4-8)
import type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
  ImageProcessorContext,  // ← ADD THIS
} from '../types/image-processor.js';
```

### Step 2: Implement buildImagePath Helper

**File**: `src/processors/image-processor.ts`

**Action**: Add private helper method after `process()` method (around line 207)

**Implementation**:

```typescript
/**
 * Build image path from prefix and filename.
 * Handles trailing slash normalization to avoid double slashes.
 *
 * @param prefix - Path prefix (e.g., '/images', '/assets/', '.')
 * @param filename - Image filename (e.g., 'uuid.png')
 * @returns Normalized path (e.g., '/images/uuid.png')
 *
 * @example
 * ```typescript
 * buildImagePath('/images', 'test.png')   // '/images/test.png'
 * buildImagePath('/images/', 'test.png')  // '/images/test.png'
 * buildImagePath('.', 'test.png')         // './test.png'
 * ```
 */
private buildImagePath(prefix: string, filename: string): string {
  if (prefix.endsWith('/')) {
    return `${prefix}${filename}`;
  }
  return `${prefix}/${filename}`;
}
```

### Step 3: Implement getMarkerPathForDir Helper

**File**: `src/processors/image-processor.ts`

**Action**: Add private helper method after `buildImagePath()`

**Implementation**:

```typescript
/**
 * Get marker path for a specific directory.
 * Creates the markers directory if it doesn't exist.
 *
 * This method differs from getMarkerPath() by accepting baseDir
 * parameter instead of using class instance blogDir, enabling
 * marker files in arbitrary directories (shared image folders).
 *
 * @param baseDir - Base directory for marker storage
 * @param filename - Image filename (e.g., 'uuid.png')
 * @returns Path to marker file (e.g., '/images/.downloaded-markers/uuid.png.marker')
 */
private getMarkerPathForDir(baseDir: string, filename: string): string {
  const markersDir = path.join(baseDir, '.downloaded-markers');

  // Ensure markers directory exists
  if (!fs.existsSync(markersDir)) {
    fs.mkdirSync(markersDir, { recursive: true });
  }

  return path.join(markersDir, `${filename}.marker`);
}
```

### Step 4: Implement recordDownloadFailureForDir Helper

**File**: `src/processors/image-processor.ts`

**Action**: Add private helper method after `getMarkerPathForDir()`

**Implementation**:

```typescript
/**
 * Record download failure with marker in specified directory.
 *
 * This method differs from recordDownloadFailure() by accepting baseDir
 * parameter, enabling error markers in arbitrary directories.
 *
 * Marker paths:
 * - Permanent (403): `{filename}.marker.403` - won't retry on re-run
 * - Transient: `{filename}.marker` with error message - will retry on re-run
 *
 * @param filename - Image filename (e.g., 'uuid.png')
 * @param url - Original CDN URL that failed
 * @param errorMessage - Error description to store in marker
 * @param isPermanent403 - If true, creates .403 marker; if false, creates regular marker
 * @param baseDir - Base directory for marker storage
 * @param errors - Error collection array to append to
 */
private recordDownloadFailureForDir(
  filename: string,
  url: string,
  errorMessage: string,
  isPermanent403: boolean,
  baseDir: string,
  errors: ImageProcessingError[]
): void {
  const markerPath = this.getMarkerPathForDir(baseDir, filename);
  const filePath = isPermanent403 ? `${markerPath}.403` : markerPath;

  fs.writeFileSync(filePath, errorMessage);
  errors.push({
    filename,
    url,
    error: errorMessage,
    is403: isPermanent403,
  });
}
```

### Step 5: Implement processWithContext Method

**File**: `src/processors/image-processor.ts`

**Action**: Add public method after `process()` method (around line 207), before helper methods

**Implementation**:

```typescript
/**
 * Process markdown with explicit image context.
 * Used for flat mode where images go to a shared directory.
 *
 * This method provides explicit control over:
 * - Image storage directory (not inferred from post structure)
 * - Image path prefix for markdown references (configurable for different SSGs)
 * - Optional custom marker directory (defaults to imageDir)
 *
 * Uses marker-based tracking for intelligent retry:
 * - Skips successfully downloaded images (file + success marker exist)
 * - Skips permanent HTTP 403 failures (403 marker exists)
 * - Retries transient failures (error marker or no marker)
 *
 * Differences from process():
 * - Accepts ImageProcessorContext instead of blogDir string
 * - Uses context.imagePathPrefix instead of hardcoded './'
 * - Validates imageDir exists (caller must create it)
 * - Supports custom marker directory for shared image deduplication
 *
 * @param markdown - The markdown content to process
 * @param context - Image processing context with directory and path prefix
 * @returns Processing result with updated markdown and statistics
 * @throws {Error} If imageDir does not exist
 *
 * @example
 * ```typescript
 * // Flat mode: images to shared directory
 * const result = await processor.processWithContext(markdown, {
 *   imageDir: '/blog/_images',
 *   imagePathPrefix: '/images',
 * });
 * // result.markdown contains: ![alt](/images/uuid.png)
 * ```
 */
async processWithContext(
  markdown: string,
  context: ImageProcessorContext
): Promise<ImageProcessingResult> {
  const { imageDir, imagePathPrefix, markerDir } = context;
  const effectiveMarkerDir = markerDir ?? imageDir;

  // Validate directory exists
  if (!fs.existsSync(imageDir)) {
    throw new Error(
      `Image directory does not exist: ${imageDir}. ` +
        `Ensure directory is created before calling ImageProcessor.`
    );
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

    const filepath = path.join(imageDir, filename);

    // Get marker paths using directory-specific helper
    const markerPath = this.getMarkerPathForDir(effectiveMarkerDir, filename);
    const marker403Path = markerPath + '.403';

    // Build local path with configured prefix
    const localPath = this.buildImagePath(imagePathPrefix, filename);

    // Check if download succeeded previously (file exists + success marker exists)
    if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
      // Verify it's a success marker (empty file or very small)
      const stats = fs.statSync(markerPath);
      if (stats.size === 0) {
        imagesSkipped++;
        // Replace URL since file exists
        updatedMarkdown = updatedMarkdown.replace(url, localPath);
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
        updatedMarkdown = updatedMarkdown.replace(url, localPath);
      } else if (result.is403) {
        // HTTP 403: permanent failure, create 403 marker (don't retry)
        this.recordDownloadFailureForDir(
          filename,
          url,
          result.error || 'HTTP 403 Forbidden',
          true,
          effectiveMarkerDir,
          errors
        );
      } else {
        // Transient failure: create marker with error message (will retry)
        this.recordDownloadFailureForDir(
          filename,
          url,
          result.error || 'Download failed',
          false,
          effectiveMarkerDir,
          errors
        );
      }
    } catch (error) {
      // Unexpected error during download: treat as transient failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordDownloadFailureForDir(filename, url, errorMsg, false, effectiveMarkerDir, errors);
    }
  }

  return {
    markdown: updatedMarkdown,
    imagesProcessed: imageMatches.length,
    imagesDownloaded,
    imagesSkipped,
    errors,
  };
}
```

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/image-processor.test.ts`

**Test Categories**:

#### A. processWithContext - Basic Functionality (7 tests)
- ☐ Should download images to provided imageDir
- ☐ Should use provided imagePathPrefix in markdown
- ☐ Should process multiple images correctly
- ☐ Should return correct statistics (processed, downloaded, skipped)
- ☐ Should handle markdown with no images
- ☐ Should extract and process Hashnode CDN URLs only
- ☐ Should call ImageDownloader.download() with correct arguments

#### B. processWithContext - Path Prefix Normalization (4 tests)
- ☐ Should handle imagePathPrefix with trailing slash (`/assets/`)
- ☐ Should handle imagePathPrefix without trailing slash (`/assets`)
- ☐ Should handle relative path prefix (`./`)
- ☐ Should handle root path prefix (`/`)

#### C. processWithContext - Marker Directory Handling (5 tests)
- ☐ Should create markers in imageDir by default (markerDir not specified)
- ☐ Should create markers in custom markerDir when specified
- ☐ Should skip images with existing success markers
- ☐ Should retry images with transient error markers
- ☐ Should skip images with 403 markers (permanent failure)

#### D. processWithContext - Error Handling (5 tests)
- ☐ Should throw error if imageDir does not exist
- ☐ Should continue processing after download failure
- ☐ Should track HTTP 403 errors separately (is403: true)
- ☐ Should track other errors with is403: false
- ☐ Should keep CDN URLs for failed downloads

#### E. processWithContext - Edge Cases (4 tests)
- ☐ Should handle empty markdown string
- ☐ Should handle duplicate image URLs (download once, reuse)
- ☐ Should handle invalid URL (no extractable hash)
- ☐ Should handle ImageDownloader throwing exception

#### F. Helper Methods - buildImagePath (4 tests)
- ☐ Should join prefix and filename with slash (no trailing slash)
- ☐ Should not add double slash (trailing slash)
- ☐ Should handle relative path prefix (`./`)
- ☐ Should handle empty prefix

#### G. Helper Methods - getMarkerPathForDir (3 tests)
- ☐ Should create .downloaded-markers directory if missing
- ☐ Should return marker path in specified baseDir
- ☐ Should handle nested directories correctly

#### H. Helper Methods - recordDownloadFailureForDir (3 tests)
- ☐ Should create marker file with error message
- ☐ Should create .403 marker for permanent failures
- ☐ Should append error to errors array

#### I. Backwards Compatibility (2 tests)
- ☐ Existing process() method unchanged (regression)
- ☐ Existing tests still pass (integration)

**Total Tests**: ~37 new tests (targeting 90%+ coverage)

### 2. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥90% | All code paths exercised |
| **Branches** | ≥90% | All conditions tested |
| **Functions** | 100% | All 4 new methods covered |
| **Lines** | ≥90% | Complete line coverage |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: Converter.convertPost() method
- **Input Type**: `string` (markdown), `ImageProcessorContext` (configuration)
- **Integration**: Converter determines mode (flat/nested) and builds context object

### 2. Downstream (Output)
- **Output Type**: `ImageProcessingResult`
- **Next Stage**: FrontmatterGenerator (unchanged)
- **Integration**: Same result format as existing `process()` method

### 3. Error Flow
- **Error Handling**: Errors tracked in `ImageProcessingError[]` array
- **Error Tracking**: Logger service (via Converter) tracks 403 errors separately

---

## Potential Challenges & Solutions

### Challenge 1: Trailing Slash Inconsistency

**Issue**: Users may provide image path prefixes with or without trailing slashes, leading to inconsistent markdown paths (`/images/file.png` vs `/images//file.png`)

**Solution**: The `buildImagePath()` helper normalizes trailing slashes

**Risk Level**: Low (handled by implementation)

### Challenge 2: Marker Directory Confusion

**Issue**: When `markerDir` differs from `imageDir`, developers may be confused about where markers are stored

**Solution**:
- Clear JSDoc documentation explaining the split
- Default behavior (markerDir = imageDir) matches expected behavior
- Advanced use case (custom markerDir) is explicit opt-in

**Risk Level**: Low (documentation clarity)

### Challenge 3: Backwards Compatibility

**Issue**: Ensuring existing `process()` method behavior unchanged

**Solution**:
- `process()` method not modified at all
- New method is separate, not parameter addition
- Existing tests verify no regression

**Risk Level**: Very Low (separate methods)

---

## Success Criteria

### Functional Requirements
- ☐ processWithContext() downloads images to provided imageDir
- ☐ processWithContext() uses provided imagePathPrefix for markdown URLs
- ☐ processWithContext() validates imageDir exists before processing
- ☐ processWithContext() supports optional custom markerDir
- ☐ buildImagePath() normalizes trailing slashes correctly
- ☐ getMarkerPathForDir() creates markers in specified directory
- ☐ recordDownloadFailureForDir() records errors with directory-specific markers
- ☐ Existing process() method unchanged (backwards compatibility)

### Non-Functional Requirements
- ☐ 90%+ test coverage for new code
- ☐ No `any` types in production code
- ☐ All public methods documented with JSDoc
- ☐ TypeScript compilation passes
- ☐ Build succeeds
- ☐ All tests pass (existing + new)

### Code Quality
- ☐ Follows existing ImageProcessor patterns
- ☐ Single responsibility for each helper method
- ☐ Comprehensive error handling
- ☐ Clear separation between process() and processWithContext()

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue #49 reviewed
- [x] ImageProcessorContext type exists (src/types/image-processor.ts)
- [x] Existing ImageProcessor implementation understood
- [x] Test patterns studied (51 existing tests)
- [x] Implementation patterns reviewed

### Post-Implementation

```bash
# Verify TypeScript compilation
npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
npm run build
# Expected: dist/ directory created

# Run ImageProcessor tests
npm test tests/unit/image-processor.test.ts
# Expected: All tests pass (~88 tests: 51 existing + 37 new)

# Generate coverage report
npm run test:coverage -- tests/unit/image-processor.test.ts
# Expected: ≥90% coverage for ImageProcessor

# Run full test suite
npm test
# Expected: All tests pass, no regressions
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [x] Add import for ImageProcessorContext type
- [x] Implement buildImagePath() helper method
- [x] Implement getMarkerPathForDir() helper method
- [x] Implement recordDownloadFailureForDir() helper method
- [x] Implement processWithContext() main method

### Phase 2: Testing
- [x] Write tests for processWithContext() basic functionality (7 tests)
- [x] Write tests for path prefix normalization (4 tests)
- [x] Write tests for marker directory handling (5 tests)
- [x] Write tests for error handling (5 tests)
- [x] Write tests for edge cases (4 tests)
- [x] Write tests for buildImagePath() helper (4 tests) - REMOVED (redundant)
- [x] Write tests for getMarkerPathForDir() helper (3 tests) - REMOVED (redundant)
- [x] Write tests for recordDownloadFailureForDir() helper (3 tests) - REMOVED (redundant)
- [x] Write backwards compatibility tests (2 tests)

### Phase 3: Verification
- [x] Run type-check
- [x] Run build
- [x] Run tests
- [x] Review coverage report (target ≥90%)

### Phase 4: Documentation
- [x] Update issue #49 with implementation status
- [x] Mark Step 3.1 complete in IMPLEMENTATION_FLAT.md
- [x] Document any deviations from plan

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test coverage below 90% | Low | Medium | Comprehensive test plan covers all code paths |
| Breaking existing process() behavior | Very Low | High | Separate method, no modifications to existing code |
| Trailing slash edge cases | Low | Low | buildImagePath() handles all scenarios |
| Directory validation overhead | Very Low | Low | Fast filesystem check, fails early |

---

## Timeline Estimate

**Total Estimated Time**: 3-4 hours

- **Phase 1** (Core Implementation): 1-1.5 hours
  - Import: 2 minutes
  - buildImagePath(): 10 minutes
  - getMarkerPathForDir(): 10 minutes
  - recordDownloadFailureForDir(): 15 minutes
  - processWithContext(): 30-45 minutes

- **Phase 2** (Testing): 1.5-2 hours
  - Basic functionality tests: 30 minutes
  - Path normalization tests: 15 minutes
  - Marker directory tests: 20 minutes
  - Error handling tests: 20 minutes
  - Edge case tests: 15 minutes
  - Helper method tests: 20 minutes

- **Phase 3** (Verification): 15 minutes
  - Run test suite
  - Review coverage
  - Type-check and build

- **Phase 4** (Documentation): 15 minutes
  - Update issue
  - Mark step complete

---

## Reference Implementation

### Comparison with process() Method

| Aspect | process() | processWithContext() |
|--------|-----------|----------------------|
| **Parameter** | `blogDir: string` | `context: ImageProcessorContext` |
| **Image directory** | `blogDir` (inferred) | `context.imageDir` (explicit) |
| **Path prefix** | Hardcoded `./` | `context.imagePathPrefix` (configurable) |
| **Marker directory** | Same as blogDir | `context.markerDir ?? context.imageDir` |
| **Use case** | Nested mode | Flat mode |
| **Validation** | Validates blogDir exists | Validates imageDir exists |

### Key Implementation Differences

1. **Path Building**:
   ```typescript
   // process():
   updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);

   // processWithContext():
   const localPath = this.buildImagePath(imagePathPrefix, filename);
   updatedMarkdown = updatedMarkdown.replace(url, localPath);
   ```

2. **Marker Path Retrieval**:
   ```typescript
   // process():
   const markerPath = this.getMarkerPath(blogDir, filename);

   // processWithContext():
   const markerPath = this.getMarkerPathForDir(effectiveMarkerDir, filename);
   ```

3. **Error Recording**:
   ```typescript
   // process():
   this.recordDownloadFailure(filename, url, errorMsg, true, blogDir, errors);

   // processWithContext():
   this.recordDownloadFailureForDir(filename, url, errorMsg, true, effectiveMarkerDir, errors);
   ```

---

## Next Steps After Implementation

1. Proceed to Phase 3, Step 3.2: Write ImageProcessor unit tests (this step)
2. Then Phase 4, Step 4.1: Update Converter.convertPost() to use processWithContext()
3. Then Phase 4, Step 4.2: Update Converter.convertAllPosts() for flat mode
4. Integration testing in Phase 4, Step 4.3

---

## Summary

**Phase 3, Step 3.1** will deliver a context-aware image processing method that:
- Enables explicit control over image storage location and path prefix
- Supports flat output mode for static site generators
- Maintains full backwards compatibility with existing functionality
- Achieves 90%+ test coverage with comprehensive unit tests

**Ready to implement?** This plan provides comprehensive guidance for building a robust, well-tested enhancement that integrates seamlessly with the existing ImageProcessor architecture.
