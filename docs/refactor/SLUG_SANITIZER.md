# Refactor: Extract SlugSanitizer Service

## Overview

Extract slug sanitization logic from `FileWriter` into a dedicated `SlugSanitizer` service to improve separation of concerns and maintainability.

**Status**: 📋 Planning
**Created**: 2025-11-06
**Target**: Phase 3.2.1 (Post-FileWriter Enhancement)

---

## Motivation

### Current Problem

The `FileWriter.sanitizeSlug()` method (lines 71-107) performs multiple responsibilities:

```typescript
private sanitizeSlug(slug: string): string {
  // 1. Trim whitespace
  let sanitized = slug.trim();

  // 2. Reject absolute paths
  if (sanitized.startsWith('/')) { throw ... }

  // 3. Reject parent directory traversal
  if (sanitized.includes('..')) { throw ... }

  // 4. Replace invalid filename characters
  sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '-');

  // 5. Validate not empty
  if (sanitized.length === 0) { throw ... }

  return sanitized;
}
```

**Issues**:
- **Single Responsibility Violation**: `FileWriter` should only write files, not validate slugs
- **Reusability**: Slug sanitization logic cannot be used by other services
- **Testability**: Cannot test sanitization logic in isolation without mocking filesystem
- **Complexity**: Method does too much (5 distinct operations)

### Proposed Solution

Extract slug sanitization into a dedicated `SlugSanitizer` service with clear separation of concerns:

```typescript
class SlugSanitizer {
  static run(slug: string): string {
    // Orchestrates sanitization pipeline
  }

  private rejectAbsolutePaths(slug: string): string { ... }
  private rejectParentTraversal(slug: string): string { ... }
  private replaceInvalidCharacters(slug: string): string { ... }
  private rejectEmptyResult(slug: string): string { ... }
}
```

---

## Architecture

### File Structure

```
src/
├── services/
│   ├── file-writer.ts           (update: delegate to SlugSanitizer)
│   └── slug-sanitizer.ts        (new: sanitization logic)
tests/
└── unit/
    ├── file-writer.test.ts      (no changes needed)
    └── slug-sanitizer.test.ts   (new: comprehensive tests)
docs/
├── refactor/
│   └── SLUG_SANITIZER.md        (this document)
└── considerations/
    └── SECURITY_DIRECTORY_TRAVERSAL.md (update: reference new location)
```

### Class Design

**New Service**: `src/services/slug-sanitizer.ts`

```typescript
/**
 * Error thrown when slug sanitization fails
 */
export class SlugSanitizationError extends Error {
  constructor(
    message: string,
    public readonly slug: string,
    public readonly reason: 'absolute_path' | 'parent_traversal' | 'empty_result'
  ) {
    super(message);
    this.name = 'SlugSanitizationError';
  }
}

/**
 * Service for sanitizing blog post slugs to prevent path traversal
 * and ensure filesystem compatibility
 */
export class SlugSanitizer {
  /**
   * Sanitize a slug for safe filesystem use
   * @param slug - Raw slug from post metadata
   * @returns Sanitized slug safe for filesystem
   * @throws SlugSanitizationError if slug is invalid
   */
  static run(slug: string): string {
    const sanitizer = new SlugSanitizer(slug);
    return sanitizer.sanitize();
  }

  private sanitized: string;

  private constructor(private readonly originalSlug: string) {
    this.sanitized = originalSlug.trim();
  }

  private sanitize(): string {
    this.rejectAbsolutePaths();
    this.rejectParentTraversal();
    this.replaceInvalidCharacters();
    this.rejectEmptyResult();
    return this.sanitized;
  }

  private rejectAbsolutePaths(): void {
    if (this.sanitized.startsWith('/')) {
      throw new SlugSanitizationError(
        `Invalid slug: absolute paths are not allowed (${this.originalSlug})`,
        this.originalSlug,
        'absolute_path'
      );
    }
  }

  private rejectParentTraversal(): void {
    if (this.sanitized.includes('..')) {
      throw new SlugSanitizationError(
        `Invalid slug: parent directory traversal is not allowed (${this.originalSlug})`,
        this.originalSlug,
        'parent_traversal'
      );
    }
  }

  private replaceInvalidCharacters(): void {
    // Replace invalid filename characters with hyphens
    // Invalid chars: / \ : * ? " < > |
    this.sanitized = this.sanitized.replace(/[/\\:*?"<>|]/g, '-');
  }

  private rejectEmptyResult(): void {
    if (this.sanitized.length === 0) {
      throw new SlugSanitizationError(
        `Invalid slug: slug is empty after sanitization (original: ${this.originalSlug})`,
        this.originalSlug,
        'empty_result'
      );
    }
  }
}
```

