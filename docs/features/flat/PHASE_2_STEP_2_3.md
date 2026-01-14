# Phase 2.3: Update FileWriter writePost Method - Implementation Plan

**Issue**: [#47 - 2.3 Update FileWriter writePost Method](https://github.com/alvincrespo/hashnode-content-converter/issues/47)
**Status**: IMPLEMENTED
**Date**: 2026-01-13
**Phase**: Phase 2 - FileWriter Service Updates (Step 2.3 of 2.4)

---

## Overview

Update the `writePost` method in the FileWriter service to support flat output mode. Currently, `writePost` always creates a subdirectory structure (`{slug}/index.md`). This change will add conditional logic to write `{slug}.md` directly in the output directory when `outputMode: 'flat'` is configured.

**Scope**:
- **In scope**: Modify `writePost` method, add unit tests for flat mode behavior
- **Out of scope**: CLI integration (Phase 5), Converter integration (Phase 4)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 380-458)

---

## Requirements Summary

From [IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 380-458):

- Write to `{slug}.md` in flat mode (no subdirectory)
- Write to `{slug}/index.md` in nested mode (current behavior, unchanged)
- Ensure output directory exists in flat mode (but don't create post subdirectory)
- Add unit tests for flat mode file writing
- Maintain backwards compatibility - default behavior unchanged

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Maintain existing error handling patterns
- Preserve atomic writes behavior in both modes

---

## Architecture Design

### 1. Current Implementation (lines 228-269)

```typescript
async writePost(outputDir: string, slug: string, frontmatter: string, content: string): Promise<string> {
  const sanitized = this.sanitizeSlug(slug);

  // CURRENT: Always creates subdirectory
  const postDir = path.join(outputDir, sanitized);
  const filePath = path.join(postDir, 'index.md');

  // Check overwrite behavior
  if (!this.config.overwrite && fs.existsSync(filePath)) { ... }

  // CURRENT: Always creates post subdirectory
  await fs.promises.mkdir(postDir, { recursive: true });

  // Write file
  const markdown = frontmatter + '\n' + content;
  if (this.config.atomicWrites) {
    await this.writeFileAtomic(filePath, markdown);
  } else {
    await this.writeFileDirect(filePath, markdown);
  }

  return path.resolve(filePath);
}
```

### 2. Updated Design

```typescript
async writePost(outputDir: string, slug: string, frontmatter: string, content: string): Promise<string> {
  const sanitized = this.sanitizeSlug(slug);
  let filePath: string;

  if (this.config.outputMode === 'flat') {
    // Flat mode: {output}/{slug}.md
    filePath = path.join(outputDir, `${sanitized}.md`);

    // Ensure output directory exists (not post subdirectory)
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }
  } else {
    // Nested mode: {output}/{slug}/index.md
    const postDir = path.join(outputDir, sanitized);
    filePath = path.join(postDir, 'index.md');

    // Create post subdirectory
    await fs.promises.mkdir(postDir, { recursive: true });
  }

  // Check overwrite (same path variable for both modes)
  if (!this.config.overwrite && fs.existsSync(filePath)) { ... }

  // Write file (unchanged)
  const markdown = frontmatter + '\n' + content;
  if (this.config.atomicWrites) {
    await this.writeFileAtomic(filePath, markdown);
  } else {
    await this.writeFileDirect(filePath, markdown);
  }

  return path.resolve(filePath);
}
```

### 3. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Mode check before directory creation | Flat mode only needs output directory, not subdirectory |
| Reuse existing atomic write helpers | No changes needed to `writeFileAtomic` or `writeFileDirect` |
| Single `filePath` variable | Simplifies overwrite check and write operations |
| Check `outputDir` existence only in flat mode | Nested mode's `mkdir` with `recursive: true` handles this |

---

## Implementation Steps

### Step 1: Update writePost Method

**File**: [src/services/file-writer.ts](../../../src/services/file-writer.ts)

**Location**: Lines 228-269 (replace entire method)

**Implementation**:

```typescript
/**
 * Write a blog post with frontmatter and content to the filesystem
 * @param outputDir - Base output directory (e.g., './blog')
 * @param slug - Post slug (used as filename in flat mode, subdirectory in nested mode)
 * @param frontmatter - YAML frontmatter string (includes --- markers)
 * @param content - Markdown content body
 * @returns Absolute path to the written file
 * @throws FileWriteError if write fails or file exists (when overwrite=false)
 */
async writePost(outputDir: string, slug: string, frontmatter: string, content: string): Promise<string> {
  // Sanitize slug for filesystem safety
  const sanitized = this.sanitizeSlug(slug);
  let filePath: string;

  if (this.config.outputMode === 'flat') {
    // Flat mode: write {output}/{slug}.md directly
    filePath = path.join(outputDir, `${sanitized}.md`);

    // Ensure output directory exists (but don't create post subdirectory)
    if (!fs.existsSync(outputDir)) {
      try {
        await fs.promises.mkdir(outputDir, { recursive: true });
      } catch (error) {
        throw new FileWriteError(
          `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
          outputDir,
          'create_dir',
          error instanceof Error ? error : undefined
        );
      }
    }
  } else {
    // Nested mode: write {output}/{slug}/index.md
    const postDir = path.join(outputDir, sanitized);
    filePath = path.join(postDir, 'index.md');

    // Create post directory (recursive)
    try {
      await fs.promises.mkdir(postDir, { recursive: true });
    } catch (error) {
      throw new FileWriteError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        postDir,
        'create_dir',
        error instanceof Error ? error : undefined
      );
    }
  }

  // Check if file exists and handle overwrite behavior
  if (!this.config.overwrite && fs.existsSync(filePath)) {
    throw new FileWriteError(
      `File already exists and overwrite is disabled: ${filePath}`,
      filePath,
      'write_file'
    );
  }

  // Combine frontmatter + content
  const markdown = frontmatter + '\n' + content;

  // Write to file using selected strategy
  if (this.config.atomicWrites) {
    await this.writeFileAtomic(filePath, markdown);
  } else {
    await this.writeFileDirect(filePath, markdown);
  }

  // Return absolute path to written file
  return path.resolve(filePath);
}
```

---

## Testing Strategy

### 1. Test File Location

**File**: [tests/unit/file-writer.test.ts](../../../tests/unit/file-writer.test.ts)

### 2. New Test Cases

Add a new describe block after `describe('outputMode Configuration', ...)` (around line 515):

```typescript
describe('writePost - flat mode', () => {
  let flatWriter: FileWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    flatWriter = new FileWriter({ outputMode: 'flat' });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
  });

  // ... test cases below
});
```

### 3. Test Cases (~10 tests)

#### A. File Path Tests (3 tests)
- `should write {slug}.md directly in output directory` - Verify output path ends with `my-post.md` not `my-post/index.md`
- `should NOT create subdirectory in flat mode` - Verify mkdir called with outputDir, not postDir
- `should return absolute path ending with {slug}.md` - Verify returned path format

#### B. Directory Creation Tests (3 tests)
- `should create output directory if it does not exist` - Verify mkdir called when outputDir missing
- `should not call mkdir when output directory already exists` - Verify mkdir skipped if existsSync returns true for outputDir
- `should throw FileWriteError on mkdir failure` - Verify error handling

#### C. Overwrite Behavior Tests (2 tests)
- `should throw error if {slug}.md exists and overwrite is false` - Verify overwrite check uses correct path
- `should overwrite {slug}.md when overwrite is true` - Verify overwrite works in flat mode

#### D. Atomic Writes Tests (2 tests)
- `should use atomic writes for flat mode files` - Verify .tmp file pattern
- `should use direct writes when atomicWrites is false in flat mode`

**Total Tests**: ~10 new tests (targeting 100% coverage of flat mode code path)

### 4. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | >= 90% | All flat mode code paths exercised |
| **Branches** | >= 90% | Both `outputMode` conditions tested |
| **Functions** | 100% | writePost method fully covered |
| **Lines** | >= 90% | Complete line coverage |

---

## Integration Points

### 1. Upstream Dependencies (Complete)
- **Step 2.1**: `outputMode` config already in `FileWriterConfig` interface
- **Step 2.2**: `postExists` already handles flat mode

### 2. Downstream Dependencies (Future)
- **Phase 4**: Converter will create FileWriter with `{ outputMode: 'flat' }` when `outputStructure.mode === 'flat'`
- **Phase 5**: CLI will pass `--flat` flag through to ConversionOptions

### 3. Error Flow
- FileWriteError propagates to Converter.convertPost which wraps in ConversionError
- Logger tracks failures in conversion result

---

## Potential Challenges & Solutions

### Challenge 1: Directory Existence Check Timing

**Issue**: In flat mode, we check `fs.existsSync(outputDir)` before mkdir. This is a race condition if another process creates the directory between check and mkdir.

**Solution**: Use `mkdir({ recursive: true })` which is idempotent - it succeeds even if directory exists. Only skip mkdir for performance optimization.

**Risk Level**: Low (mkdir is safe either way)

### Challenge 2: Overwrite Check Path Consistency

**Issue**: Must ensure overwrite check uses the correct `filePath` variable for each mode.

**Solution**: Single `filePath` variable set conditionally before overwrite check ensures consistency.

**Risk Level**: Low (clear code structure)

---

## Success Criteria

### Functional Requirements
- [ ] `writePost` writes `{slug}.md` in flat mode
- [ ] `writePost` writes `{slug}/index.md` in nested mode (unchanged)
- [ ] Output directory created if missing in flat mode
- [ ] No subdirectory created in flat mode
- [ ] Atomic writes work correctly in flat mode
- [ ] Overwrite behavior works correctly in flat mode

### Non-Functional Requirements
- [ ] 90%+ test coverage on new code paths
- [ ] No `any` types in production code
- [ ] JSDoc updated for `writePost` method
- [ ] TypeScript compilation passes
- [ ] Build succeeds
- [ ] All existing tests pass (no regressions)

### Code Quality
- [ ] Follows existing patterns (error handling, async/await)
- [ ] Clear conditional structure for mode branching
- [ ] Maintains single responsibility

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue reviewed (#47)
- [x] Current implementation analyzed (lines 228-269)
- [x] Existing test patterns understood
- [x] Dependencies verified (Step 2.1, 2.2 complete)

### Post-Implementation

```bash
# Verify TypeScript compilation
nvm use $(cat .node-version) && npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
nvm use $(cat .node-version) && npm run build
# Expected: dist/ directory created

