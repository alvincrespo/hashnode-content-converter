# Phase 2.2: Update FileWriter postExists Method - Implementation Plan

**Issue**: [#46 - 2.2 Update FileWriter postExists Method](https://github.com/alvincrespo/hashnode-content-converter/issues/46)
**Status**: IMPLEMENTED
**Date**: 2026-01-13
**Phase**: Phase 2 - FileWriter Service Updates

---

## Overview

Update the `postExists` method in FileWriter to check for `{slug}.md` files in flat mode instead of `{slug}/` directories in nested mode. This enables the `skipExisting` feature to work correctly with flat output mode.

**Scope**:
- IN SCOPE: Update `postExists()` method, add unit tests for flat mode
- OUT OF SCOPE: `writePost()` changes (Step 2.3), Converter integration (Step 4.2)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 348-378)

---

## Requirements Summary

From GitHub Issue #46:

- Check for `{slug}.md` file in flat mode
- Check for `{slug}/` directory in nested mode (current behavior)
- Add unit tests for flat mode existence check

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Backwards compatible - nested mode unchanged
- Graceful error handling (return false on errors)

---

## Architecture Design

### 1. Method API (No Change)

```typescript
/**
 * Check if a post already exists in the output directory.
 * In nested mode, checks for directory existence.
 * In flat mode, checks for {slug}.md file existence.
 */
postExists(outputDir: string, slug: string): boolean
```

### 2. Behavior by Mode

| Mode | Check | Path Pattern | Example |
|------|-------|--------------|---------|
| Nested (default) | Directory exists | `{outputDir}/{slug}/` | `./blog/my-post/` |
| Flat | File exists | `{outputDir}/{slug}.md` | `./blog/my-post.md` |

### 3. Design Decisions

1. **Use existing `outputMode` config**: Already added in Step 2.1, stored in `this.config.outputMode`
2. **Maintain graceful error handling**: Keep try-catch, return false on errors
3. **Reuse `sanitizeSlug()`**: Both modes use the same slug sanitization

---

## Technical Approach

### Data Flow

```
postExists(outputDir, slug)
    │
    ▼
sanitizeSlug(slug)  ─── throws? ──► return false
    │
    ▼
if (this.config.outputMode === 'flat')
    │                    │
    ▼                    ▼
  FLAT MODE           NESTED MODE
    │                    │
    ▼                    ▼
path.join(outputDir,  path.join(outputDir,
  `${sanitized}.md`)    sanitized)
    │                    │
    ▼                    ▼
fs.existsSync(path)   fs.existsSync(path)
    │                    │
    └────────┬───────────┘
             ▼
       return result
```

---

## Implementation Steps

### Step 1: Update postExists Method

**File**: [src/services/file-writer.ts](../../../src/services/file-writer.ts)

**Lines**: 200-209

**Current Implementation**:
```typescript
postExists(outputDir: string, slug: string): boolean {
  try {
    const sanitized = this.sanitizeSlug(slug);
    const postDir = path.join(outputDir, sanitized);
    return fs.existsSync(postDir);
  } catch {
    return false;
  }
}
```

**New Implementation**:
```typescript
/**
 * Check if a post already exists in the output directory.
 * In nested mode, checks for directory existence.
 * In flat mode, checks for {slug}.md file existence.
 * @param outputDir - Base output directory
 * @param slug - Post slug to check
 * @returns True if post exists, false otherwise (including on errors)
 */
postExists(outputDir: string, slug: string): boolean {
  try {
    let sanitized = this.sanitizeSlug(slug);

    // Flat mode: check for {slug}.md file
    if (this.config.outputMode === 'flat') {
      sanitized = `${sanitized}.md`;
    }

    const postPath = path.join(outputDir, sanitized);
    return fs.existsSync(postPath);
  } catch {
    // If sanitization fails, the post doesn't exist (invalid slug)
    return false;
  }
}
```

---

## Testing Strategy

### 1. Unit Test Approach

**File**: [tests/unit/file-writer.test.ts](../../../tests/unit/file-writer.test.ts)

**Test Categories**:

