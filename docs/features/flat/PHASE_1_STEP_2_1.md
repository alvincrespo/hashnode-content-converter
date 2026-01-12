# Phase 2.1: Add outputMode Configuration to FileWriter - Implementation Plan

**Issue**: [#45 - Add outputMode Configuration to FileWriter](https://github.com/alvincrespo/hashnode-content-converter/issues/45)
**Status**: PLANNED
**Date**: 2026-01-12
**Phase**: Phase 2 (FileWriter Service Updates), Step 2.1

---

## Overview

Add `outputMode` configuration to the `FileWriter` service to support flat vs nested output modes. This is a foundational change that adds the configuration infrastructure - the actual behavior changes (updating `postExists` and `writePost` methods) will be implemented in subsequent steps (2.2 and 2.3).

**Scope**: Configuration only - add property to interface, class, and constructor. No behavior changes in this step.

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 311-346)

---

## Requirements Summary

From [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 313-346):

- Add `outputMode` to `FileWriterConfig` interface
- Store output mode in class property
- Update constructor to accept new config
- Default value should be `'nested'` for backwards compatibility

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Backwards compatible - existing code should work without changes

---

## Architecture Design

### 1. Configuration Interface Update

**File**: `src/services/file-writer.ts`

```typescript
export interface FileWriterConfig {
  overwrite?: boolean;
  encoding?: BufferEncoding;
  atomicWrites?: boolean;

  /**
   * Output mode for file organization:
   * - 'nested': Creates {slug}/index.md (default)
   * - 'flat': Creates {slug}.md directly in output directory
   * @default 'nested'
   */
  outputMode?: 'nested' | 'flat';
}
```

### 2. Class Property Refactor

Replace individual properties with a single config object:

```typescript
export class FileWriter {
  /**
   * Default configuration values
   */
  private static readonly DEFAULTS: Required<FileWriterConfig> = {
    overwrite: false,
    encoding: 'utf8',
    atomicWrites: true,
    outputMode: 'nested',
  };

  /**
   * Resolved configuration with defaults applied
   */
  private readonly config: Required<FileWriterConfig>;

  constructor(config?: FileWriterConfig) {
    this.config = { ...FileWriter.DEFAULTS, ...config };
  }
  // ...
}
```

### 3. Update Property References

All property access changes from `this.propertyName` to `this.config.propertyName`:

| Before | After |
|--------|-------|
| `this.overwrite` | `this.config.overwrite` |
| `this.encoding` | `this.config.encoding` |
| `this.atomicWrites` | `this.config.atomicWrites` |
| `this.outputMode` | `this.config.outputMode` |

This approach:
- Reduces class properties from 4 to 1
- Centralizes defaults in one place
- Makes the constructor a single line
- Groups related config together

---

## Implementation Steps

### Step 1: Update FileWriterConfig Interface

**File**: `src/services/file-writer.ts` (lines 7-26)

**Action**: Add `outputMode` property with JSDoc documentation

**Implementation**:
```typescript
export interface FileWriterConfig {
  /**
   * Whether to overwrite existing files
   * @default false - throw error if file exists
   */
  overwrite?: boolean;

  /**
   * File encoding for markdown files
   * @default 'utf8'
   */
  encoding?: BufferEncoding;

  /**
   * Enable atomic writes (write to temp file, then rename)
   * Prevents partial writes on failure
   * @default true
   */
  atomicWrites?: boolean;

  /**
   * Output mode for file organization:
   * - 'nested': Creates {slug}/index.md (default)
   * - 'flat': Creates {slug}.md directly in output directory
   * @default 'nested'
   */
  outputMode?: 'nested' | 'flat';
}
```

### Step 2: Refactor Class Properties and Constructor

**File**: `src/services/file-writer.ts` (lines 54-63)

**Action**: Replace individual properties with static DEFAULTS and single config object

**Before** (current):
```typescript
export class FileWriter {
  private readonly overwrite: boolean;
  private readonly encoding: BufferEncoding;
  private readonly atomicWrites: boolean;

  constructor(config?: FileWriterConfig) {
    this.overwrite = config?.overwrite ?? false;
    this.encoding = config?.encoding ?? 'utf8';
    this.atomicWrites = config?.atomicWrites ?? true;
  }
```

**After** (new):
```typescript
export class FileWriter {
  /**
   * Default configuration values
   */
  private static readonly DEFAULTS: Required<FileWriterConfig> = {
    overwrite: false,
    encoding: 'utf8',
    atomicWrites: true,
    outputMode: 'nested',
  };

  /**
   * Resolved configuration with defaults applied
   */
  private readonly config: Required<FileWriterConfig>;

  constructor(config?: FileWriterConfig) {
    this.config = { ...FileWriter.DEFAULTS, ...config };
  }
```

### Step 3: Update Property References

