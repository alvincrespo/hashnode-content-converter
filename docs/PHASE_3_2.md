# Phase 3.2: FileWriter Service - Implementation Plan

**Issue**: [#2 - Implement FileWriter Service](https://github.com/alvincrespo/hashnode-content-converter/issues/2)
**Status**: 📋 **PLANNING**
**Date**: 2025-10-26
**Phase**: Service Layer Implementation (Step 3.2)

---

## Overview

This document outlines the detailed implementation plan for the **FileWriter service**, which is responsible for writing converted blog posts to the filesystem. The service will handle directory creation, markdown file writing, path validation, and error handling.

**Scope**: Implement a production-ready, type-safe service for persisting blog posts to disk with comprehensive error handling and test coverage.

---

## Requirements Summary

From [Issue #2](https://github.com/alvincrespo/hashnode-content-converter/issues/2):

- ✅ Create `src/services/file-writer.ts`
- ✅ Implement directory creation with recursive option
- ✅ Implement markdown file writing
- ✅ Handle path resolution and validation
- ✅ Write unit tests for:
  - Directory creation
  - File writing
  - Path validation
  - Error cases
- ✅ 90%+ test coverage for new code
- ✅ Type-safe implementation (no `any` types)

---

## Architecture Design

### 1. Service API Design

#### Public Interface

```typescript
class FileWriter {
  /**
   * Write a blog post with frontmatter and content to the filesystem
   * @param outputDir - Base output directory (e.g., './blog')
   * @param slug - Post slug (used as subdirectory name)
   * @param frontmatter - YAML frontmatter string (includes --- markers)
   * @param content - Markdown content body
   * @returns Absolute path to the written file
   * @throws Error if write fails
   */
  async writePost(
    outputDir: string,
    slug: string,
    frontmatter: string,
    content: string
  ): Promise<string>

  /**
   * Check if a post already exists in the output directory
   * @param outputDir - Base output directory
   * @param slug - Post slug to check
   * @returns True if post directory exists, false otherwise
   */
  postExists(outputDir: string, slug: string): boolean
}
```

#### Configuration Interface

```typescript
export interface FileWriterConfig {
  /**
   * Whether to overwrite existing files
   * Default: false (throw error if file exists)
   */
  overwrite?: boolean;

  /**
   * File encoding for markdown files
   * Default: 'utf8'
   */
  encoding?: BufferEncoding;

  /**
   * Enable atomic writes (write to temp file, then rename)
   * Default: true (prevents partial writes on failure)
   */
  atomicWrites?: boolean;
}
```

### 2. Design Patterns

**Following ImageDownloader Pattern**:
- Configuration via optional constructor parameter
- Dependency injection (config)
- Single responsibility (filesystem operations only)
- Comprehensive error handling
- Type-safe implementation
- Well-documented with JSDoc

**Key Decisions**:
1. **Sync vs Async**: Use **async** operations for consistency with ImageDownloader and to enable future enhancements (e.g., cloud storage)
2. **Atomic Writes**: Write to `.tmp` file first, then rename to prevent partial writes
3. **Path Validation**: Sanitize slugs to prevent path traversal attacks
4. **Error Handling**: Throw descriptive errors with context (path, operation, underlying error)

---

## Technical Approach

### 1. File Structure

```
<outputDir>/
  ├── <slug-1>/
  │   ├── index.md         # Frontmatter + content
  │   └── images/          # (created by ImageProcessor)
  ├── <slug-2>/
  │   └── index.md
  └── ...
```

### 2. Write Flow

```
1. Validate inputs (outputDir, slug, frontmatter, content)
   ↓
2. Sanitize slug (prevent path traversal)
   ↓
3. Construct paths:
   - postDir = path.join(outputDir, slug)
   - filePath = path.join(postDir, 'index.md')
   ↓
4. Check if file exists (if overwrite=false, throw error)
   ↓
5. Create post directory (recursive)
   ↓
6. Combine frontmatter + content
   ↓
7. Write to file:
   - If atomicWrites=true: Write to .tmp, then rename
   - If atomicWrites=false: Direct write
   ↓
8. Return absolute path to written file
```

### 3. Path Validation Strategy

**Security Concerns**:
- Path traversal: `../../../etc/passwd`
- Absolute paths: `/etc/passwd`
- Special characters: `slug:with:colons`, `slug/with/slashes`
- Unicode: `日本語`, `emoji🎉`

**Note**: Windows is not supported. Implementation focuses on Unix-like systems (macOS, Linux).

**Validation Approach**:
```typescript
private sanitizeSlug(slug: string): string {
  // 1. Remove leading/trailing whitespace
  // 2. Reject absolute paths (starts with /)
  // 3. Reject parent directory traversal (..)
  // 4. Replace invalid filename characters (/, \, :, *, ?, ", <, >, |)
  // 5. Ensure result is not empty after sanitization
  // 6. Return sanitized slug
}
```

### 4. Error Handling

**Error Types**:
```typescript
class FileWriteError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'create_dir' | 'write_file' | 'rename_file',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileWriteError';
  }
}
```

**Error Scenarios**:
1. **Invalid slug**: Throw `FileWriteError` with sanitization details
2. **File exists** (overwrite=false): Throw `FileWriteError` with path
3. **Directory creation fails**: Throw `FileWriteError` with permission/space details
4. **File write fails**: Cleanup temp file, throw `FileWriteError`
5. **Rename fails** (atomic writes): Keep temp file for debugging, throw `FileWriteError`

### 5. Atomic Writes Implementation

```typescript
private async writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, content, this.encoding);

    // Rename to final location (atomic operation on most filesystems)
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Cleanup temp file on error
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

---

## Implementation Steps

### Step 1: Create Type Definitions

**File**: `src/services/file-writer.ts`

```typescript
export interface FileWriterConfig {
  overwrite?: boolean;
  encoding?: BufferEncoding;
  atomicWrites?: boolean;
}

export class FileWriteError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileWriteError';
  }
}
```

### Step 2: Implement Core Methods

**Priority Order**:
1. `sanitizeSlug()` - Path validation (highest security priority)
2. `postExists()` - Simple existence check
3. `writeFileAtomic()` / `writeFileDirect()` - File writing
4. `writePost()` - Main orchestrator method

### Step 3: Add Error Handling

- Wrap all fs operations in try-catch
- Provide context in error messages (path, operation)
- Chain original errors as `cause`
- Cleanup temp files on failure

### Step 4: Write Unit Tests

**File**: `tests/unit/file-writer.test.ts`

**Test Categories**:

#### A. Path Validation Tests (6 tests)
- ✅ Accept valid slugs (`my-blog-post`, `post-123`)
- ✅ Reject parent directory traversal (`../etc/passwd`)
- ✅ Reject absolute paths (`/etc/passwd`)
- ✅ Sanitize special characters (`my:post` → `my-post`)
- ✅ Handle Unicode characters correctly
- ✅ Reject empty slugs after sanitization

#### B. Directory Creation Tests (4 tests)
- ✅ Create directory if it doesn't exist
- ✅ Don't fail if directory already exists
- ✅ Create nested directories recursively
- ✅ Throw error on permission denied

#### C. File Writing Tests (6 tests)
- ✅ Write frontmatter + content correctly
- ✅ Create index.md in post directory
- ✅ Return absolute path to written file
- ✅ Respect encoding configuration
- ✅ Write empty content (edge case)
- ✅ Handle very large content (stress test)

#### D. Atomic Writes Tests (4 tests)
- ✅ Write to .tmp file first
- ✅ Rename .tmp to final file
- ✅ Cleanup .tmp file on write failure
- ✅ Cleanup .tmp file on rename failure

#### E. Overwrite Behavior Tests (3 tests)
- ✅ Throw error if file exists (overwrite=false)
- ✅ Overwrite file if overwrite=true
- ✅ Create file if doesn't exist (regardless of overwrite)

#### F. postExists() Tests (3 tests)
- ✅ Return true if post directory exists
- ✅ Return false if post directory doesn't exist
- ✅ Return false on invalid slug

#### G. Error Handling Tests (5 tests)
- ✅ Wrap fs errors in FileWriteError
- ✅ Include path in error message
- ✅ Include operation type in error
- ✅ Chain original error as cause
- ✅ Cleanup on failure scenarios

**Total Tests**: ~31 tests (targeting 90%+ coverage)

### Step 5: Implement Mock Helpers

**File**: `tests/mocks/mocks.ts` (extend existing)

Add fs mocking utilities:
```typescript
export function createMockFsModule() {
  return {
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
    },
    existsSync: vi.fn(),
  };
}
```

---

## Integration Points

### 1. Converter Integration

**Usage in Converter** (`src/converter.ts`):
```typescript
private async convertPost(post: HashnodePost): Promise<void> {
  // ... parse, transform, process images, generate frontmatter

  const fileWriter = new FileWriter({ overwrite: false });

  // Check if post already exists
  if (fileWriter.postExists(this.outputDir, slug)) {
    this.logger.info(`Skipped: ${slug} (already exists)`);
    return;
  }

  // Write post to disk
  const filePath = await fileWriter.writePost(
    this.outputDir,
    slug,
    frontmatter,
    content
  );

  this.logger.success(`Created: ${filePath}`);
}
```

### 2. Configuration Flow

From CLI → Converter → FileWriter:
```typescript
// CLI
const options: ConversionOptions = {
  skipExisting: true,  // Maps to checking postExists()
};