#### A. Flat Mode - postExists() (4 tests)
- Test: return true when `{slug}.md` file exists
- Test: return false when `{slug}.md` file does not exist
- Test: check for file, not directory (directory exists but file doesn't = false)
- Test: return false on invalid slug (graceful error handling)

#### B. Nested Mode Regression (2 tests)
- Test: nested mode unchanged - checks for directory
- Test: nested mode with explicit config still works

**Total New Tests**: ~6 tests (targeting 100% coverage of new code paths)

### 2. Test Implementation

```typescript
describe('postExists() - Flat Mode', () => {
  it('should return true when {slug}.md file exists in flat mode', () => {
    const flatWriter = new FileWriter({ outputMode: 'flat' });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = flatWriter.postExists('./blog', 'test-post');

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringMatching(/test-post\.md$/)
    );
  });

  it('should return false when {slug}.md does not exist in flat mode', () => {
    const flatWriter = new FileWriter({ outputMode: 'flat' });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = flatWriter.postExists('./blog', 'non-existent');

    expect(result).toBe(false);
  });

  it('should check for file, not directory, in flat mode', () => {
    const flatWriter = new FileWriter({ outputMode: 'flat' });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    flatWriter.postExists('./blog', 'my-post');

    // Verify it checks for .md file, not directory
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('my-post.md')
    );
  });

  it('should return false on invalid slug in flat mode', () => {
    const flatWriter = new FileWriter({ outputMode: 'flat' });

    // Invalid slug triggers sanitization error
    const result = flatWriter.postExists('./blog', '/invalid/slug');

    expect(result).toBe(false);
  });
});

describe('postExists() - Nested Mode Regression', () => {
  it('should check for directory in nested mode (default)', () => {
    const nestedWriter = new FileWriter(); // Default is nested
    vi.mocked(fs.existsSync).mockReturnValue(true);

    nestedWriter.postExists('./blog', 'my-post');

    // Should NOT have .md extension
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.not.stringContaining('.md')
    );
  });

  it('should check for directory with explicit nested config', () => {
    const nestedWriter = new FileWriter({ outputMode: 'nested' });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = nestedWriter.postExists('./blog', 'my-post');

    expect(result).toBe(true);
  });
});
```

### 3. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Statements | 100% | All new code paths exercised |
| Branches | 100% | Both flat and nested branches tested |
| Functions | 100% | postExists() fully covered |
| Lines | 100% | All new lines covered |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: Converter.convertAllPosts() at line 274
- **Integration**: Uses `this.fileWriter.postExists(outputDir, slug)` for skipExisting check

### 2. Downstream (Output)
- **Output**: Boolean indicating post existence
- **Consumer**: Converter skip logic

### 3. Dependencies
- **Step 2.1**: `outputMode` config (COMPLETED)
- **Step 2.3**: `writePost()` must use same mode logic (NEXT)

---

## Potential Challenges & Solutions

### Challenge 1: Mixed Mode Output Directories

**Issue**: User runs nested mode first, then flat mode on same directory. `postExists()` would return false in flat mode even though nested post exists.

**Solution**: This is expected behavior - modes are independent. Document that switching modes doesn't detect posts from other mode.

**Risk Level**: Low (expected behavior)

### Challenge 2: Ensuring Path Pattern Consistency

**Issue**: `postExists()` path pattern must match `writePost()` pattern for consistency.

**Solution**: Step 2.3 will implement matching logic. Both use `path.join(outputDir, `${sanitized}.md`)` for flat mode.

**Risk Level**: Low (handled by implementation)

---

## Success Criteria

### Functional Requirements
- [ ] postExists() returns true for existing `{slug}.md` files in flat mode
- [ ] postExists() returns false for non-existent files in flat mode
- [ ] postExists() nested mode behavior unchanged (regression tests pass)
- [ ] Graceful error handling maintained (return false on errors)

### Non-Functional Requirements
- [ ] 100% test coverage on new code paths
- [ ] No `any` types
- [ ] JSDoc updated with flat mode documentation
- [ ] TypeScript compilation passes
- [ ] All existing tests pass

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue reviewed (#46)
- [x] Source document analyzed (IMPLEMENTATION_FLAT.md lines 348-378)
- [x] Current implementation understood (file-writer.ts lines 200-209)
- [x] Test patterns studied (file-writer.test.ts)
- [x] Step 2.1 verified complete (outputMode config exists)

### Post-Implementation
```bash
# Verify TypeScript compilation
npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
npm run build
# Expected: dist/ directory created

# Run tests
npm test
# Expected: All tests pass

# Generate coverage report
npm run test:coverage
# Expected: 99%+ coverage maintained
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Update JSDoc for postExists() method
- [ ] Add flat mode conditional check
- [ ] Build file path with `.md` extension for flat mode
- [ ] Keep nested mode logic unchanged

### Phase 2: Testing
- [ ] Add "postExists() - Flat Mode" describe block
- [ ] Write 4 flat mode tests
- [ ] Add 2 nested mode regression tests
- [ ] Verify coverage targets met

### Phase 3: Verification
- [ ] Run type-check
- [ ] Run build
- [ ] Run all tests
- [ ] Review coverage report

---

## Files to Modify

| File | Changes |
|------|---------|
| [src/services/file-writer.ts](../../../src/services/file-writer.ts) | Update postExists() method (lines 200-209) |
| [tests/unit/file-writer.test.ts](../../../tests/unit/file-writer.test.ts) | Add ~6 new tests |

---

## Summary

**Step 2.2** will update the `postExists()` method to support flat output mode by:
- Checking for `{slug}.md` files when `outputMode: 'flat'`
- Maintaining backwards compatibility with nested mode
- Adding comprehensive unit tests for both modes

This change enables the `skipExisting` feature to work correctly with flat output mode, which is essential for the overall flat mode implementation.

---

## Next Steps After Implementation

1. Mark Step 2.2 as complete in [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md)
2. Proceed to Step 2.3: Update writePost Method
3. Close GitHub Issue #46
