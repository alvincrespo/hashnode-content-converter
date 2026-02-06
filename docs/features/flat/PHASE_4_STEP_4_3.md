# Phase 4.3: Converter Integration Tests for Flat Mode - Implementation Plan

**Issue**: [#53 - Write Converter Integration Tests for Flat Mode](https://github.com/alvincrespo/hashnode-content-converter/issues/53)
**Status**: ✅ COMPLETED
**Date**: 2026-02-06
**Phase**: Flat Output Mode Implementation - Step 4.3

---

## Overview

Add 7 comprehensive integration tests for the flat output mode in `Converter.convertAllPosts()`. These tests will use **real file I/O** with temporary directories to verify the complete end-to-end pipeline, complementing the existing 10 unit tests that use mocks.

**Scope**:
- **In Scope**: Integration tests for `convertAllPosts()` with real filesystem operations, verifying actual file structure, markdown content, and skip behavior
- **Out of Scope**: Additional `convertPost()` tests (already covered by 9 unit tests), real image downloads (will mock ImageDownloader)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../docs/IMPLEMENTATION_FLAT.md#step-43-write-converter-integration-tests) (lines 904-977)

---

## Requirements Summary

From [IMPLEMENTATION_FLAT.md](docs/IMPLEMENTATION_FLAT.md) (lines 904-977):

### Functional Requirements
1. ✅ Test full pipeline in flat mode produces `{slug}.md` files
2. ✅ Test image directory created as sibling to output (`../_images/`)
3. ✅ Test image path prefix (`/images/`) in output markdown content
4. ✅ Test post existence check works with flat files (skip existing)
5. ✅ Test custom `imageFolderName` option (e.g., `assets`)
6. ✅ Test custom `imagePathPrefix` option (e.g., `/static/images`)
7. ✅ Test nested mode unchanged (backward compatibility regression test)

### Non-Functional Requirements
- **99.5%+ test coverage** maintained (currently 450 tests passing)
- **Real file I/O** using temporary directories
- **Fast execution** by mocking image downloads (avoid network calls)
- **No modifications** to existing 10 unit tests
- **Follows existing patterns** from converter.test.ts

---

## Architecture Design

### 1. Test Suite Structure

**File**: `tests/integration/converter.test.ts`

**New Test Block** (after existing flat mode tests):
```typescript
describe('convertAllPosts - Flat Output Mode Integration', () => {
  let tempDir: string;
  let exportPath: string;
  let outputDir: string;
  let converter: Converter;

  beforeEach(() => {
    // Create temp directory structure
    // Setup real Converter instance (no mocks)
    // Create export JSON with sample posts
  });

  afterEach(() => {
    // Cleanup temp directories
  });

  // 7 integration tests here
});
```

### 2. Test Architecture Pattern

**Existing Tests** (lines 818-1062):
- Type: Unit tests with mocked dependencies
- Method: `convertPost()` (single post)
- File I/O: Mocked (`vi.mock('node:fs')`)
- Purpose: Verify internal wiring and option passing

**New Tests** (Step 4.3):
- Type: Integration tests with real file system
- Method: `convertAllPosts()` (full pipeline)
- File I/O: Real (temporary directories)
- Purpose: Verify end-to-end functionality and actual output

### 3. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Use temp directories** | Isolated test environment, safe cleanup, no test pollution |
| **Mock ImageDownloader only** | Keep tests fast, focus on file structure not network I/O |
| **Focus on convertAllPosts** | Main gap in coverage; convertPost already has 9 unit tests |
| **Separate test block** | Clear distinction from unit tests, no interference |
| **Real Converter instance** | Test actual implementation, not mocked behavior |

---

## Technical Approach

### 1. Test Environment Setup

**Temporary Directory Pattern**:
```typescript
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

beforeEach(() => {
  // Create unique temp directory
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashnode-flat-test-'));

  // Setup directory structure for flat mode
  outputDir = path.join(tempDir, 'blog', '_posts');
  fs.mkdirSync(outputDir, { recursive: true });

  // Create export JSON
  exportPath = path.join(tempDir, 'export.json');
  const exportData = {
    posts: [/* sample posts */]
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Create real Converter (mock ImageDownloader only)
  converter = new Converter(/* real dependencies with mocked downloader */);
});

afterEach(() => {
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});
```

### 2. Mocking Strategy

**Mock Only ImageDownloader**:
```typescript
// Mock image downloads to avoid network calls
vi.mock('../src/services/image-downloader.ts', () => ({
  ImageDownloader: class MockImageDownloader {
    async download(url: string, filepath: string) {
      // Create empty file to simulate download
      fs.writeFileSync(filepath, 'mock image data');
      return { success: true, is403: false };
    }

    static extractHash(url: string): string {
      // Extract hash from Hashnode CDN URL
      const match = url.match(/\/([a-f0-9-]+)\.(png|jpg|jpeg|gif|webp)$/i);
      return match ? `${match[1]}.${match[2]}` : 'default.png';
    }
  }
}));
```

### 3. Verification Pattern

**File Structure Assertion**:
```typescript
// Verify flat mode output structure
expect(fs.existsSync(path.join(outputDir, 'post-slug.md'))).toBe(true);
expect(fs.existsSync(path.join(outputDir, 'post-slug'))).toBe(false); // No directory

// Verify image directory
const imageDir = path.join(outputDir, '..', '_images');
expect(fs.existsSync(imageDir)).toBe(true);
```

**Content Assertion**:
```typescript
// Read and verify markdown content
const content = fs.readFileSync(path.join(outputDir, 'post-slug.md'), 'utf8');

// Verify frontmatter
expect(content).toMatch(/^---\n/);
expect(content).toContain('title:');
expect(content).toContain('slug: post-slug');

// Verify image paths
expect(content).toContain('![alt](/images/');
expect(content).not.toContain('![alt](https://cdn.hashnode.com');
```

---

## Implementation Steps

### Test 1: Full Pipeline in Flat Mode

**Purpose**: Verify `convertAllPosts()` creates `{slug}.md` files in flat mode

**File**: `tests/integration/converter.test.ts` (new test block)

**Implementation**:
```typescript
it('should write posts as {slug}.md in flat mode', async () => {
  // Arrange
  const exportData = {
    posts: [
      {
        _id: 'test001',
        slug: 'test-post-1',
        title: 'Test Post 1',
        contentMarkdown: '# Heading\n\nContent here.',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test brief',
        tags: [],
      },
      {
        _id: 'test002',
        slug: 'test-post-2',
        title: 'Test Post 2',
        contentMarkdown: '# Another Post',
        dateAdded: '2024-01-16T10:00:00.000Z',
        brief: 'Another brief',
        tags: [],
      },
    ],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act
  const result = await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: { mode: 'flat' },
    skipExisting: false,
  });

  // Assert - Result stats
  expect(result.converted).toBe(2);
  expect(result.skipped).toBe(0);
  expect(result.errors).toHaveLength(0);

  // Assert - File structure (flat mode)
  expect(fs.existsSync(path.join(outputDir, 'test-post-1.md'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'test-post-2.md'))).toBe(true);

  // Assert - No nested directories created
  expect(fs.existsSync(path.join(outputDir, 'test-post-1'))).toBe(false);
  expect(fs.existsSync(path.join(outputDir, 'test-post-2'))).toBe(false);

  // Assert - Content format
  const content1 = fs.readFileSync(path.join(outputDir, 'test-post-1.md'), 'utf8');
  expect(content1).toMatch(/^---\n/); // Frontmatter start
  expect(content1).toContain('title: Test Post 1');
  expect(content1).toContain('# Heading');
});
```

---

### Test 2: Image Directory as Sibling

**Purpose**: Verify images are placed in sibling `_images` folder

**Implementation**:
```typescript
it('should place images in sibling _images folder', async () => {
  // Arrange
  const exportData = {
    posts: [{
      _id: 'test001',
      slug: 'post-with-image',
      title: 'Post With Image',
      contentMarkdown: '![alt](https://cdn.hashnode.com/res/hashnode/image/upload/abc-123.png)',
      dateAdded: '2024-01-15T10:00:00.000Z',
      brief: 'Test',
      tags: [],
    }],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act
  await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: { mode: 'flat' },
  });

  // Assert - Image directory structure
  const imageDir = path.join(outputDir, '..', '_images');
  expect(fs.existsSync(imageDir)).toBe(true);

  // Assert - Image file exists (mocked download)
  const imageFiles = fs.readdirSync(imageDir);
  expect(imageFiles.length).toBeGreaterThan(0);
  expect(imageFiles[0]).toMatch(/abc-123\.png/);

  // Assert - Image not in post directory
  const postDir = path.join(outputDir, 'post-with-image');
  expect(fs.existsSync(postDir)).toBe(false);
});
```

---

### Test 3: Image Path Prefix in Markdown

**Purpose**: Verify markdown contains `/images/` prefix for image references

**Implementation**:
```typescript
it('should use /images prefix in markdown references', async () => {
  // Arrange
  const exportData = {
    posts: [{
      _id: 'test001',
      slug: 'image-post',
      title: 'Image Post',
      contentMarkdown: 'Text ![alt](https://cdn.hashnode.com/res/hashnode/image/upload/xyz-789.jpg) more text',
      dateAdded: '2024-01-15T10:00:00.000Z',
      brief: 'Test',
      tags: [],
    }],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act
  await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: { mode: 'flat' },
  });

  // Assert - Read markdown content
  const content = fs.readFileSync(path.join(outputDir, 'image-post.md'), 'utf8');

  // Assert - Image path uses absolute prefix
  expect(content).toContain('![alt](/images/xyz-789.jpg)');

  // Assert - CDN URL replaced
  expect(content).not.toContain('https://cdn.hashnode.com');

  // Assert - Not using relative path
  expect(content).not.toContain('![alt](./xyz-789.jpg)');
});
```

---

### Test 4: Skip Existing Files

**Purpose**: Verify `skipExisting: true` works with flat files

**Implementation**:
```typescript
it('should skip existing {slug}.md files when skipExisting is true', async () => {
  // Arrange
  const exportData = {
    posts: [
      {
        _id: 'test001',
        slug: 'existing-post',
        title: 'Existing Post',
        contentMarkdown: '# New Content',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test',
        tags: [],
      },
      {
        _id: 'test002',
        slug: 'new-post',
        title: 'New Post',
        contentMarkdown: '# Fresh Content',
        dateAdded: '2024-01-16T10:00:00.000Z',
        brief: 'Test',
        tags: [],
      },
    ],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Pre-create existing post file
  const existingContent = '---\ntitle: Old Version\n---\n\n# Old Content';
  fs.writeFileSync(path.join(outputDir, 'existing-post.md'), existingContent);

  // Act
  const result = await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: { mode: 'flat' },
    skipExisting: true,
  });

  // Assert - Stats
  expect(result.converted).toBe(1); // Only new-post
  expect(result.skipped).toBe(1); // existing-post

  // Assert - Existing file unchanged
  const existingFileContent = fs.readFileSync(
    path.join(outputDir, 'existing-post.md'),
    'utf8'
  );
  expect(existingFileContent).toBe(existingContent);
  expect(existingFileContent).toContain('Old Version');
  expect(existingFileContent).not.toContain('New Content');

  // Assert - New file created
  expect(fs.existsSync(path.join(outputDir, 'new-post.md'))).toBe(true);
  const newFileContent = fs.readFileSync(path.join(outputDir, 'new-post.md'), 'utf8');
  expect(newFileContent).toContain('Fresh Content');
});
```

---

### Test 5: Custom imageFolderName

**Purpose**: Verify custom image folder name (e.g., `assets`)

**Implementation**:
```typescript
it('should respect custom imageFolderName', async () => {
  // Arrange
  const exportData = {
    posts: [{
      _id: 'test001',
      slug: 'custom-folder-post',
      title: 'Custom Folder Post',
      contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/custom-123.png)',
      dateAdded: '2024-01-15T10:00:00.000Z',
      brief: 'Test',
      tags: [],
    }],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act
  await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: {
      mode: 'flat',
      imageFolderName: 'assets', // Custom name
    },
  });

  // Assert - Custom image directory exists
  const customImageDir = path.join(outputDir, '..', 'assets');
  expect(fs.existsSync(customImageDir)).toBe(true);

  // Assert - Default _images directory NOT created
  const defaultImageDir = path.join(outputDir, '..', '_images');
  expect(fs.existsSync(defaultImageDir)).toBe(false);

  // Assert - Image file in custom directory
  const imageFiles = fs.readdirSync(customImageDir);
  expect(imageFiles.some(f => f.includes('custom-123'))).toBe(true);
});
```

---

### Test 6: Custom imagePathPrefix

**Purpose**: Verify custom image path prefix (e.g., `/static/images`)

**Implementation**:
```typescript
it('should respect custom imagePathPrefix', async () => {
  // Arrange
  const exportData = {
    posts: [{
      _id: 'test001',
      slug: 'custom-prefix-post',
      title: 'Custom Prefix Post',
      contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/prefix-456.jpg)',
      dateAdded: '2024-01-15T10:00:00.000Z',
      brief: 'Test',
      tags: [],
    }],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act
  await converter.convertAllPosts(exportPath, outputDir, {
    outputStructure: {
      mode: 'flat',
      imagePathPrefix: '/static/images', // Custom prefix
    },
  });

  // Assert - Read markdown content
  const content = fs.readFileSync(
    path.join(outputDir, 'custom-prefix-post.md'),
    'utf8'
  );

  // Assert - Custom prefix used
  expect(content).toContain('![img](/static/images/prefix-456.jpg)');

  // Assert - Default prefix NOT used
  expect(content).not.toContain('![img](/images/prefix-456.jpg)');
  expect(content).not.toContain('![img](./prefix-456.jpg)');
});
```

---

### Test 7: Backward Compatibility (Nested Mode)

**Purpose**: Verify nested mode still works as default (regression test)

**Implementation**:
```typescript
it('should maintain backwards compatibility in nested mode', async () => {
  // Arrange
  const exportData = {
    posts: [{
      _id: 'test001',
      slug: 'nested-post',
      title: 'Nested Post',
      contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/nested-789.png)',
      dateAdded: '2024-01-15T10:00:00.000Z',
      brief: 'Test',
      tags: [],
    }],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData));

  // Act - No outputStructure option (defaults to nested)
  await converter.convertAllPosts(exportPath, outputDir);

  // Assert - Nested directory structure
  const postDir = path.join(outputDir, 'nested-post');
  expect(fs.existsSync(postDir)).toBe(true);
  expect(fs.existsSync(path.join(postDir, 'index.md'))).toBe(true);

  // Assert - No flat file
  expect(fs.existsSync(path.join(outputDir, 'nested-post.md'))).toBe(false);

  // Assert - Image in post directory
  const imageFiles = fs.readdirSync(postDir);
  expect(imageFiles.some(f => f.includes('nested-789'))).toBe(true);

  // Assert - Content uses relative path
  const content = fs.readFileSync(path.join(postDir, 'index.md'), 'utf8');
  expect(content).toContain('![img](./nested-789.png)');
  expect(content).not.toContain('/images/');
});
```

---

## Testing Strategy

### 1. Setup Pattern

```typescript
describe('convertAllPosts - Flat Output Mode Integration', () => {
  let tempDir: string;
  let exportPath: string;
  let outputDir: string;
  let converter: Converter;
  let mockDownloader: vi.MockedClass<typeof ImageDownloader>;

  beforeEach(() => {
    // 1. Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashnode-flat-test-'));

    // 2. Setup nested output structure (required for flat mode)
    outputDir = path.join(tempDir, 'blog', '_posts');
    fs.mkdirSync(outputDir, { recursive: true });

    // 3. Mock ImageDownloader class
    mockDownloader = vi.mocked(ImageDownloader);
    mockDownloader.prototype.download = vi.fn().mockImplementation(
      async (url: string, filepath: string) => {
        fs.writeFileSync(filepath, 'mock image data');
        return { success: true, is403: false };
      }
    );
    mockDownloader.extractHash = vi.fn().mockImplementation((url: string) => {
      const match = url.match(/\/([a-f0-9-]+)\.(png|jpg|jpeg|gif|webp)$/i);
      return match ? `${match[1]}.${match[2]}` : 'default.png';
    });

    // 4. Create real Converter instance with real dependencies
    converter = new Converter();

    // 5. Export path (created per-test with specific data)
    exportPath = path.join(tempDir, 'export.json');
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  // Tests here...
});
```

### 2. Test Data Pattern

**Sample Post Template**:
```typescript
const createSamplePost = (overrides: Partial<HashnodePost> = {}) => ({
  _id: 'test001',
  slug: 'test-post',
  title: 'Test Post',
  contentMarkdown: '# Test Content',
  dateAdded: '2024-01-15T10:00:00.000Z',
  brief: 'Test brief',
  tags: [],
  ...overrides,
});
```

### 3. Assertion Helpers

```typescript
// Helper: Check file exists
const expectFileExists = (relativePath: string) => {
  const fullPath = path.join(outputDir, relativePath);
  expect(fs.existsSync(fullPath)).toBe(true);
};

// Helper: Check file does not exist
const expectFileNotExists = (relativePath: string) => {
  const fullPath = path.join(outputDir, relativePath);
  expect(fs.existsSync(fullPath)).toBe(false);
};

// Helper: Read file content
const readFile = (relativePath: string): string => {
  return fs.readFileSync(path.join(outputDir, relativePath), 'utf8');
};
```

---

## Integration Points

### 1. Converter Entry Point

**Method**: `Converter.convertAllPosts()`
- **Input**: Export file path, output directory, options
- **Options**: `{ outputStructure: { mode: 'flat', imageFolderName?, imagePathPrefix? } }`
- **Output**: `ConversionResult` with stats

### 2. File System

**Real Operations**:
- `fs.mkdtempSync()` - Create temp directories
- `fs.mkdirSync()` - Create output directories
- `fs.writeFileSync()` - Create export JSON and markdown files
- `fs.readFileSync()` - Read generated markdown
- `fs.readdirSync()` - List generated files
- `fs.existsSync()` - Check file/directory existence
- `fs.rmSync()` - Cleanup temp directories

### 3. Mocked Dependencies

**ImageDownloader** (only mocked component):
- Mock `download()` to create empty files (avoid network)
- Mock `extractHash()` to extract filename from CDN URLs
- Real file creation simulates successful download

---

## Success Criteria

### Functional Requirements
- ✅ All 7 integration tests pass
- ✅ Tests verify actual file structure on disk
- ✅ Tests verify markdown content includes correct image paths
- ✅ Tests verify skip existing logic with flat files
- ✅ Tests verify custom options work correctly
- ✅ Tests verify backward compatibility with nested mode

### Non-Functional Requirements
- ✅ 99.5%+ test coverage maintained
- ✅ Tests execute in <5 seconds total
- ✅ Tests are isolated (no shared state)
- ✅ Tests cleanup temp directories
- ✅ No modifications to existing tests

### Code Quality
- ✅ Tests follow existing patterns (beforeEach/afterEach)
- ✅ Tests use descriptive assertion messages
- ✅ Tests are readable and maintainable
- ✅ Tests verify both positive and negative cases

---

## Verification Checklist

### Pre-Implementation
- [ ] Review existing tests (lines 818-1062)
- [ ] Review Converter.convertAllPosts() implementation
- [ ] Review temp directory patterns in Node.js
- [ ] Confirm ImageDownloader mock approach

### Post-Implementation

```bash
# Run only new integration tests
npm test -- --run tests/integration/converter.test.ts -t "convertAllPosts - Flat Output Mode Integration"

# Expected: 7 tests pass

# Run all tests
npm test -- --run

# Expected: 457 tests pass (450 existing + 7 new)

# Check coverage
npm run test:coverage

# Expected: 99.5%+ coverage maintained
```

---

## Implementation Checklist

### Phase 1: Setup (30 min)
- [ ] Add new test block after existing flat mode tests
- [ ] Implement beforeEach/afterEach with temp directory
- [ ] Setup ImageDownloader mocks
- [ ] Create sample post helper function

### Phase 2: Core Tests (60 min)
- [ ] Test 1: Full pipeline in flat mode
- [ ] Test 2: Image directory as sibling
- [ ] Test 3: Image path prefix in markdown
- [ ] Test 4: Skip existing files

### Phase 3: Configuration Tests (30 min)
- [ ] Test 5: Custom imageFolderName
- [ ] Test 6: Custom imagePathPrefix

### Phase 4: Regression Test (15 min)
- [ ] Test 7: Backward compatibility (nested mode)

### Phase 5: Verification (30 min)
- [ ] Run all tests and verify pass
- [ ] Check coverage report (npm run test:coverage)
- [ ] Review test output for clarity
- [ ] Cleanup any console warnings

### Phase 6: Documentation (15 min)
- [ ] Update IMPLEMENTATION_FLAT.md checkboxes
- [ ] Update GitHub issue #53 status
- [ ] Document any deviations from plan

---

## Future Improvements

### ImageProcessor Dependency Injection

**Current Limitation**: `ImageProcessor` creates its own `ImageDownloader` internally, preventing proper mocking in integration tests:

```typescript
// Current implementation (src/processors/image-processor.ts:57-73)
constructor(options?: ImageProcessorOptions) {
  this.options = { /* ... */ };
  this.downloader = new ImageDownloader({ /* ... */ }); // ← Created internally
}
```

**Proposed Solution**: Add optional `downloader` parameter for dependency injection:

```typescript
constructor(
  options?: ImageProcessorOptions,
  downloader?: ImageDownloader
) {
  this.options = { /* ... */ };
  this.downloader = downloader ?? new ImageDownloader({ /* ... */ });
}
```

**Benefits**:
- Enables reliable image download mocking in integration tests
- Eliminates need for conditional assertions
- Improves test predictability and eliminates false positives
- Maintains backward compatibility (optional parameter)

**Tracking**: See GitHub issue for implementation details

---

## Potential Challenges & Solutions

### Challenge 1: Temp Directory Cleanup on Test Failure

**Issue**: If a test fails mid-execution, temp directories might not be cleaned up

**Solution**: Use `afterEach` with `force: true` option on `fs.rmSync()` to ensure cleanup even on failure

**Risk Level**: Low

---

### Challenge 2: ImageDownloader Mock Complexity

**Issue**: ImageDownloader has multiple methods and complex return types

**Solution**: Mock only the essential methods (`download()`, `extractHash()`). Keep mock simple - just create empty files.

**Risk Level**: Low

---

### Challenge 3: Test Execution Time

**Issue**: 7 integration tests with real file I/O might slow down test suite

**Solution**:
- Mock ImageDownloader to avoid network delay
- Use small test fixtures (1-2 posts per test)
- Parallel test execution (Vitest default)

**Risk Level**: Low (estimated <5s total for 7 tests)

---

## Timeline Estimate

**Total Estimated Time**: 3-4 hours

- **Phase 1** (Setup): 30 minutes
- **Phase 2** (Core Tests): 60 minutes
- **Phase 3** (Configuration Tests): 30 minutes
- **Phase 4** (Regression Test): 15 minutes
- **Phase 5** (Verification): 30 minutes
- **Phase 6** (Documentation): 15 minutes

---

## Key Files

| File | Action | Lines |
|------|--------|-------|
| `tests/integration/converter.test.ts` | **ADD** new test block | After line 1062 |
| `docs/IMPLEMENTATION_FLAT.md` | **UPDATE** checkboxes | Lines 905-911 |

---

## Next Steps After Implementation

1. Run full test suite: `npm test -- --run`
2. Generate coverage report: `npm run test:coverage`
3. Update GitHub issue #53 to "Complete"
4. Mark Step 4.3 as complete in IMPLEMENTATION_FLAT.md
5. Proceed to Step 4.4 (Document ImageProcessor Instance Independence)

---

## Summary

**Step 4.3** will deliver **7 comprehensive integration tests** that:
- Verify the complete `convertAllPosts()` pipeline with real file I/O
- Test flat mode creates `{slug}.md` files and sibling image directories
- Validate skip existing logic works with flat files
- Confirm custom configuration options work correctly
- Ensure backward compatibility with nested mode

**Test Strategy**: Real filesystem operations with mocked image downloads for fast, reliable integration testing.

**Coverage Impact**: Maintains 99.5%+ coverage while adding critical end-to-end validation.

**Ready to implement?** This plan provides step-by-step guidance for building robust integration tests that complement the existing unit tests.
