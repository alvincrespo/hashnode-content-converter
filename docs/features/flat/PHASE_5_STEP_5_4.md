# Phase 5.4: Update CLI Startup Display for Flat Mode - Implementation Plan

**Issue**: [#57 - 5.4 Update CLI Startup Display for Flat Mode](https://github.com/alvincrespo/hashnode-content-converter/issues/57)
**Status**: ✅ IMPLEMENTED
**Date**: 2026-02-10
**Phase**: Phase 5 - CLI Updates, Step 5.4

---

## Overview

Add a `Mode:` line to the CLI startup display that indicates whether the converter is running in nested or flat output mode. In flat mode, the display also shows the target image folder name. This is a small, self-contained UI enhancement that builds on the infrastructure delivered in Phases 5.1-5.3.

**Scope**:
- In scope: Mode display line in startup info, unit tests for display behavior
- Out of scope: CLI end-to-end tests (Step 5.5), any changes to conversion logic

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 1242-1265)

---

## Requirements Summary

From [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 1242-1244):

- Show output mode (nested/flat) in startup info
- Show image folder name when in flat mode

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Consistent display format with existing startup lines (8-char column alignment)

---

## Architecture Design

### Display Format

The Mode line is inserted between the `Output:` and `Log:` lines, maintaining the existing 8-character label+padding alignment:

**Nested Mode (default):**
```
Hashnode Content Converter
Export:  /path/to/export.json
Output:  /path/to/posts
Mode:    nested ({slug}/index.md)
Skip existing: true
```

**Flat Mode (default image folder):**
```
Hashnode Content Converter
Export:  /path/to/export.json
Output:  /path/to/posts
Mode:    flat (images -> ../_images/)
Skip existing: true
```

**Flat Mode (custom image folder):**
```
Hashnode Content Converter
Export:  /path/to/export.json
Output:  /path/to/posts
Mode:    flat (images -> ../assets/)
Log:     /path/to/log.txt
Skip existing: true
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Position of Mode line | Between Output and Log | Logical grouping: input → output → structure → log → flags |
| Default folder display | `_images` via `??` | Matches Converter default in `converter.ts:98` |
| Show imagePrefix? | No | Mode line shows filesystem destination, not markdown URL prefix |
| Validation ordering | Mode display before validation | Matches existing pattern (Skip existing displayed before converter config validation) |

---

## Implementation Steps

### Step 1: Add Mode Display to Startup Info

**File**: [src/cli/convert.ts](../../../src/cli/convert.ts#L339-L349)

**Action**: Insert Mode conditional between the `Output:` line (line 343) and the `if (logFilePath)` check (line 344).

**Current code** (lines 339-349):
```typescript
// Display startup info
if (!options.quiet) {
  console.log('\nHashnode Content Converter');
  console.log(`Export:  ${exportPath}`);
  console.log(`Output:  ${outputPath}`);
  if (logFilePath) {
    console.log(`Log:     ${logFilePath}`);
  }
  console.log(`Skip existing: ${options.skipExisting}`);
  console.log('');
}
```

**New code**:
```typescript
// Display startup info
if (!options.quiet) {
  console.log('\nHashnode Content Converter');
  console.log(`Export:  ${exportPath}`);
  console.log(`Output:  ${outputPath}`);
  if (options.flat) {
    const imageFolder = options.imageFolder ?? '_images';
    console.log(`Mode:    flat (images -> ../${imageFolder}/)`);
  } else {
    console.log(`Mode:    nested ({slug}/index.md)`);
  }
  if (logFilePath) {
    console.log(`Log:     ${logFilePath}`);
  }
  console.log(`Skip existing: ${options.skipExisting}`);
  console.log('');
}
```

### Step 2: Add Unit Tests

**File**: [tests/unit/cli.test.ts](../../../tests/unit/cli.test.ts#L758)

**Action**: Add a nested `describe('startup display Mode line', ...)` block inside the existing `describe('runConvert flat mode wiring', ...)` block (before its closing `});` at line 759). The tests inherit all existing mocks from the parent `beforeEach`.

**Key detail**: Existing tests use `quiet: true` in `baseOptions`, so the new display code doesn't affect them. New tests override with `quiet: false`.

```typescript
    // =========================================================================
    // Startup Display: Mode line
    // =========================================================================
    describe('startup display Mode line', () => {
      it('should display nested mode when flat is false', async () => {
        await runConvert({ ...baseOptions, quiet: false, flat: false });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Mode:    nested ({slug}/index.md)'
        );
      });

      it('should display flat mode with default image folder', async () => {
        await runConvert({ ...baseOptions, quiet: false, flat: true });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Mode:    flat (images -> ../_images/)'
        );
      });

      it('should display flat mode with custom image folder', async () => {
        await runConvert({
          ...baseOptions,
          quiet: false,
          flat: true,
          imageFolder: 'assets',
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Mode:    flat (images -> ../assets/)'
        );
      });

      it('should not display Mode line when quiet is true', async () => {
        await runConvert({ ...baseOptions, quiet: true, flat: true });

        const logCalls = consoleLogSpy.mock.calls.map(call => call[0]);
        const hasModeCall = logCalls.some(
          (arg: unknown) => typeof arg === 'string' && (arg as string).startsWith('Mode:')
        );
        expect(hasModeCall).toBe(false);
      });
    });