**Updated FileWriter**: `src/services/file-writer.ts`

```typescript
import { SlugSanitizer, SlugSanitizationError } from './slug-sanitizer';

export class FileWriter {
  // ... existing code ...

  /**
   * Sanitize a slug using SlugSanitizer service
   * @param slug - Raw slug from post metadata
   * @returns Sanitized slug safe for filesystem use
   * @throws FileWriteError if slug is invalid
   */
  private sanitizeSlug(slug: string): string {
    try {
      return SlugSanitizer.run(slug);
    } catch (error) {
      // Wrap SlugSanitizationError in FileWriteError for backward compatibility
      if (error instanceof SlugSanitizationError) {
        throw new FileWriteError(error.message, error.slug, 'validate_path');
      }
      throw error;
    }
  }

  // ... rest of existing code unchanged ...
}
```

---

## Error Handling Strategy

### Current Behavior (Preserved)

```typescript
// FileWriter currently throws FileWriteError
throw new FileWriteError(
  `Invalid slug: ...`,
  slug,
  'validate_path'
);
```

### New Behavior (Backward Compatible)

```typescript
// SlugSanitizer throws SlugSanitizationError
throw new SlugSanitizationError(
  `Invalid slug: ...`,
  slug,
  'absolute_path' | 'parent_traversal' | 'empty_result'
);

// FileWriter catches and wraps in FileWriteError
try {
  return SlugSanitizer.run(slug);
} catch (error) {
  if (error instanceof SlugSanitizationError) {
    throw new FileWriteError(error.message, error.slug, 'validate_path');
  }
  throw error;
}
```

**Benefits**:
- ✅ **Backward Compatibility**: Existing FileWriter tests continue to work unchanged
- ✅ **Separation of Concerns**: SlugSanitizer has its own error type
- ✅ **Flexibility**: Other services can catch `SlugSanitizationError` directly if needed
- ✅ **Error Context**: `reason` field provides structured error categorization

---

## Testing Strategy

### New Tests: `tests/unit/slug-sanitizer.test.ts`

**Coverage Target**: 90%+ (statements, branches, functions, lines)

#### Test Categories

**A. Valid Slug Acceptance (4 tests)**
```typescript
describe('SlugSanitizer.run()', () => {
  describe('Valid Slugs', () => {
    it('should accept alphanumeric slugs with hyphens', () => {
      expect(SlugSanitizer.run('my-blog-post')).toBe('my-blog-post');
    });

    it('should accept slugs with numbers', () => {
      expect(SlugSanitizer.run('post-123')).toBe('post-123');
    });

    it('should accept Unicode characters', () => {
      expect(SlugSanitizer.run('日本語')).toBe('日本語');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(SlugSanitizer.run('  my-post  ')).toBe('my-post');
    });
  });
});
```

**B. Absolute Path Rejection (3 tests)**
```typescript
describe('Absolute Path Rejection', () => {
  it('should reject slugs starting with /', () => {
    expect(() => SlugSanitizer.run('/etc/passwd'))
      .toThrow(SlugSanitizationError);
  });

  it('should throw error with reason "absolute_path"', () => {
    try {
      SlugSanitizer.run('/etc/passwd');
    } catch (error) {
      expect(error).toBeInstanceOf(SlugSanitizationError);
      expect((error as SlugSanitizationError).reason).toBe('absolute_path');
    }
  });

  it('should include original slug in error message', () => {
    expect(() => SlugSanitizer.run('/etc/passwd'))
      .toThrow('absolute paths are not allowed');
  });
});
```

**C. Parent Traversal Rejection (3 tests)**
```typescript
describe('Parent Traversal Rejection', () => {
  it('should reject slugs containing ..', () => {
    expect(() => SlugSanitizer.run('../etc/passwd'))
      .toThrow(SlugSanitizationError);
  });

  it('should throw error with reason "parent_traversal"', () => {
    try {
      SlugSanitizer.run('../../etc/passwd');
    } catch (error) {
      expect(error).toBeInstanceOf(SlugSanitizationError);
      expect((error as SlugSanitizationError).reason).toBe('parent_traversal');
    }
  });

  it('should include original slug in error message', () => {
    expect(() => SlugSanitizer.run('../bad-path'))
      .toThrow('parent directory traversal is not allowed');
  });
});
```