**File**: `src/services/file-writer.ts` (throughout class)

**Action**: Find and replace all property accesses

| Location | Before | After |
|----------|--------|-------|
| Line 116, 121 | `this.encoding` | `this.config.encoding` |
| Line 166 | `this.encoding` | `this.config.encoding` |
| Line 212 | `this.overwrite` | `this.config.overwrite` |
| Line 236 | `this.atomicWrites` | `this.config.atomicWrites` |

**Note**: Use find/replace with word boundaries to avoid false matches.

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/file-writer.test.ts`

**Test Categories**:

#### A. Constructor Configuration Tests (4 tests)
- `should default outputMode to 'nested' when not provided`
- `should accept 'nested' outputMode`
- `should accept 'flat' outputMode`
- `should use default values when config is undefined`

**Total Tests**: ~4 new tests (targeting 100% coverage of new code)

### 2. Proposed Test Implementation

```typescript
describe('outputMode Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
  });

  it('should default outputMode to nested when not provided', async () => {
    const writer = new FileWriter();
    // Verify nested behavior (creates {slug}/index.md)
    const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
    expect(result).toContain('my-post/index.md');
  });

  it('should accept nested outputMode explicitly', async () => {
    const writer = new FileWriter({ outputMode: 'nested' });
    const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
    expect(result).toContain('my-post/index.md');
  });

  it('should accept flat outputMode', () => {
    // For now, just verify the config is accepted without error
    // Actual flat behavior will be tested in Step 2.3
    const writer = new FileWriter({ outputMode: 'flat' });
    expect(writer).toBeInstanceOf(FileWriter);
  });

  it('should use default values when config is undefined', async () => {
    const writer = new FileWriter(undefined);
    const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
    expect(result).toContain('my-post/index.md');
  });
});
```

### 3. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | 100% | All new lines exercised |
| **Branches** | 100% | Default value branch tested |
| **Functions** | 100% | Constructor already tested |
| **Lines** | 100% | Complete line coverage |

---

## Integration Points

### 1. Upstream (Input)
- **Source**: CLI (`src/cli/convert.ts`) and Converter (`src/converter.ts`)
- **Input Type**: `FileWriterConfig`
- **Integration**: Config passed to FileWriter constructor

### 2. Downstream (Output)
- **Output Type**: Stored internally, used by `postExists()` and `writePost()`
- **Next Steps**: Steps 2.2 and 2.3 will use this property to change behavior

### 3. Dependencies
- **Phase 1 (Types)**: `OutputStructure` interface already exists in `src/types/converter-options.ts`
- **Note**: `FileWriterConfig.outputMode` is separate from `OutputStructure.mode` - both use the same `'nested' | 'flat'` union type

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/file-writer.ts` | Add outputMode to interface, refactor to single config object |
| `tests/unit/file-writer.test.ts` | Add configuration tests |

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue reviewed
- [x] Type definitions understood (OutputStructure already exists)
- [x] Current FileWriter implementation analyzed
- [x] Test patterns studied

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
# Expected: All tests pass (existing + new)

# Generate coverage report
npm run test:coverage
# Expected: 90%+ coverage maintained
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Add `outputMode` property to `FileWriterConfig` interface with JSDoc
- [ ] Add static `DEFAULTS` object with all default values (including `outputMode: 'nested'`)
- [ ] Replace individual class properties with single `config: Required<FileWriterConfig>`
- [ ] Refactor constructor to single line: `this.config = { ...DEFAULTS, ...config }`
- [ ] Update all property references from `this.x` to `this.config.x`

### Phase 2: Testing
- [ ] Add `describe('outputMode Configuration')` test block
- [ ] Write 4 unit tests for configuration handling
- [ ] Verify all existing tests still pass

### Phase 3: Verification
- [ ] Run `npm run type-check` - no errors
- [ ] Run `npm run build` - succeeds
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run test:coverage` - 90%+ coverage

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing behavior | Low | High | Default to 'nested', all existing tests should pass |
| Type conflicts with OutputStructure | Low | Low | Both use same union type, no conflict |

---

## Summary

**Phase 2.1** will add the `outputMode` configuration infrastructure to FileWriter:

- Add `outputMode?: 'nested' | 'flat'` to `FileWriterConfig` interface
- Refactor to single `config` object with static `DEFAULTS`
- Default to `'nested'` for backwards compatibility
- Add 4 unit tests for configuration handling

**Ready to implement?** This is a minimal, focused change that sets up the foundation for behavior changes in Steps 2.2 and 2.3.

---

## Next Steps After Implementation

1. **Step 2.2**: Update `postExists()` method to check for `{slug}.md` in flat mode
2. **Step 2.3**: Update `writePost()` method to write `{slug}.md` in flat mode
3. **Step 2.4**: Write comprehensive FileWriter unit tests for flat mode behavior
