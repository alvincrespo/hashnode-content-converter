# Phase 5.2: Add CLI Flags for Flat Mode - Implementation Plan

**Issue**: [#55 - 5.2 Add CLI Flags for Flat Mode](https://github.com/alvincrespo/hashnode-content-converter/issues/55)
**Status**: ✅ COMPLETE
**Date**: 2026-02-10
**Phase**: Phase 5 - CLI Updates, Step 5.2

---

## Overview

Add three new commander.js `.option()` definitions to the CLI `convert` command: `--flat`, `--image-folder`, and `--image-prefix`. This step makes the flags parseable by commander.js, bridging the gap between the `CLIOptions` interface (added in Step 5.1) and actual command-line usage.

**Scope**:
- In scope: Adding three `.option()` calls to the commander.js command builder
- Out of scope: Validation logic, `outputStructure` construction, startup display changes, Converter wiring (Steps 5.3-5.5)

**Reference**: [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) (lines 1042-1066)

---

## Requirements Summary

From [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) Phase 5, Step 5.2:

- Add `-f, --flat` boolean flag (default: `false`)
- Add `--image-folder <name>` string option (flat mode only)
- Add `--image-prefix <prefix>` string option (flat mode only)
- Update help text with descriptive option text

**Key Requirements**:
- Commander.js auto-converts kebab-case flags to camelCase (matching `CLIOptions` interface)
- `--flat` must default to `false` for backwards compatibility
- `--image-folder` and `--image-prefix` have no CLI-level defaults (downstream defaults in Step 5.3)
- Short flag `-f` for `--flat` (consistent with single-letter shortcut convention)

---

## Architecture Design

### 1. CLI Option Registration

#### Current Program Setup (lines 336-347)

```typescript
program
  .command('convert')
  .description('Convert a Hashnode export JSON file to Markdown files')
  .requiredOption('-e, --export <path>', 'Path to Hashnode export JSON file')
  .requiredOption('-o, --output <path>', 'Output directory for converted posts')
  .option('-l, --log-file <path>', 'Path to log file (optional)')
  .option('--no-skip-existing', 'Overwrite posts that already exist')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-q, --quiet', 'Suppress progress output (only show summary)', false)
  .action(async (options: CLIOptions) => {
    await runConvert(options);
  });
```

#### Proposed Program Setup

```typescript
program
  .command('convert')
  .description('Convert a Hashnode export JSON file to Markdown files')
  .requiredOption('-e, --export <path>', 'Path to Hashnode export JSON file')
  .requiredOption('-o, --output <path>', 'Output directory for converted posts')
  .option('-l, --log-file <path>', 'Path to log file (optional)')
  .option('--no-skip-existing', 'Overwrite posts that already exist')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-q, --quiet', 'Suppress progress output (only show summary)', false)
  .option('-f, --flat', 'Use flat output mode ({slug}.md instead of {slug}/index.md)', false)
  .option('--image-folder <name>', 'Image folder name in flat mode (default: _images)')
  .option('--image-prefix <prefix>', 'Image path prefix in flat mode (default: /images)')
  .action(async (options: CLIOptions) => {
    await runConvert(options);
  });
```

### 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Short flag for `--flat` | `-f` | Matches convention (`-v` verbose, `-q` quiet, `-e` export, `-o` output) |
| No short flags for `--image-folder`/`--image-prefix` | Omitted | These are less frequently used; long form is clearer |
| `--flat` default value | `false` | Backwards compatibility; opt-in behavior |
| No defaults for `--image-folder`/`--image-prefix` | `undefined` | Defaults applied downstream when building `OutputStructure` |
| Help text includes defaults | Yes | Matches `--no-skip-existing` pattern of documenting defaults in description |

### 3. Commander.js Naming Convention

Commander.js automatically converts kebab-case to camelCase:

| CLI Flag | `CLIOptions` Property | Type |
|----------|----------------------|------|
| `--flat` | `flat` | `boolean` |
| `--image-folder <name>` | `imageFolder` | `string \| undefined` |
| `--image-prefix <prefix>` | `imagePrefix` | `string \| undefined` |

This matches the existing pattern: `--log-file` → `logFile`, `--skip-existing` → `skipExisting`.

---

## Technical Approach

### 1. Option Placement

New options are placed after the existing display options (`--verbose`, `--quiet`) and before `.action()`. This groups them logically:
1. Required options (export, output)
2. Optional path (log-file)
3. Behavior flags (skip-existing)
4. Display flags (verbose, quiet)
5. **Output mode flags (flat, image-folder, image-prefix)** ← NEW

### 2. Help Text Strategy

Help text follows the existing pattern of being concise but informative:
- `--flat`: Explains what changes in the output structure
- `--image-folder`: Specifies it's for flat mode and shows the default
- `--image-prefix`: Specifies it's for flat mode and shows the default

Expected `--help` output addition:
```
  -f, --flat                  Use flat output mode ({slug}.md instead of {slug}/index.md)
  --image-folder <name>       Image folder name in flat mode (default: _images)
  --image-prefix <prefix>     Image path prefix in flat mode (default: /images)
```

---

## Implementation Steps

### Step 1: Add CLI Flag Definitions

**File**: `src/cli/convert.ts`
**Location**: Lines 344-345 (between `--quiet` and `.action()`)

**Action**: Add three `.option()` calls

**Implementation**:

```typescript
  .option('-q, --quiet', 'Suppress progress output (only show summary)', false)
  .option('-f, --flat', 'Use flat output mode ({slug}.md instead of {slug}/index.md)', false)
  .option('--image-folder <name>', 'Image folder name in flat mode (default: _images)')
  .option('--image-prefix <prefix>', 'Image path prefix in flat mode (default: /images)')
  .action(async (options: CLIOptions) => {
```

### Step 2: Add Unit Tests for Flag Registration

**File**: `tests/unit/cli.test.ts`

**Action**: Add tests verifying the new options are registered on the `convert` command

**Implementation**:

```typescript
// ===========================================================================
// Flat Mode CLI Flag Registration Tests
// ===========================================================================
describe('Flat mode CLI flags', () => {
  it('should register --flat flag with short alias -f on convert command', () => {
    const convertCmd = program.commands.find(cmd => cmd.name() === 'convert');
    expect(convertCmd).toBeDefined();
    const flatOption = convertCmd!.options.find(opt => opt.long === '--flat');
    expect(flatOption).toBeDefined();
    expect(flatOption!.short).toBe('-f');
  });

  it('should register --image-folder option on convert command', () => {
    const convertCmd = program.commands.find(cmd => cmd.name() === 'convert');
    expect(convertCmd).toBeDefined();
    const option = convertCmd!.options.find(opt => opt.long === '--image-folder');
    expect(option).toBeDefined();
  });

  it('should register --image-prefix option on convert command', () => {
    const convertCmd = program.commands.find(cmd => cmd.name() === 'convert');
    expect(convertCmd).toBeDefined();
    const option = convertCmd!.options.find(opt => opt.long === '--image-prefix');
    expect(option).toBeDefined();
  });
});
```

**Note**: Import `program` from `../../src/cli/convert.js` (already exported at line 350).

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/cli.test.ts`

**Test Categories**:

#### A. Flag Registration (3 tests)
- Test `--flat` is registered with `-f` short alias
- Test `--image-folder` is registered as an option
- Test `--image-prefix` is registered as an option

**Total New Tests**: ~3 tests

### 2. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | >=90% | All code paths exercised |
| **Branches** | >=90% | Minimal branching in this step |
| **Functions** | >=90% | No new functions added |
| **Lines** | >=90% | Three new option lines covered by registration tests |

### 3. Existing Tests

All existing CLI tests (45+ tests) must continue to pass without modification. The new options are additive and do not affect existing option parsing.

---

## Integration Points

### 1. Upstream (Input)
- **Source**: Command-line arguments via `process.argv`
- **Parser**: Commander.js `.option()` definitions
- **Integration**: Commander.js auto-parses flags into `CLIOptions` object

### 2. Downstream (Output)
- **Consumer**: `runConvert(options: CLIOptions)` function
- **Fields**: `options.flat`, `options.imageFolder`, `options.imagePrefix`
- **Integration**: These fields are currently unused in `runConvert` (wiring happens in Step 5.3)

### 3. Type Safety
- The `CLIOptions` interface (Step 5.1) already declares these fields
- Commander.js will populate them from parsed arguments
- TypeScript ensures type consistency between interface and usage

---

## Potential Challenges & Solutions

### Challenge 1: Commander.js Boolean Flag Default

**Issue**: Commander.js treats boolean flags differently than value options. Without a default, `--flat` would be `undefined` when not specified.

**Solution**: Provide explicit `false` default: `.option('-f, --flat', '...', false)`. This ensures `options.flat` is always `boolean`, matching the `CLIOptions` interface.

**Risk Level**: Low (same pattern used for `--verbose` and `--quiet`)

### Challenge 2: `--image-folder`/`--image-prefix` Without `--flat`

**Issue**: Users might pass `--image-folder` without `--flat`, leading to confusion.

**Solution**: Validation is handled in Step 5.3, not this step. In this step, commander.js will accept the options regardless. The values will simply be unused.

**Risk Level**: Low (deferred to appropriate step)

---

## Success Criteria

### Functional Requirements
- `--flat` flag is parseable and defaults to `false`
- `-f` short alias works for `--flat`
- `--image-folder <name>` accepts a string argument
- `--image-prefix <prefix>` accepts a string argument
- `convert --help` shows all three new options with descriptions

### Non-Functional Requirements
- TypeScript compilation passes (`npm run type-check`)
- Build succeeds (`npm run build`)
- All existing tests pass (`npm test`)
- New tests pass for flag registration

### Code Quality
- Option placement follows logical grouping
- Help text is concise and informative
- Follows existing `.option()` patterns

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue #55 reviewed
- [x] Source document (IMPLEMENTATION_FLAT.md) analyzed
- [x] CLIOptions interface verified (Step 5.1 complete)
- [x] Commander.js option patterns studied
- [x] Existing test patterns understood

### Post-Implementation

```bash
# Verify TypeScript compilation
nvm use $(cat .node-version) && npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
nvm use $(cat .node-version) && npm run build
# Expected: dist/ directory created

# Run all tests
nvm use $(cat .node-version) && npm test
# Expected: All tests pass (existing + new)

# Verify help text shows new options
nvm use $(cat .node-version) && node dist/cli/convert.js convert --help
# Expected: --flat, --image-folder, --image-prefix visible in help output
```

---

## Git Workflow

### Branch Strategy

**Source Branch**: `main`
**Implementation Branch**: `flat-output-mode/phase-5-step-5-2`

### Commit Strategy

**Commit Message Format**:
```
feat: Phase 5.2 - Add CLI flags for flat output mode

- Add -f, --flat boolean flag (default: false)
- Add --image-folder <name> option for custom image folder
- Add --image-prefix <prefix> option for custom image path prefix
- Add unit tests for flag registration

Refs #55
```

### Pull Request

- Target: `main`
- Link to issue #55
- Include `convert --help` output as verification

---

## Implementation Checklist

### Phase 1: Core Implementation
- [x] Add `.option('-f, --flat', ...)` to convert command
- [x] Add `.option('--image-folder <name>', ...)` to convert command
- [x] Add `.option('--image-prefix <prefix>', ...)` to convert command

### Phase 2: Testing
- [x] Import `program` in test file
- [x] Add flag registration tests (~3 tests)
- [x] Run all tests to verify no regressions

### Phase 3: Verification
- [x] Run `npm run type-check`
- [x] Run `npm run build`
- [x] Run `npm test`
- [x] Verify `convert --help` output

### Phase 4: Documentation
- [x] Update this plan's status to COMPLETE
- [x] Update IMPLEMENTATION_FLAT.md checkboxes for Step 5.2

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Flag naming mismatch with CLIOptions | Low | Medium | Commander.js kebab-to-camelCase conversion is well-established |
| Breaking existing option parsing | Very Low | High | Additive change; existing options untouched |
| Help text formatting issues | Low | Low | Follows existing option patterns |

---

## Timeline Estimate

**Total Estimated Time**: 15-20 minutes

- **Phase 1** (Core Implementation): 5 minutes
- **Phase 2** (Testing): 5-10 minutes
- **Phase 3** (Verification): 5 minutes

---

## Related Files

**Files to Modify**:
- [src/cli/convert.ts](../../../src/cli/convert.ts) - Add `.option()` calls (lines 344-345)
- [tests/unit/cli.test.ts](../../../tests/unit/cli.test.ts) - Add flag registration tests

**Files to Reference** (no changes):
- [docs/IMPLEMENTATION_FLAT.md](../../IMPLEMENTATION_FLAT.md) - Source requirements
- [docs/features/flat/PHASE_5_STEP_5_1.md](PHASE_5_STEP_5_1.md) - Previous step (CLIOptions interface)

---

## Next Steps After Implementation

1. **Step 5.3**: Build `outputStructure` from CLI Options - Add validation functions, construct `OutputStructure`, pass to `ConversionOptions`, warn if flat-only options used without `--flat`
2. **Step 5.4**: Update Startup Display - Show output mode (nested/flat) in startup info
3. **Step 5.5**: Write CLI Unit Tests - Comprehensive tests for flag parsing, validation, and transformation

---

## Summary

**Phase 5.2** will deliver three new commander.js CLI option definitions that:
- Enable `--flat` / `-f` flag parsing (boolean, defaults to `false`)
- Enable `--image-folder <name>` option parsing (string, optional)
- Enable `--image-prefix <prefix>` option parsing (string, optional)
- Are verified by unit tests checking flag registration
- Maintain backwards compatibility (additive change only)

**Ready to implement?** This is a focused, low-risk step that adds the commander.js wiring for flags already defined in the `CLIOptions` interface. The changes are minimal and well-defined.
