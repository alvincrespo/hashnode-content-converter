# Phase 1.1: Add OutputStructure Interface - Implementation Plan

**Issue**: [#43 - 1.1 Add OutputStructure Interface](https://github.com/alvincrespo/hashnode-content-converter/issues/43)
**Status**: COMPLETED
**Date**: 2025-12-29
**Completed**: 2026-01-12
**Phase**: Phase 1: Type Definitions (Step 1.1)
**PR**: [#72](https://github.com/alvincrespo/hashnode-content-converter/pull/72)

---

## Overview

Add the `OutputStructure` interface to support configurable output modes (nested vs flat) for the conversion process. This is a foundational type definition that will be used by subsequent phases to implement flat output mode functionality.

**Scope**:
- IN: Type definitions only (`OutputStructure` interface, `ConversionOptions` update, exports)
- OUT: No implementation code, no tests (type definitions are verified via TypeScript compilation)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 216-273)

---

## Requirements Summary

From GitHub Issue #43 and IMPLEMENTATION_FLAT.md:

- Create `OutputStructure` interface with:
  - `mode: 'nested' | 'flat'` - determines file organization
  - `imageFolderName?: string` - shared image folder name (flat mode)
  - `imagePathPrefix?: string` - path prefix for image references (flat mode)
- Add `outputStructure?: OutputStructure` field to `ConversionOptions`
- Export new types from `src/index.ts`

**Key Requirements**:
- Type-safe implementation (no `any` types)
- Full JSDoc documentation matching existing patterns
- Backwards compatible (new field is optional)

---

## Architecture Design

### 1. Interface Design

#### OutputStructure Interface

```typescript
/**
 * Output structure configuration for the conversion process.
 * Controls how posts and images are organized on disk.
 */
export interface OutputStructure {
  /**
   * Output mode determines file organization:
   * - 'nested': Creates {slug}/index.md with images in same directory (default)
   * - 'flat': Creates {slug}.md with images in shared sibling directory
   * @default 'nested'
   */
  mode: 'nested' | 'flat';

  /**
   * Name of the shared image folder (flat mode only).
   * Created as a sibling to the output directory.
   * @default '_images'
   * @example 'assets' -> creates {output}/../assets/
   */
  imageFolderName?: string;

  /**
   * Path prefix for image references in markdown (flat mode only).
   * Should match your static site generator's asset path configuration.
   * @default '/images'
   * @example '/assets/images' -> ![alt](/assets/images/filename.png)
   */
  imagePathPrefix?: string;
}
```

### 2. Design Patterns

Following existing patterns from `converter-options.ts`:
- Interface-based configuration (like `ImageDownloadOptions`, `LoggerConfig`)
- Optional fields with JSDoc `@default` annotations
- Clear separation between required and optional properties
- Comprehensive JSDoc with examples

---

## Implementation Steps

### Step 1: Add OutputStructure Interface

**File**: [src/types/converter-options.ts](../../../src/types/converter-options.ts)

**Action**: Add the `OutputStructure` interface after `LoggerConfig` (around line 45)

**Implementation**:

```typescript
// Add after LoggerConfig interface (line 45)

/**
 * Output structure configuration for the conversion process.
 * Controls how posts and images are organized on disk.
 */
export interface OutputStructure {
  /**
   * Output mode determines file organization:
   * - 'nested': Creates {slug}/index.md with images in same directory (default)
   * - 'flat': Creates {slug}.md with images in shared sibling directory
   * @default 'nested'
   */
  mode: 'nested' | 'flat';

  /**
   * Name of the shared image folder (flat mode only).
   * Created as a sibling to the output directory.
   * @default '_images'
   * @example 'assets' -> creates {output}/../assets/
   */
  imageFolderName?: string;

  /**
   * Path prefix for image references in markdown (flat mode only).
   * Should match your static site generator's asset path configuration.
   * @default '/images'
   * @example '/assets/images' -> ![alt](/assets/images/filename.png)
   */
  imagePathPrefix?: string;
}
```

### Step 2: Update ConversionOptions Interface

**File**: [src/types/converter-options.ts](../../../src/types/converter-options.ts)

**Action**: Add `outputStructure` field to `ConversionOptions` interface

**Implementation**:

```typescript
// Update ConversionOptions interface (around line 50-68)
export interface ConversionOptions {
  /**
   * Skip posts that already exist in the output directory.
   * When true, posts with existing directories are skipped.
   * When false, conversion will attempt to overwrite.
   * @default true
   */
  skipExisting?: boolean;

  /**
   * Image download configuration options.
   */
  downloadOptions?: ImageDownloadOptions;

  /**
   * Logger configuration options.
   */
  loggerConfig?: LoggerConfig;

  /**
   * Output structure configuration.
   * Controls file naming and image storage location.
   * @default { mode: 'nested' }
   */
  outputStructure?: OutputStructure;
}
```

### Step 3: Verify Exports

**File**: [src/index.ts](../../../src/index.ts)

**Action**: Verify `OutputStructure` is exported via existing wildcard export

**Note**: The existing `export * from './types/converter-options'` (line 42) will automatically export the new `OutputStructure` interface. No changes needed to `src/index.ts`.

---

## Testing Strategy

### Type Definition Verification

For pure type definitions, verification is done through:

1. **TypeScript Compilation**: `npm run type-check` will verify:
   - Interface syntax is correct
   - No circular dependencies
   - Types are properly exported

2. **Build Verification**: `npm run build` will verify:
   - Types are emitted to `dist/`
   - Declaration files (.d.ts) are generated correctly

### No Unit Tests Required

Type definitions don't require unit tests because:
- TypeScript compiler validates syntax and type correctness
- Interfaces have no runtime behavior to test
- Usage will be tested in subsequent phases (Phase 2-5)

---

## Integration Points

### 1. Upstream (Input)
- **Source**: CLI (`src/cli/convert.ts`) and library users
- **Input**: Will be populated from CLI flags or direct API calls
- **Integration**: CLI will build `OutputStructure` from `--flat`, `--image-folder`, `--image-prefix` flags (Phase 5)

### 2. Downstream (Output)
- **Consumers**:
  - `Converter` (Phase 4) - uses `outputStructure` to determine behavior
  - `FileWriter` (Phase 2) - uses `mode` for file naming
  - `ImageProcessor` (Phase 3) - uses `imageFolderName` and `imagePathPrefix`

---

## Success Criteria

### Functional Requirements
- [x] `OutputStructure` interface exists with `mode`, `imageFolderName`, `imagePathPrefix`
- [x] `ConversionOptions` includes optional `outputStructure` field
- [x] Types are exported from package entry point

### Non-Functional Requirements
- [x] No `any` types
- [x] JSDoc documentation on all fields with @default and @example
- [x] TypeScript compilation passes
- [x] Build succeeds

---

## Verification Checklist

### Post-Implementation

```bash
# Verify TypeScript compilation
npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
npm run build
# Expected: dist/ directory created with type declarations

# Verify export (optional manual check)
# Check dist/types/converter-options.d.ts contains OutputStructure
```

---

## Implementation Checklist

- [x] Add `OutputStructure` interface to `src/types/converter-options.ts`
- [x] Add `outputStructure` field to `ConversionOptions` interface
- [x] Run `npm run type-check` - verify no errors
- [x] Run `npm run build` - verify success
- [x] Update GitHub issue #43 status (closes via PR #72)

---

## Files to Modify

| File | Action |
|------|--------|
| [src/types/converter-options.ts](../../../src/types/converter-options.ts) | Add `OutputStructure` interface, update `ConversionOptions` |
| [src/index.ts](../../../src/index.ts) | No changes needed (wildcard export handles it) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type conflicts with existing code | Low | Low | Types are additive, no existing code uses `outputStructure` |
| Breaking downstream consumers | Low | Low | Field is optional, maintains backwards compatibility |

---

## Summary

**Phase 1.1** will deliver the foundational `OutputStructure` type definition that:
- Defines the configuration structure for nested vs flat output modes
- Extends `ConversionOptions` with optional `outputStructure` field
- Maintains backwards compatibility (new field is optional, defaults to nested mode)
- Follows existing codebase patterns for type definitions

This is a low-risk, type-only change that enables subsequent implementation phases.

---

## Next Steps After Implementation

1. Proceed to Phase 1.2: Add ImageProcessorContext Interface
2. Update GitHub issue #43 to mark tasks complete