# Run tests
nvm use $(cat .node-version) && npm test
# Expected: All tests pass

# Generate coverage report
nvm use $(cat .node-version) && npm run test:coverage
# Expected: >= 90% coverage
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Update `writePost` method in `src/services/file-writer.ts`
- [ ] Update JSDoc for method to document both modes

### Phase 2: Testing
- [ ] Add `describe('writePost - flat mode', ...)` test block
- [ ] Write file path tests (3 tests)
- [ ] Write directory creation tests (3 tests)
- [ ] Write overwrite behavior tests (2 tests)
- [ ] Write atomic writes tests (2 tests)
- [ ] Verify all existing tests still pass

### Phase 3: Verification
- [ ] Run type-check
- [ ] Run build
- [ ] Run tests
- [ ] Review coverage report

### Phase 4: Documentation
- [ ] Mark Step 2.3 as complete in IMPLEMENTATION_FLAT.md
- [ ] Update GitHub issue #47

---

## Files to Modify

| File | Action |
|------|--------|
| [src/services/file-writer.ts](../../../src/services/file-writer.ts) | Update `writePost` method (lines 228-269) |
| [tests/unit/file-writer.test.ts](../../../tests/unit/file-writer.test.ts) | Add flat mode test block (~10 new tests) |
| [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) | Mark Step 2.3 as complete |

---

## Summary

**Phase 2.3** will update the `writePost` method to support flat output mode by:
- Writing `{slug}.md` directly in flat mode (no subdirectory)
- Preserving `{slug}/index.md` behavior in nested mode (backwards compatible)
- Ensuring output directory exists without creating unnecessary subdirectories
- Adding comprehensive test coverage for the new code path

**Ready to implement?** This plan provides clear guidance for a focused update to the FileWriter service that integrates with the existing configuration from Steps 2.1 and 2.2.
