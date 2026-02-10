# Phase 5.3: Build outputStructure from CLI Options - Implementation Plan

**Issue**: [#56 - 5.3 Build outputStructure from CLI Options](https://github.com/alvincrespo/hashnode-content-converter/issues/56)
**Status**: IMPLEMENTED
**Date**: 2026-02-10
**Phase**: Phase 5 - CLI Updates, Step 5.3

---

## Overview

Wire the parsed CLI flat-mode options (`--flat`, `--image-folder`, `--image-prefix`) into the Converter by constructing a `ConverterConfig` with `OutputStructure` and passing it through `Converter.withProgress()`. Add input validation functions to prevent path traversal, absolute paths, shell metacharacters, and XSS injection in user-provided values.

**Scope**:
- In scope: Validation functions, `OutputStructure` construction, `ConverterConfig` wiring, warning for orphaned flat-mode options, unit tests
- Out of scope: Startup display changes (Step 5.4), comprehensive CLI end-to-end tests (Step 5.5)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 1068-1232)

---

## Requirements Summary

From [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) Phase 5, Step 5.3:

- Add validation functions for `imageFolder` and `imagePrefix` (security)
- Create `OutputStructure` object when `--flat` is set
- Validate `imageFolder` and `imagePrefix` before use
- Pass through to Converter via `ConverterConfig`
- Warn if `--image-folder` or `--image-prefix` are used without `--flat`

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation on public validation functions
- Integration with existing architecture

---

## Architecture Design

### 1. Config vs Options Architecture

`outputStructure` is an instance-level concern set on `ConverterConfig` at construction time, not a runtime option:

```
ConverterConfig.outputStructure  <-- Instance-level, set at construction
ConversionOptions                <-- Runtime options (skipExisting, downloadOptions, loggerConfig)
```

