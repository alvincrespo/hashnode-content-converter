# Phase 1.2: Add ImageProcessorContext Interface - Implementation Plan

**Issue**: [#44 - 1.2 Add ImageProcessorContext Interface](https://github.com/alvincrespo/hashnode-content-converter/issues/44)
**Status**: ✅ COMPLETED
**Date**: 2026-01-12
**Completed**: 2026-01-12
**Phase**: Phase 1: Type Definitions (Step 1.2)
**PR**: [#74](https://github.com/alvincrespo/hashnode-content-converter/pull/74)

---

## Overview

Add the `ImageProcessorContext` interface to enable the ImageProcessor to work with flat output mode. This interface provides the necessary context (image directory, path prefix, marker directory) for processing images when the output structure differs from the default nested mode.

**Scope**:
- IN: Type definitions only (`ImageProcessorContext` interface, exports update)
- OUT: No implementation code, no tests (type definitions are verified via TypeScript compilation)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 275-307)

---

## Requirements Summary

From GitHub Issue #44 and IMPLEMENTATION_FLAT.md:

- Create `ImageProcessorContext` interface with:
  - `imageDir: string` - Directory where images should be saved
  - `imagePathPrefix: string` - Path prefix for image references in markdown
  - `markerDir?: string` - Optional custom directory for download markers
- Export from `src/index.ts`

**Key Requirements**:
- Type-safe implementation (no `any` types)
- Full JSDoc documentation matching existing patterns in `src/types/image-processor.ts`
- Compatible with future `processWithContext()` method (Phase 3)

---

## Architecture Design

### 1. Interface Design

#### ImageProcessorContext Interface

```typescript
/**
 * Context for image processing that includes output structure information.
 * Used by ImageProcessor.processWithContext() for flat mode support.
 */
export interface ImageProcessorContext {
  /**
   * Directory where images should be saved.
   * In nested mode: {output}/{slug}/
   * In flat mode: {output}/../_images/
   */
  imageDir: string;

  /**
   * Path prefix for image references in markdown.
   * In nested mode: '.'
   * In flat mode: '/images' (or custom prefix)
   */
  imagePathPrefix: string;

  /**
   * Optional custom directory for download markers.
   * Defaults to {imageDir}/.downloaded-markers/
   */
  markerDir?: string;
}
```

### 2. Design Patterns

Following existing patterns from `src/types/image-processor.ts`:
- Interface-based configuration (like `ImageProcessorOptions`)
- Required fields for essential data (`imageDir`, `imagePathPrefix`)
- Optional fields for customization (`markerDir`)
- Comprehensive JSDoc describing purpose and usage

**Key Decisions**:
1. **Place in existing file**: Add to `src/types/image-processor.ts` rather than creating a new file, since this context is ImageProcessor-specific
2. **Required vs Optional fields**: `imageDir` and `imagePathPrefix` are required because they're always needed; `markerDir` is optional with sensible default

---

## Implementation Steps

### Step 1: Add ImageProcessorContext Interface

**File**: [src/types/image-processor.ts](../../../src/types/image-processor.ts)

**Action**: Add the `ImageProcessorContext` interface at the end of the file (after `ImageProcessingError`)

**Implementation**:

```typescript
// Add after ImageProcessingError interface (around line 94)

/**
 * Context for image processing that includes output structure information.
 * Used by ImageProcessor.processWithContext() for flat mode support.
 */
export interface ImageProcessorContext {
  /**
   * Directory where images should be saved.
   * In nested mode: {output}/{slug}/
   * In flat mode: {output}/../_images/
   */
  imageDir: string;

  /**
   * Path prefix for image references in markdown.
   * In nested mode: '.'
   * In flat mode: '/images' (or custom prefix)
   */
  imagePathPrefix: string;

  /**
   * Optional custom directory for download markers.
   * Defaults to {imageDir}/.downloaded-markers/
   */
  markerDir?: string;
}
```

### Step 2: Update Exports in src/index.ts

**File**: [src/index.ts](../../../src/index.ts)

**Action**: Add `ImageProcessorContext` to the existing type export (lines 70-74)

**Current**:
```typescript
export type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
} from './types/image-processor.js';
```

**Updated**:
```typescript
export type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
  ImageProcessorContext,
} from './types/image-processor.js';
```

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
- Usage will be tested in Phase 3 (ImageProcessor.processWithContext)

---

## Integration Points

### 1. Upstream (Input)
- **Source**: `Converter` (Phase 4) will construct this context based on `OutputStructure`
- **Input Construction**:
  - Nested mode: `{ imageDir: '{output}/{slug}', imagePathPrefix: '.' }`
  - Flat mode: `{ imageDir: '{output}/../_images', imagePathPrefix: '/images' }`

### 2. Downstream (Output)
- **Consumer**: `ImageProcessor.processWithContext()` (Phase 3)
- **Usage**: Context provides explicit configuration for image directory and URL prefix

### 3. Error Flow
- Not applicable for type definitions (no runtime behavior)

---

## Success Criteria

### Functional Requirements
- [x] `ImageProcessorContext` interface exists with `imageDir`, `imagePathPrefix`, `markerDir`
- [x] Interface is exported from `src/index.ts`

### Non-Functional Requirements
- [x] No `any` types
- [x] JSDoc documentation on all fields
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
# Check dist/types/image-processor.d.ts contains ImageProcessorContext
```

---

## Implementation Checklist

- [x] Add `ImageProcessorContext` interface to `src/types/image-processor.ts`
- [x] Add `ImageProcessorContext` to exports in `src/index.ts`
- [x] Run `npm run type-check` - verify no errors
- [x] Run `npm run build` - verify success
- [x] Run `npm test` - verify all existing tests pass (358 tests passing)

---

## Files to Modify

| File | Action |
|------|--------|
| [src/types/image-processor.ts](../../../src/types/image-processor.ts) | Add `ImageProcessorContext` interface |
| [src/index.ts](../../../src/index.ts) | Add `ImageProcessorContext` to type exports |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type conflicts with existing code | Low | Low | Types are additive, no existing code uses `ImageProcessorContext` |
| Circular dependency issues | Low | Low | Interface has no imports, only primitive types |

---

## Summary

**Phase 1.2** will deliver the `ImageProcessorContext` interface that:
- Provides explicit context for image processing (directory and path prefix)
- Enables the ImageProcessor to support flat output mode in Phase 3
- Follows existing patterns in `src/types/image-processor.ts`

This is a low-risk, type-only change that enables subsequent implementation phases.

---

## Next Steps After Implementation

1. Proceed to Phase 2: FileWriter Service Updates
2. Update GitHub issue #44 to mark tasks complete