**D. Character Replacement (5 tests)**
```typescript
describe('Invalid Character Replacement', () => {
  it('should replace / with hyphens', () => {
    expect(SlugSanitizer.run('my/post')).toBe('my-post');
  });

  it('should replace backslashes with hyphens', () => {
    expect(SlugSanitizer.run('my\\post')).toBe('my-post');
  });

  it('should replace multiple special characters', () => {
    expect(SlugSanitizer.run('my:post*with?chars')).toBe('my-post-with-chars');
  });

  it('should replace all invalid characters: / \\ : * ? " < > |', () => {
    expect(SlugSanitizer.run('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('should preserve Unicode characters during replacement', () => {
    expect(SlugSanitizer.run('日本語:post')).toBe('日本語-post');
  });
});
```

**E. Empty Result Rejection (3 tests)**
```typescript
describe('Empty Result Rejection', () => {
  it('should reject slugs that become empty after trimming', () => {
    expect(() => SlugSanitizer.run('   '))
      .toThrow(SlugSanitizationError);
  });

  it('should throw error with reason "empty_result"', () => {
    try {
      SlugSanitizer.run('   ');
    } catch (error) {
      expect(error).toBeInstanceOf(SlugSanitizationError);
      expect((error as SlugSanitizationError).reason).toBe('empty_result');
    }
  });

  it('should include original slug in error message', () => {
    expect(() => SlugSanitizer.run('   '))
      .toThrow('slug is empty after sanitization');
  });
});
```

**Total Tests**: ~18 tests (targeting 90%+ coverage)

### Existing Tests: `tests/unit/file-writer.test.ts`

**No changes required** - All existing tests should continue to pass:

```typescript
describe('Path Validation', () => {
  describe('sanitizeSlug (via writePost)', () => {
    // These 6 tests should continue to work without modification
    it('should accept valid slugs with alphanumeric and hyphens', async () => { ... });
    it('should accept valid slugs with numbers', async () => { ... });
    it('should reject parent directory traversal', async () => { ... });
    it('should reject absolute paths', async () => { ... });
    it('should sanitize special characters by replacing with hyphens', async () => { ... });
    it('should handle Unicode characters correctly', async () => { ... });
    it('should reject empty slugs after sanitization', async () => { ... });
  });
});
```

**Why no changes needed**:
- FileWriter still throws `FileWriteError` (backward compatible)
- Error messages remain identical
- Behavior is preserved through delegation pattern

---

## Implementation Steps

### Phase 1: Create SlugSanitizer Service

**Tasks**:
1. Create `src/services/slug-sanitizer.ts`
2. Define `SlugSanitizationError` class with `reason` field
3. Implement `SlugSanitizer` class with static `run()` method
4. Implement private methods:
   - `sanitize()` - orchestration method
   - `rejectAbsolutePaths()` - validate no leading `/`
   - `rejectParentTraversal()` - validate no `..`
   - `replaceInvalidCharacters()` - replace `/\:*?"<>|` with `-`
   - `rejectEmptyResult()` - validate non-empty after sanitization

**Files Created**:
- `src/services/slug-sanitizer.ts`

**Verification**:
- TypeScript compiles without errors
- Exports: `SlugSanitizer`, `SlugSanitizationError`

---

### Phase 2: Create Comprehensive Tests

**Tasks**:
1. Create `tests/unit/slug-sanitizer.test.ts`
2. Implement 18 test cases covering all scenarios
3. Run tests: `npm run test:coverage`
4. Verify 90%+ coverage for `slug-sanitizer.ts`

**Files Created**:
- `tests/unit/slug-sanitizer.test.ts`

**Verification**:
- All 18 tests pass
- Coverage ≥90% for:
  - Statements
  - Branches
  - Functions
  - Lines

---

### Phase 3: Update FileWriter

**Tasks**:
1. Import `SlugSanitizer` and `SlugSanitizationError` in `file-writer.ts`
2. Replace `sanitizeSlug()` implementation with delegation pattern
3. Add try-catch to wrap `SlugSanitizationError` in `FileWriteError`
4. Remove old validation logic (lines 72-105)
5. Keep method signature unchanged: `private sanitizeSlug(slug: string): string`