// Converter creates FileWriter
const fileWriter = new FileWriter({
  overwrite: !options.skipExisting,  // Invert logic
});
```

---

## Testing Strategy

### 1. Unit Test Approach

**Mocking**:
- Mock `fs` module completely
- Mock `path` module for cross-platform testing
- Use vitest `vi.mock()` at module level

**Test Structure**:
```typescript
describe('FileWriter', () => {
  let fileWriter: FileWriter;
  let mockFs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs = createMockFsModule();
    vi.mocked(fs).mockImplementation(mockFs);
    fileWriter = new FileWriter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writePost()', () => {
    // Tests here
  });

  describe('postExists()', () => {
    // Tests here
  });

  describe('sanitizeSlug()', () => {
    // Tests here (if made public for testing)
  });
});
```

### 2. Coverage Targets

**Target**: 90%+ coverage

**Coverage by Category**:
- Statements: ≥90%
- Branches: ≥90% (critical for error paths)
- Functions: 100% (all public methods)
- Lines: ≥90%

**Critical Paths**:
- All error handlers (throw/catch branches)
- Atomic write cleanup paths
- Path validation branches
- Overwrite logic branches

---

## Potential Challenges & Solutions

### Challenge 1: Path Traversal Security

**Issue**: Malicious slugs could write outside outputDir

**Solution**:
- Sanitize slugs aggressively
- Use `path.resolve()` to get absolute paths
- Check that resolved path starts with `path.resolve(outputDir)`
- Reject any path that escapes the output directory

```typescript
private validatePath(outputDir: string, slug: string): void {
  const sanitized = this.sanitizeSlug(slug);
  const resolvedOutput = path.resolve(outputDir);
  const resolvedPost = path.resolve(outputDir, sanitized);

  if (!resolvedPost.startsWith(resolvedOutput)) {
    throw new FileWriteError(
      `Invalid slug: would write outside output directory`,
      resolvedPost,
      'validate_path'
    );
  }
}
```

### Challenge 2: Filesystem Permissions

**Issue**: Cannot write to directory (EACCES)

**Solution**:
- Catch EACCES errors specifically
- Provide helpful error message
- Suggest checking permissions or disk space
- Include directory path in error message

### Challenge 3: Unicode and Special Characters

**Issue**: Some filesystems don't support all Unicode characters

**Solution**:
- Use conservative slug sanitization
- Replace problematic characters with safe alternatives
- Log warning when sanitization changes slug
- Document supported character set

### Challenge 4: Concurrent Writes

**Issue**: Multiple processes writing to same file

**Solution**:
- Use atomic writes (.tmp + rename) by default
- Document that service is not thread-safe across processes
- Suggest using file locking for concurrent scenarios (future enhancement)

### Challenge 5: Disk Space

**Issue**: Out of disk space (ENOSPC)

**Solution**:
- Catch ENOSPC errors specifically
- Clean up temp files immediately
- Provide clear error message with disk space suggestion

---

## Success Criteria

### Functional Requirements

- ✅ `writePost()` creates directory and writes `index.md`
- ✅ `postExists()` accurately checks for existing posts
- ✅ Path validation prevents directory traversal
- ✅ Atomic writes prevent partial file corruption
- ✅ Proper error handling with descriptive messages
- ✅ Configurable overwrite behavior

### Non-Functional Requirements

- ✅ 90%+ test coverage (statements, branches, functions, lines)
- ✅ No `any` types in production code
- ✅ All public methods documented with JSDoc
- ✅ TypeScript compilation passes (`npm run type-check`)
- ✅ Build succeeds (`npm run build`)
- ✅ All tests pass (`npm test`)

### Code Quality

- ✅ Follows ImageDownloader pattern for consistency
- ✅ Single responsibility principle
- ✅ Comprehensive error handling
- ✅ Unix compatibility (macOS, Linux)
- ✅ Security-conscious (path validation)

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `FileWriterConfig` interface
- [ ] Create `FileWriteError` class
- [ ] Implement `sanitizeSlug()` private method
- [ ] Implement `validatePath()` private method
- [ ] Implement `postExists()` public method
- [ ] Implement `writeFileAtomic()` private method
- [ ] Implement `writeFileDirect()` private method
- [ ] Implement `writePost()` public method
- [ ] Add JSDoc comments to all methods

### Phase 2: Testing
- [ ] Create mock helpers for fs operations
- [ ] Write path validation tests (8 tests)
- [ ] Write directory creation tests (4 tests)
- [ ] Write file writing tests (6 tests)
- [ ] Write atomic writes tests (4 tests)
- [ ] Write overwrite behavior tests (3 tests)
- [ ] Write postExists() tests (3 tests)
- [ ] Write error handling tests (5 tests)

### Phase 3: Verification
- [ ] Run `npm run type-check` (0 errors)
- [ ] Run `npm run build` (dist/ created)
- [ ] Run `npm test` (all tests pass)
- [ ] Run `npm run test:coverage` (90%+ coverage)
- [ ] Verify no `any` types in implementation
- [ ] Review JSDoc completeness

### Phase 4: Documentation
- [ ] Update PHASE_3.md with completion status
- [ ] Update TRANSITION.md Phase 3.2 status to complete
- [ ] Update issue #2 with completion notes
- [ ] Document any deviations from plan

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Path traversal vulnerability | Medium | High | Comprehensive slug sanitization, path validation |
| Atomic write failures | Low | Medium | Comprehensive error handling, temp file cleanup |
| Unicode filename issues | Low | Low | Conservative sanitization, document limitations |
| Disk space errors | Low | High | Clear error messages, temp file cleanup |
| Permission errors | Medium | High | Catch EACCES, provide helpful error messages |

---

## Timeline Estimate

**Total Estimated Time**: 4-6 hours

- Phase 1 (Core Implementation): 2-3 hours
  - Interface design: 30 min
  - Path validation: 45 min
  - File writing logic: 1 hour
  - Error handling: 45 min

- Phase 2 (Testing): 1.5-2 hours
  - Mock setup: 30 min
  - Test writing: 1-1.5 hours

- Phase 3 (Verification): 30 min
  - Run checks, fix issues

- Phase 4 (Documentation): 30 min
  - Update status, close issue

---

## Reference Implementation

From `convert-hashnode.js` (lines 238-325):

```javascript
// Create the export directory
const blogDir = path.join(exportDir, slug);
if (!fs.existsSync(blogDir)) {
  fs.mkdirSync(blogDir, { recursive: true });
}