```

### Step 3: Update Documentation

**File**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md#L1242-L1244)

**Action**: Mark Phase 5.4 checkboxes as complete:
```markdown
#### Step 5.4: Update Startup Display
- [x] Show output mode (nested/flat) in startup info
- [x] Show image folder name when in flat mode
```

---

## Testing Strategy

### Unit Tests (4 new tests)

| # | Test | Options Override | Asserts |
|---|------|-----------------|---------|
| 1 | Nested mode display | `quiet: false, flat: false` | `Mode:    nested ({slug}/index.md)` logged |
| 2 | Flat mode default folder | `quiet: false, flat: true` | `Mode:    flat (images -> ../_images/)` logged |
| 3 | Flat mode custom folder | `quiet: false, flat: true, imageFolder: 'assets'` | `Mode:    flat (images -> ../assets/)` logged |
| 4 | Quiet suppresses Mode | `quiet: true, flat: true` | No `Mode:` string in any log call |

**Total Tests**: 363 existing + 4 new = 367 tests

### Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥90% | Both branches (flat/nested) exercised |
| **Branches** | ≥90% | Both `options.flat` branches + quiet guard covered |
| **Functions** | ≥90% | No new functions added |
| **Lines** | ≥90% | All 5 new lines covered |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: `CLIOptions` parsed by commander.js (Phase 5.2)
- **Input Fields**: `options.flat`, `options.imageFolder`, `options.quiet`
- **Integration**: Values read directly from the options object

### 2. Downstream (Output)
- **Output**: Console output (informational only)
- **Consumer**: User viewing terminal output
- **Integration**: No downstream code dependencies

### 3. Error Flow
- **Error Handling**: None needed — display-only code inside existing `!options.quiet` guard
- **Validation**: Image folder validation happens after display (lines 365-370), matching existing pattern

---

## Potential Challenges & Solutions

### Challenge 1: consoleLogSpy Captures displayResult Calls Too

**Issue**: `displayResult` also uses `console.log`, so the spy captures both startup display and result display calls.

**Solution**: Tests assert on specific string values (`Mode:    nested...` or `Mode:    flat...`), not on call count. The "quiet suppresses Mode" test filters for `Mode:` prefix specifically.

**Risk Level**: Low

### Challenge 2: Validation Runs After Display

**Issue**: The Mode line displays before `validateImageFolder` runs (line 366), so if validation fails, the Mode line was still shown.

**Solution**: This is acceptable and matches the existing pattern. The startup display is informational; the validation error appears immediately after with a descriptive message.

**Risk Level**: Low

---

## Success Criteria

### Functional Requirements
- [x] Nested mode shows `Mode:    nested ({slug}/index.md)` in startup info
- [x] Flat mode shows `Mode:    flat (images -> ../_images/)` with default folder
- [x] Flat mode with `--image-folder assets` shows `Mode:    flat (images -> ../assets/)`
- [x] Quiet mode (`--quiet`) suppresses Mode display entirely
- [x] Existing startup display behavior unchanged for all other lines

### Non-Functional Requirements
- [x] 90%+ test coverage for new code
- [x] No `any` types in production code
- [x] TypeScript compilation passes
- [x] Build succeeds
- [x] All 484 tests pass

### Code Quality
- [x] Follows existing startup display pattern
- [x] Consistent 8-character column alignment
- [x] Uses nullish coalescing (`??`) matching Converter default

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue #57 reviewed
- [x] Current startup display code analyzed (src/cli/convert.ts:339-349)
- [x] IMPLEMENTATION_FLAT.md spec reviewed (lines 1242-1265)
- [x] Existing test infrastructure reviewed (cli.test.ts:631-759)
- [x] Phase 5.3 plan reviewed for pattern consistency

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
# Expected: 367 tests pass

# Generate coverage report
nvm use $(cat .node-version) && npm run test:coverage
# Expected: ≥90% coverage, overall ~99%
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [x] Insert Mode display conditional in startup block (src/cli/convert.ts)

### Phase 2: Testing
- [x] Add `describe('startup display Mode line', ...)` with 4 tests (tests/unit/cli.test.ts)
- [x] Verify all 484 tests pass

### Phase 3: Verification
- [x] Run type-check
- [x] Run build
- [x] Run tests
- [x] Review coverage report

### Phase 4: Documentation
- [x] Mark Step 5.4 checkboxes in IMPLEMENTATION_FLAT.md
- [x] Mark all checkboxes in PHASE_5_STEP_5_4.md implementation plan as complete and update status to ✅ IMPLEMENTED

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Display breaks existing test assertions | Very Low | Low | Existing tests use `quiet: true`; new code only runs when `quiet: false` |
| Mode line misaligns with other labels | Low | Low | Verified 8-char column alignment matches Export/Output/Log labels |
| imageFolder default diverges from Converter | Low | Medium | Both use `'_images'` fallback; verified in converter.ts:98 |

---

## Files to Modify

| File | Change |
|------|--------|
| [src/cli/convert.ts](../../../src/cli/convert.ts) | Insert 5-line Mode display conditional (lines 343-347) |
| [tests/unit/cli.test.ts](../../../tests/unit/cli.test.ts) | Add nested describe block with 4 tests |
| [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) | Mark Phase 5.4 checkboxes as complete |

---

## Next Steps After Implementation

1. **Step 5.5**: Write CLI Unit Tests - Comprehensive end-to-end tests for flag parsing, validation, and transformation
2. **Phase 6**: Exports and Documentation - Update public exports, README, and CHANGELOG

---

## Summary

**Phase 5.4** delivers a small, focused UI enhancement that:
- Displays the active output mode (nested/flat) in the CLI startup info
- Shows the target image folder when in flat mode (defaults to `_images`)
- Adds 4 unit tests covering all display branches
- Maintains full backward compatibility with existing behavior

**Ready to implement?** This plan provides focused guidance for a straightforward display enhancement with comprehensive test coverage.