**Files Modified**:
- `src/services/file-writer.ts` (lines 71-107 replaced with ~10 lines)

**Verification**:
- TypeScript compiles without errors
- FileWriter still exports same public API

---

### Phase 4: Verify Backward Compatibility

**Tasks**:
1. Run existing FileWriter tests: `npm test file-writer.test.ts`
2. Verify all 31 tests still pass
3. Verify error messages unchanged
4. Verify error types unchanged (`FileWriteError` with `operation: 'validate_path'`)

**Verification**:
- ✅ All 31 existing FileWriter tests pass
- ✅ No test modifications needed
- ✅ Error handling preserved

---

### Phase 5: Update Documentation

**Tasks**:
1. Update `docs/considerations/SECURITY_DIRECTORY_TRAVERSAL.md`:
   - Update file references from `file-writer.ts:85-91` to `slug-sanitizer.ts:XX-XX`
   - Add note about refactoring
2. Update `docs/TRANSITION.md` (if applicable):
   - Note SlugSanitizer service addition
3. Update this document's status to "✅ Complete"

**Files Modified**:
- `docs/considerations/SECURITY_DIRECTORY_TRAVERSAL.md`
- `docs/TRANSITION.md` (optional)
- `docs/refactor/SLUG_SANITIZER.md` (this file)

**Verification**:
- Documentation accurately reflects new architecture
- Security considerations still documented

---

### Phase 6: Final Verification

**Tasks**:
1. Run full test suite: `npm test`
2. Run coverage report: `npm run test:coverage`
3. Run type checking: `npm run type-check`
4. Run linting: `npm run lint` (if exists)
5. Run build: `npm run build`

**Acceptance Criteria**:
- ✅ All tests pass (31 FileWriter + 18 SlugSanitizer = 49 total)
- ✅ Overall project coverage ≥80%
- ✅ SlugSanitizer coverage ≥90%
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Build succeeds

---

## Risks and Mitigation

### Risk 1: Breaking Existing Tests

**Likelihood**: Low
**Impact**: High

**Mitigation**:
- Preserve exact error messages
- Preserve `FileWriteError` as wrapper
- Preserve method signatures
- Run tests after each phase

**Verification**: All 31 existing FileWriter tests pass unchanged

---

### Risk 2: Error Handling Edge Cases

**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:
- Comprehensive error handling tests
- Test all error paths in SlugSanitizer
- Test error wrapping in FileWriter
- Verify error messages match original

**Verification**: 9 error-specific tests in slug-sanitizer.test.ts

---

### Risk 3: Performance Regression

**Likelihood**: Very Low
**Impact**: Low

**Mitigation**:
- Static method invocation has minimal overhead
- Single object instantiation per sanitization
- No new I/O operations
- Same validation logic, just reorganized

**Verification**: Performance should be identical (negligible method call overhead)

---

### Risk 4: Incomplete Test Coverage

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Target 90%+ coverage for SlugSanitizer
- Test all validation branches
- Test all error conditions
- Test Unicode and edge cases

**Verification**: Run `npm run test:coverage` and verify ≥90%

---

## Security Considerations

### Path Traversal Protection

**Current Approach** (preserved in refactor):
- Reject absolute paths (`/`)
- Reject parent traversal (`..`)
- Replace dangerous characters

**Reference**: See `docs/considerations/SECURITY_DIRECTORY_TRAVERSAL.md`

**No Security Changes**: This refactor only reorganizes existing validation logic without changing security behavior.

### Future Enhancement (Not in Scope)

**Note**: The security documentation references a more robust path resolution approach for web services. This refactor does NOT implement that enhancement - it only extracts the existing logic.

If implementing path resolution in the future:
- SlugSanitizer would be the appropriate place
- Add `outputDir` parameter to `run()`
- Use `path.resolve()` for validation
- See SECURITY_DIRECTORY_TRAVERSAL.md "Future Implementation" section

---

## Success Criteria

### Definition of Done

- ✅ `SlugSanitizer` class created in `src/services/slug-sanitizer.ts`
- ✅ `SlugSanitizationError` class defined with `reason` field
- ✅ `FileWriter` delegates to `SlugSanitizer.run()`
- ✅ 18 new tests created for `SlugSanitizer`
- ✅ All 31 existing FileWriter tests still pass
- ✅ Coverage ≥90% for SlugSanitizer
- ✅ No TypeScript errors
- ✅ Build succeeds
- ✅ Documentation updated