// ... (image processing)

// Generate YAML frontmatter
const frontmatter = `---
title: ${title}
date: "${dateAdded}"
description: "${description}"
tags:
---
`;

// Combine frontmatter + content
const markdown = frontmatter + '\n' + fixedContent;

// Write the markdown file
const indexPath = path.join(blogDir, 'index.md');
fs.writeFileSync(indexPath, markdown, 'utf8');
```

**Key Differences in New Implementation**:
1. **Async operations** (vs sync in original)
2. **Path validation** (vs no validation in original)
3. **Atomic writes** (vs direct write in original)
4. **Error handling** (vs minimal in original)
5. **Configuration** (vs hardcoded behavior in original)
6. **Type safety** (vs untyped JavaScript in original)

---

## Implementation Decisions

1. **Sync vs Async**: Use async operations for consistency with ImageDownloader and future-proofing ✅

2. **Atomic Writes Default**: Atomic writes enabled by default (atomicWrites: true) ✅

3. **Slug Sanitization**: Conservative approach (alphanumeric, hyphens, underscores only) ✅

4. **Platform Support**: Unix-like systems only (macOS, Linux). Windows is not supported ✅

5. **Error Types**: Single FileWriteError class with `operation` discriminator ✅

---

## Next Steps After Implementation

1. **Update Converter**: Integrate FileWriter into conversion pipeline
2. **Phase 3.3**: Implement Logger service
3. **Phase 4**: Implement processors (PostParser, MarkdownTransformer, etc.)
4. **Integration Tests**: Test full pipeline with FileWriter

---

## Summary

**Phase 3.2** will deliver a production-ready, type-safe FileWriter service that:
- Safely writes blog posts to the filesystem
- Validates paths to prevent security issues
- Handles errors gracefully with descriptive messages
- Supports atomic writes to prevent corruption
- Achieves 90%+ test coverage
- Follows established project patterns

**Ready to implement?** This plan provides comprehensive guidance for building a robust, well-tested FileWriter service that integrates seamlessly with the existing codebase.