The Converter reads `outputStructure` from `deps?.config` in its constructor ([src/converter.ts:123-124](../../../src/converter.ts#L123-L124)). The CLI passes it through `ConverterDependencies`:

```typescript
// Default (nested mode):
const converter = Converter.withProgress(progressCallback);

// Flat mode:
const converter = Converter.withProgress(progressCallback, {
  config: { outputStructure: { mode: 'flat', imageFolderName, imagePathPrefix } }
});
```

### 2. Validation Functions API

```typescript
/**
 * Validate image folder name for security.
 * Prevents path traversal, absolute paths, and shell metacharacters.
 * @param folder - The image folder name to validate
 * @throws {Error} If the folder name is invalid
 */
export function validateImageFolder(folder: string): void;

/**
 * Validate image path prefix for markdown URLs.
 * Ensures prefix starts with / for absolute URLs and doesn't contain injection characters.
 * @param prefix - The image path prefix to validate
 * @throws {Error} If the prefix is invalid
 */
export function validateImagePrefix(prefix: string): void;
```

### 3. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Config placement | `ConverterDependencies.config` | Matches existing architecture; `outputStructure` is instance-level, not runtime |
| Validation location | `src/cli/convert.ts` | CLI-level concern; keeps Converter pure |
| Warning vs error for orphaned options | Warning (continue) | Less disruptive; user may have scripts with extra flags |
| Validation timing | Before Converter creation | Fail fast with clear error messages |

---

## Technical Approach

### 1. Data Flow

```
CLI args (--flat --image-folder assets --image-prefix /assets)
    |
    v
commander.js parses -> CLIOptions { flat: true, imageFolder: 'assets', imagePrefix: '/assets' }
    |
    v
runConvert(options)
    |
    +--> Warn if imageFolder/imagePrefix without --flat
    |
    +--> Validate imageFolder (no traversal, no absolute, no metachar)
    +--> Validate imagePrefix (starts with /, no XSS chars, not just /)
    |
    +--> Build ConverterDependencies.config.outputStructure
    |
    v
Converter.withProgress(callback, deps)  <-- deps includes config
    |
    v
Converter constructor reads outputStructure from config
```

### 2. Implementation Strategy

The changes are localized to `src/cli/convert.ts` (the `runConvert` function and new validation functions) and `tests/unit/cli.test.ts`. No changes to the Converter, types, or other files.

---

## Implementation Steps

### Step 1: Add Validation Functions

**File**: `src/cli/convert.ts`
**Location**: After `validateMutuallyExclusiveFlags` (~line 148), before the Progress Display section

**Implementation**:

```typescript
/**
 * Validate image folder name for security.
 * Prevents path traversal, absolute paths, and shell metacharacters.
 *
 * @param folder - The image folder name to validate
 * @throws {Error} If the folder name is invalid
 */
export function validateImageFolder(folder: string): void {
  if (folder.trim().length === 0) {
    throw new Error(
      `Invalid --image-folder: folder name cannot be empty.`
    );
  }

  if (path.isAbsolute(folder)) {
    throw new Error(
      `Invalid --image-folder: "${folder}". ` +
      `Must be a relative path (e.g., "_images", "assets").`
    );
  }

  if (folder.includes('..')) {
    throw new Error(
      `Invalid --image-folder: "${folder}". ` +
      `Path traversal (..) is not allowed for security reasons.`
    );
  }

  if (/[<>:"|?*\x00-\x1f]/.test(folder)) {
    throw new Error(
      `Invalid --image-folder: "${folder}". ` +
      `Contains invalid filesystem characters.`
    );
  }
}

/**
 * Validate image path prefix for markdown URLs.
 * Ensures prefix starts with / for absolute URLs and doesn't contain injection characters.
 *
 * @param prefix - The image path prefix to validate
 * @throws {Error} If the prefix is invalid
 */
export function validateImagePrefix(prefix: string): void {
  if (!prefix.startsWith('/')) {
    throw new Error(
      `Invalid --image-prefix: "${prefix}". ` +
      `Must start with "/" for absolute URLs (e.g., "/images", "/assets/images").`
    );
  }

  if (/<|>|"|'/.test(prefix)) {
    throw new Error(
      `Invalid --image-prefix: "${prefix}". ` +
      `Contains invalid characters that could cause rendering issues.`
    );
  }

  if (prefix.trim().length === 1) {
    throw new Error(
      `Invalid --image-prefix: prefix cannot be just "/". ` +
      `Use a path like "/images" or "/assets".`
    );
  }
}
```

### Step 2: Update Imports

**File**: `src/cli/convert.ts`
**Location**: Line 8-10 (imports section)

**Action**: Add type import for `ConverterDependencies`

```typescript
import { Converter } from '../converter.js';
import type { ConverterDependencies } from '../converter.js';
```

### Step 3: Update `runConvert` Function

**File**: `src/cli/convert.ts`
**Location**: Inside `runConvert()`, between `validateOptions()` and `conversionOptions` building (~lines 263-294)

**Action**: Add warning, validation, config building, and pass deps to Converter

```typescript
async function runConvert(options: CLIOptions): Promise<void> {
  try {
    const validatedPaths = validateOptions(options);
    const { exportPath, outputPath, logFilePath } = validatedPaths;

    // Display startup info (unchanged)
    // ...

    // Warn if flat-mode-only options are used without --flat
    if (!options.flat) {
      if (options.imageFolder) {
        console.warn('Warning: --image-folder is ignored without --flat');
      }
      if (options.imagePrefix) {
        console.warn('Warning: --image-prefix is ignored without --flat');
      }
    }

    // Build converter dependencies with output structure config
    let converterDeps: ConverterDependencies | undefined;
    if (options.flat) {
      // Validate user-provided values for security
      if (options.imageFolder) {
        validateImageFolder(options.imageFolder);
      }
      if (options.imagePrefix) {
        validateImagePrefix(options.imagePrefix);
      }

      converterDeps = {
        config: {
          outputStructure: {
            mode: 'flat',
            imageFolderName: options.imageFolder,   // undefined uses default '_images'
            imagePathPrefix: options.imagePrefix,    // undefined uses default '/images'
          },
        },
      };
    }

    // Build conversion options (unchanged)
    const conversionOptions: ConversionOptions = {
      skipExisting: options.skipExisting,
    };

    if (logFilePath) {
      // ... logger config unchanged
    }

    // Create converter with progress callback and optional flat mode config
    const progressCallback = createProgressCallback(options.quiet, options.verbose);
    const converter = Converter.withProgress(progressCallback, converterDeps);

    // Run conversion (unchanged)
    const result = await converter.convertAllPosts(exportPath, outputPath, conversionOptions);

    // ... rest unchanged
  } catch (error) {
    // ... unchanged
  }
}
```

### Step 4: Update Exports

**File**: `src/cli/convert.ts`
**Location**: Line 352 (exports)

**Action**: Export the new validation functions for testing

```typescript
export { program, runConvert, validateImageFolder, validateImagePrefix };
```

### Step 5: Write Unit Tests

**File**: `tests/unit/cli.test.ts`

**Action**: Add test sections for validation functions and orphaned option warnings

#### A. `validateImageFolder` tests (7 tests)

```typescript
describe('validateImageFolder', () => {
  it('should accept valid relative folder names', () => {
    expect(() => validateImageFolder('_images')).not.toThrow();
    expect(() => validateImageFolder('assets')).not.toThrow();
    expect(() => validateImageFolder('static/img')).not.toThrow();
  });

  it('should reject absolute paths', () => {
    expect(() => validateImageFolder('/etc/passwd'))
      .toThrow('Must be a relative path');
  });

  it('should reject path traversal attempts', () => {
    expect(() => validateImageFolder('../etc'))
      .toThrow('Path traversal (..) is not allowed');
    expect(() => validateImageFolder('images/../../../etc'))
      .toThrow('Path traversal (..) is not allowed');
  });

  it('should reject shell metacharacters', () => {
    expect(() => validateImageFolder('img<script>'))
      .toThrow('Contains invalid filesystem characters');
    expect(() => validateImageFolder('img|rm'))
      .toThrow('Contains invalid filesystem characters');
    expect(() => validateImageFolder('img*'))
      .toThrow('Contains invalid filesystem characters');
  });

  it('should reject empty folder names', () => {
    expect(() => validateImageFolder(''))
      .toThrow('folder name cannot be empty');
    expect(() => validateImageFolder('   '))
      .toThrow('folder name cannot be empty');
  });

  it('should reject names with control characters', () => {
    expect(() => validateImageFolder('img\x00name'))
      .toThrow('Contains invalid filesystem characters');
  });

  it('should accept hyphenated and underscored names', () => {
    expect(() => validateImageFolder('my-images')).not.toThrow();
    expect(() => validateImageFolder('my_images')).not.toThrow();
  });
});
```

#### B. `validateImagePrefix` tests (5 tests)

```typescript
describe('validateImagePrefix', () => {
  it('should accept valid prefixes starting with /', () => {
    expect(() => validateImagePrefix('/images')).not.toThrow();
    expect(() => validateImagePrefix('/assets/img')).not.toThrow();
    expect(() => validateImagePrefix('/static')).not.toThrow();
  });

  it('should reject prefixes not starting with /', () => {
    expect(() => validateImagePrefix('images'))
      .toThrow('Must start with "/"');
    expect(() => validateImagePrefix('assets/images'))
      .toThrow('Must start with "/"');
  });

  it('should reject XSS/injection characters', () => {
    expect(() => validateImagePrefix('/img<script>'))
      .toThrow('Contains invalid characters');
    expect(() => validateImagePrefix('/img"onclick'))
      .toThrow('Contains invalid characters');
    expect(() => validateImagePrefix("/img'alert"))
      .toThrow('Contains invalid characters');
  });

  it('should reject prefix that is just "/"', () => {
    expect(() => validateImagePrefix('/'))
      .toThrow('prefix cannot be just "/"');
  });

  it('should accept nested path prefixes', () => {
    expect(() => validateImagePrefix('/assets/images/blog')).not.toThrow();
  });
});
```

#### C. Orphaned Options Warning Tests (2 tests)

These test the warning behavior when `--image-folder` or `--image-prefix` are passed without `--flat`. Since `runConvert` calls `process.exit` and performs I/O, we need a focused testing approach. The simplest approach: since the validation+warning logic is at the start of `runConvert`, we can mock `validateOptions` to return valid paths, mock `Converter.withProgress` to return a mock converter, mock `process.exit`, and spy on `console.warn`.

**Total New Tests**: ~14 tests (targeting 100% branch coverage of new code)

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/cli.test.ts`

**Test Categories**:

#### A. validateImageFolder (7 tests)
- Accepts valid names (`_images`, `assets`, `static/img`, hyphenated, underscored)
- Rejects absolute paths
- Rejects path traversal
- Rejects shell metacharacters
- Rejects empty names
- Rejects control characters

#### B. validateImagePrefix (5 tests)
- Accepts valid prefixes
- Rejects without leading `/`
- Rejects XSS characters
- Rejects just `/`
- Accepts nested paths

#### C. Orphaned Option Warnings (2 tests)
- `--image-folder` without `--flat` warns
- `--image-prefix` without `--flat` warns

**Total Tests**: ~14 tests (targeting 100% coverage of new code)

### 2. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | >=90% | All code paths exercised |
| **Branches** | >=90% | All validation conditions tested |
| **Functions** | >=90% | All new functions covered |
| **Lines** | >=90% | Complete line coverage |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: Commander.js parsed `CLIOptions` object
- **Input Fields**: `options.flat`, `options.imageFolder`, `options.imagePrefix`
- **Integration**: Values parsed by commander.js (Step 5.2)

### 2. Downstream (Output)
- **Output**: `ConverterDependencies` object with `config.outputStructure`
- **Consumer**: `Converter.withProgress(callback, deps)` ([src/converter.ts:216-225](../../../src/converter.ts#L216-L225))
- **Integration**: Converter constructor reads `deps.config.outputStructure` at line 123-124

### 3. Error Flow
- **Validation errors**: Thrown as `Error`, caught by `runConvert`'s try/catch, displayed to user, exits with code 1
- **Warnings**: Written to `console.warn`, conversion proceeds normally in nested mode

---

## Potential Challenges & Solutions

### Challenge 1: Testing `runConvert` Warning Behavior

**Issue**: `runConvert` calls `process.exit()`, `validateOptions()` (which hits filesystem), and creates a real Converter. Isolating the warning behavior requires significant mocking.

**Solution**: The validation functions are pure and can be tested independently with full coverage. For the warning paths, mock `validateOptions`, `Converter.withProgress`, `process.exit`, and spy on `console.warn`. If mocking proves too complex, the warning tests can be deferred to Step 5.5 (CLI integration tests).

**Risk Level**: Low - validation functions cover the critical security surface area

### Challenge 2: `ConverterDependencies` Import

**Issue**: `ConverterDependencies` is exported from `src/converter.ts`, not from `src/types/`.

**Solution**: Use type import: `import type { ConverterDependencies } from '../converter.js';`

**Risk Level**: Low

---

## Success Criteria

### Functional Requirements
- `--flat` creates Converter with `outputStructure: { mode: 'flat' }`
- `--flat --image-folder assets` passes `imageFolderName: 'assets'`
- `--flat --image-prefix /static` passes `imagePathPrefix: '/static'`
- `--image-folder` without `--flat` warns to stderr and continues in nested mode
- Invalid `imageFolder` values rejected with descriptive error before conversion
- Invalid `imagePrefix` values rejected with descriptive error before conversion
- Default behavior (no `--flat`) remains unchanged

### Non-Functional Requirements
- 90%+ test coverage for new code
- No `any` types in production code
- All public methods documented with JSDoc
- TypeScript compilation passes
- Build succeeds
- All existing tests pass

### Code Quality
- Follows existing validation function patterns in `src/cli/convert.ts`
- Single responsibility: validation separate from config building
- Comprehensive error messages with suggested correct usage

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue #56 reviewed
- [x] Type definitions understood (`ConverterConfig`, `OutputStructure`, `ConverterDependencies`)
- [x] IMPLEMENTATION_FLAT.md analyzed (lines 1068-1232)
- [x] Converter constructor flow traced (`deps.config.outputStructure`)
- [x] `Converter.withProgress` signature verified (accepts `deps?: ConverterDependencies`)
- [x] Existing CLI validation patterns studied
- [x] Existing CLI test patterns studied

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
# Expected: >=90% coverage for new code
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Add `validateImageFolder` function
- [ ] Add `validateImagePrefix` function
- [ ] Add `ConverterDependencies` type import
- [ ] Add orphaned option warnings to `runConvert`
- [ ] Build `ConverterDependencies` with `config.outputStructure` when `--flat` is set
- [ ] Pass `converterDeps` to `Converter.withProgress()`
- [ ] Export new validation functions

### Phase 2: Testing
- [ ] Add `validateImageFolder` test suite (~7 tests)
- [ ] Add `validateImagePrefix` test suite (~5 tests)
- [ ] Add orphaned option warning tests (~2 tests)
- [ ] Verify all existing tests pass

### Phase 3: Verification
- [ ] Run type-check
- [ ] Run build
- [ ] Run tests
- [ ] Review coverage report

### Phase 4: Documentation
- [ ] Update IMPLEMENTATION_FLAT.md checkboxes for Step 5.3
- [ ] Update GitHub issue #56

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `ConverterDependencies` import issue | Low | Low | Verified export exists at src/converter.ts:28 |
| Breaking existing CLI behavior | Very Low | High | Additive change; existing code path unchanged when `--flat` is not set |
| Validation regex too strict/loose | Low | Medium | Based on IMPLEMENTATION_FLAT.md spec; test with edge cases |
| Warning tests complex to mock | Medium | Low | Pure validation functions are the priority; warning tests can use existing mock patterns |

---

## Timeline Estimate

**Total Estimated Time**: 30-45 minutes

- **Phase 1** (Core Implementation): 15 minutes
- **Phase 2** (Testing): 15-20 minutes
- **Phase 3** (Verification): 5-10 minutes

---

## Related Files

**Files to Modify**:
- [src/cli/convert.ts](../../../src/cli/convert.ts) - Validation functions, `runConvert` updates, imports/exports
- [tests/unit/cli.test.ts](../../../tests/unit/cli.test.ts) - New test suites

**Files to Reference** (no changes):
- [src/converter.ts](../../../src/converter.ts) - `Converter.withProgress()`, `ConverterDependencies` interface
- [src/types/converter-options.ts](../../../src/types/converter-options.ts) - `OutputStructure`, `ConverterConfig` types
- [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) - Source requirements

---

## Next Steps After Implementation

1. **Step 5.4**: Update Startup Display - Show output mode (nested/flat) and image folder in startup info
2. **Step 5.5**: Write CLI Unit Tests - Comprehensive end-to-end tests for flag parsing, validation, and transformation
3. **Phase 6**: Exports and Documentation - Update public exports, README, and CHANGELOG

---

## Summary

**Phase 5.3** will deliver the CLI-to-Converter wiring for flat output mode that:
- Adds security validation for `imageFolder` (path traversal, absolute path, metachar prevention) and `imagePrefix` (XSS prevention, format validation)
- Builds `ConverterConfig.outputStructure` from CLI options and passes it through `ConverterDependencies`
- Warns users about orphaned flat-mode options (used without `--flat`)
- Maintains backwards compatibility (no change when `--flat` is not provided)
- Includes ~14 unit tests covering all validation branches

**Ready to implement?** This plan provides focused guidance for wiring the existing CLI flags into the Converter's config system with comprehensive input validation.