### Verification Checklist

```bash
# Run all checks
npm run type-check  # ✅ No TypeScript errors
npm run build       # ✅ Build succeeds
npm test            # ✅ All tests pass (49 total)
npm run test:coverage  # ✅ Coverage ≥80% overall, ≥90% for slug-sanitizer.ts
```

---

## Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| 1 | Create SlugSanitizer service | 30 minutes |
| 2 | Write comprehensive tests | 45 minutes |
| 3 | Update FileWriter | 15 minutes |
| 4 | Verify backward compatibility | 15 minutes |
| 5 | Update documentation | 20 minutes |
| 6 | Final verification | 10 minutes |
| **Total** | | **~2 hours** |

---

## GitHub Issues Template

After plan approval, create these issues:

### Issue 1: Create SlugSanitizer Service

```markdown
## Description
Extract slug sanitization logic from `FileWriter` into dedicated `SlugSanitizer` service.

## Tasks
- [ ] Create `src/services/slug-sanitizer.ts`
- [ ] Define `SlugSanitizationError` class
- [ ] Implement `SlugSanitizer.run()` method
- [ ] Implement private validation methods
- [ ] Verify TypeScript compilation

## Acceptance Criteria
- Service exports `SlugSanitizer` and `SlugSanitizationError`
- No TypeScript errors
- Follows existing service patterns

## Reference
See: `docs/refactor/SLUG_SANITIZER.md` - Phase 1
```

### Issue 2: Write SlugSanitizer Tests

```markdown
## Description
Create comprehensive unit tests for `SlugSanitizer` service.

## Tasks
- [ ] Create `tests/unit/slug-sanitizer.test.ts`
- [ ] Write 18 test cases (all scenarios)
- [ ] Achieve 90%+ code coverage
- [ ] Verify all tests pass

## Acceptance Criteria
- All 18 tests pass
- Coverage ≥90% (statements, branches, functions, lines)
- Tests cover all error conditions

## Reference
See: `docs/refactor/SLUG_SANITIZER.md` - Phase 2
```

### Issue 3: Integrate SlugSanitizer into FileWriter

```markdown
## Description
Update `FileWriter` to delegate slug sanitization to `SlugSanitizer` service.

## Tasks
- [ ] Import `SlugSanitizer` in file-writer.ts
- [ ] Replace `sanitizeSlug()` implementation
- [ ] Wrap `SlugSanitizationError` in `FileWriteError`
- [ ] Verify all existing tests pass

## Acceptance Criteria
- All 31 existing FileWriter tests pass unchanged
- No changes needed to test files
- Error messages preserved
- Backward compatible

## Reference
See: `docs/refactor/SLUG_SANITIZER.md` - Phase 3 & 4
```

### Issue 4: Update Documentation

```markdown
## Description
Update documentation to reflect `SlugSanitizer` refactoring.

## Tasks
- [ ] Update `SECURITY_DIRECTORY_TRAVERSAL.md` file references
- [ ] Update `TRANSITION.md` if needed
- [ ] Mark refactor plan as complete

## Acceptance Criteria
- Documentation accurate
- Security considerations still documented
- No broken references

## Reference
See: `docs/refactor/SLUG_SANITIZER.md` - Phase 5
```

---

## Related Files

- **Implementation**: `src/services/file-writer.ts` (lines 71-107)
- **Tests**: `tests/unit/file-writer.test.ts` (lines 22-83)
- **Security**: `docs/considerations/SECURITY_DIRECTORY_TRAVERSAL.md`
- **Planning**: `docs/PHASE_3_2.md` (FileWriter implementation plan)

---

## Revision History

- **2025-11-06**: Initial refactor plan created
- **Status**: 📋 Planning - awaiting approval

---

## Summary

This refactor extracts slug sanitization logic from `FileWriter` into a dedicated `SlugSanitizer` service, improving separation of concerns while maintaining 100% backward compatibility. The refactor is low-risk, well-tested, and follows established project patterns.

**Next Steps**:
1. Review and approve this plan
2. Create GitHub issues from templates above
3. Implement phases 1-6 sequentially
4. Verify all acceptance criteria
5. Commit and push to main
6. Mark refactor complete
