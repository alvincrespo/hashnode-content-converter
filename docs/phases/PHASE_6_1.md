# Phase 6.1: CLI Interface Implementation - Implementation Plan

**Issue**: [#10 - Implement CLI Interface](https://github.com/alvincrespo/hashnode-content-converter/issues/10)
**Status**: ✅ COMPLETE
**Completed**: 2025-12-04
**Phase**: Phase 6 - CLI Implementation

---

## Overview

Implement a command-line interface (CLI) for the hashnode-content-converter package using commander.js. The CLI will provide a user-friendly way to convert Hashnode export JSON files to Markdown with YAML frontmatter, leveraging the existing `Converter` class and its full pipeline.

**Scope**:
- IN SCOPE: CLI argument parsing, input validation, progress display, error handling, exit codes
- OUT OF SCOPE: Shell script wrapper (Phase 6.2), advanced features like `--dry-run` (future enhancement)

**Reference**: [docs/TRANSITION.md](../TRANSITION.md) (lines 409-426)

---

## Requirements Summary

From [docs/TRANSITION.md](../TRANSITION.md) (Phase 6: CLI Implementation):

- Create `src/cli/convert.ts` with commander.js for argument parsing
- Implement `convert` command with the following arguments:
  - `--export <path>` - Path to Hashnode export JSON (required)
  - `--output <path>` - Output directory for converted posts (required)
  - `--log-file <path>` - Optional log file path
  - `--skip-existing` - Skip posts that already exist (default: true)
- Implement options parsing and validation
- Call Converter with parsed options
- Display progress and results
- Exit with appropriate status code

**Key Requirements**:
- 90%+ test coverage for new code
- Type-safe implementation (no `any` types)
- Full JSDoc documentation
- Integration with existing `Converter` class and event system

---

## Architecture Design

### 1. CLI API Design

#### Command Structure

```bash
# Primary usage
hashnode-converter convert --export <path> --output <path> [options]

# With all options
hashnode-converter convert \
  --export ./hashnode/export-articles.json \
  --output ./blog \
  --log-file ./conversion.log \
  --skip-existing \
  --verbose

# Help
hashnode-converter --help
hashnode-converter convert --help

# Version
hashnode-converter --version
```

#### Public Interface

```typescript
/**
 * CLI options parsed from command-line arguments
 */
interface CLIOptions {
  /** Path to Hashnode export JSON file */
  export: string;
  /** Output directory for converted posts */
  output: string;
  /** Optional path to log file */
  logFile?: string;
  /** Skip posts that already exist (default: true) */
  skipExisting: boolean;
  /** Verbosity level */
  verbose: boolean;
  /** Quiet mode - minimal output */
  quiet: boolean;
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void>;

/**
 * Run the convert command with parsed options
 */
async function runConvert(options: CLIOptions): Promise<void>;

/**
 * Validate all CLI options by delegating to specific validators
 * @throws {Error} If any validation fails
 */
function validateOptions(options: CLIOptions): void;

/**
 * Validate and resolve the export file path
 * @returns Resolved absolute path
 * @throws {Error} If path does not exist
 */
function validateExportPath(exportPath: string): string;

/**
 * Validate the export file is a file (not a directory)
 * @throws {Error} If path is not a file
 */
function validateExportIsFile(exportPath: string): void;

/**
 * Validate the export file contains valid JSON
 * @throws {Error} If JSON is invalid or unreadable
 */
function validateExportJson(exportPath: string): void;

/**
 * Validate the output directory's parent exists
 * @returns Resolved absolute path
 * @throws {Error} If parent directory does not exist
 */
function validateOutputPath(outputPath: string): string;

/**
 * Validate the log file path if provided
 * @returns Resolved absolute path or undefined
 * @throws {Error} If parent directory does not exist
 */
function validateLogFilePath(logFilePath: string | undefined): string | undefined;

/**
 * Validate mutually exclusive CLI flags
 * @throws {Error} If incompatible flags are combined
 */
function validateMutuallyExclusiveFlags(verbose: boolean, quiet: boolean): void;

/**
 * Display conversion result summary
 */
function displayResult(result: ConversionResult): void;
```

### 2. Design Patterns

Following existing patterns in the codebase:

- **Separation of Concerns**: CLI parsing separate from conversion logic
- **Dependency on Converter**: Use `Converter.withProgress()` for progress display
- **Event-Driven Progress**: Subscribe to converter events for real-time feedback
- **Graceful Error Handling**: Catch errors, display user-friendly messages, exit with appropriate codes

**Key Decisions**:
1. **Use commander.js**: Already installed as a dependency in package.json
2. **Default skipExisting to true**: Matches existing Converter behavior
3. **Progress via events**: Use `conversion-starting` event for progress display
4. **Exit codes**: 0 for success, 1 for errors (standard Unix convention)

---

## Technical Approach

### 1. Data Flow

```
CLI Arguments
    │
    ▼
┌─────────────────────┐
│  commander.js       │
│  Parse arguments    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  validateOptions()  │
│  Check paths exist  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Converter.with     │
│  Progress()         │
│  Setup event hooks  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  convertAllPosts()  │
│  Full pipeline      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  displayResult()    │
│  Summary output     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  process.exit()     │
│  Appropriate code   │
└─────────────────────┘
```

### 2. Implementation Strategy

#### Phase 1: Basic CLI Structure
1. Replace stub in `src/cli/convert.ts` with commander.js setup
2. Define command structure with required and optional arguments
3. Add basic help text and version

#### Phase 2: Validation Layer
1. Implement `validateOptions()` to check file/directory existence
2. Provide clear error messages for missing/invalid paths
3. Handle edge cases (empty strings, invalid paths)

#### Phase 3: Converter Integration
1. Create `Converter.withProgress()` instance
2. Map CLI options to `ConversionOptions`
3. Subscribe to events for progress display

#### Phase 4: Output and Exit Handling
1. Implement progress display during conversion
2. Display summary after completion
3. Exit with appropriate status codes

---

## Implementation Steps

### Step 1: Setup commander.js Program

**File**: `src/cli/convert.ts`

**Action**: Replace the stub with commander.js program configuration

**Implementation**:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Converter } from '../converter';
import { ConversionOptions, LoggerConfig } from '../types/converter-options';
import { ConversionResult } from '../types/conversion-result';

// Read version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
);

const program = new Command();

program
  .name('hashnode-converter')
  .description('Convert Hashnode blog exports to Markdown with YAML frontmatter')
  .version(packageJson.version);

program
  .command('convert')
  .description('Convert a Hashnode export JSON file to Markdown files')
  .requiredOption('-e, --export <path>', 'Path to Hashnode export JSON file')
  .requiredOption('-o, --output <path>', 'Output directory for converted posts')
  .option('-l, --log-file <path>', 'Path to log file (optional)')
  .option('--no-skip-existing', 'Overwrite posts that already exist')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress progress output (only show summary)')
  .action(async (options) => {
    await runConvert(options);
  });

program.parse();
```

### Step 2: Implement CLI Options Interface

**File**: `src/cli/convert.ts`

**Action**: Define TypeScript interface for parsed CLI options

**Implementation**:

```typescript
/**
 * CLI options parsed from command-line arguments
 */
interface CLIOptions {
  /** Path to Hashnode export JSON file */
  export: string;
  /** Output directory for converted posts */
  output: string;
  /** Optional path to log file */
  logFile?: string;
  /** Skip posts that already exist (default: true via --no-skip-existing) */
  skipExisting: boolean;
  /** Enable verbose output */
  verbose: boolean;
  /** Suppress progress output */
  quiet: boolean;
}
```

### Step 3: Implement Validation Functions

**File**: `src/cli/convert.ts`

**Action**: Create isolated validation functions following single-responsibility principle

Each validation function handles one specific concern, making them independently testable and reusable.

#### Step 3.1: Implement validateExportPath

```typescript
/**
 * Validate and resolve the export file path
 * @param exportPath - Raw path from CLI arguments
 * @returns Resolved absolute path
 * @throws {Error} If path does not exist
 */
function validateExportPath(exportPath: string): string {
  const resolvedPath = path.resolve(exportPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Export file not found: ${resolvedPath}`);
  }
  return resolvedPath;
}
```

#### Step 3.2: Implement validateExportIsFile

```typescript
/**
 * Validate the export path points to a file (not a directory)
 * @param exportPath - Resolved absolute path
 * @throws {Error} If path is not a file
 */
function validateExportIsFile(exportPath: string): void {
  const stats = fs.statSync(exportPath);
  if (!stats.isFile()) {
    throw new Error(`Export path is not a file: ${exportPath}`);
  }
}
```

#### Step 3.3: Implement validateExportJson

```typescript
/**
 * Validate the export file contains valid, readable JSON
 * @param exportPath - Resolved absolute path to export file
 * @throws {Error} If JSON is invalid or file is unreadable
 */
function validateExportJson(exportPath: string): void {
  try {
    const content = fs.readFileSync(exportPath, 'utf8');
    JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Export file contains invalid JSON: ${exportPath}`);
    }
    throw new Error(`Cannot read export file: ${exportPath}`);
  }
}
```

#### Step 3.4: Implement validateOutputPath

```typescript
/**
 * Validate the output directory's parent exists
 * Output directory itself will be created by Converter if needed
 * @param outputPath - Raw path from CLI arguments
 * @returns Resolved absolute path
 * @throws {Error} If parent directory does not exist
 */
function validateOutputPath(outputPath: string): string {
  const resolvedPath = path.resolve(outputPath);
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    throw new Error(`Parent directory does not exist: ${parentDir}`);
  }
  return resolvedPath;
}
```

#### Step 3.5: Implement validateLogFilePath

```typescript
/**
 * Validate the log file path if provided
 * @param logFilePath - Optional raw path from CLI arguments
 * @returns Resolved absolute path or undefined if not provided
 * @throws {Error} If parent directory does not exist
 */
function validateLogFilePath(logFilePath: string | undefined): string | undefined {
  if (!logFilePath) {
    return undefined;
  }
  const resolvedPath = path.resolve(logFilePath);
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    throw new Error(`Log file parent directory does not exist: ${parentDir}`);
  }
  return resolvedPath;
}
```

#### Step 3.6: Implement validateMutuallyExclusiveFlags

```typescript
/**
 * Validate that mutually exclusive CLI flags are not combined
 * @param verbose - Whether verbose flag is set
 * @param quiet - Whether quiet flag is set
 * @throws {Error} If incompatible flags are combined
 */
function validateMutuallyExclusiveFlags(verbose: boolean, quiet: boolean): void {
  if (verbose && quiet) {
    throw new Error('Cannot use both --verbose and --quiet options');
  }
}
```

#### Step 3.7: Implement validateOptions (Orchestrator)

```typescript
/**
 * Result of validation containing resolved paths
 */
interface ValidatedOptions {
  /** Resolved absolute path to export file */
  exportPath: string;
  /** Resolved absolute path to output directory */
  outputPath: string;
  /** Resolved absolute path to log file (if provided) */
  logFilePath: string | undefined;
}

/**
 * Validate all CLI options by delegating to specific validators
 * @param options - Parsed CLI options
 * @returns Validated and resolved paths
 * @throws {Error} If any validation fails
 */
function validateOptions(options: CLIOptions): ValidatedOptions {
  // Validate flags first (fast, no I/O)
  validateMutuallyExclusiveFlags(options.verbose, options.quiet);

  // Validate export file (existence, type, content)
  const exportPath = validateExportPath(options.export);
  validateExportIsFile(exportPath);
  validateExportJson(exportPath);

  // Validate output path
  const outputPath = validateOutputPath(options.output);

  // Validate optional log file path
  const logFilePath = validateLogFilePath(options.logFile);

  return {
    exportPath,
    outputPath,
    logFilePath,
  };
}
```

### Step 4: Implement Progress Display

**File**: `src/cli/convert.ts`

**Action**: Create progress callback and display functions

**Implementation**:

```typescript
/**
 * Create a progress callback based on verbosity settings
 */
function createProgressCallback(
  quiet: boolean,
  verbose: boolean
): (current: number, total: number, title: string) => void {
  if (quiet) {
    // No progress output in quiet mode
    return () => {};
  }

  return (current: number, total: number, title: string) => {
    const percentage = Math.round((current / total) * 100);
    const progressBar = createProgressBar(percentage);

    if (verbose) {
      console.log(`[${current}/${total}] ${progressBar} Converting: "${title}"`);
    } else {
      // Overwrite line for cleaner output
      process.stdout.write(`\r[${current}/${total}] ${progressBar} ${title.substring(0, 40)}...`);
    }
  };
}

/**
 * Create a simple ASCII progress bar
 */
function createProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round(width * (percentage / 100));
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * Display the conversion result summary
 */
function displayResult(result: ConversionResult, verbose: boolean): void {
  // Clear the progress line if we were using inline progress
  if (!verbose) {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('CONVERSION COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Converted: ${result.converted} posts`);
  console.log(`  Skipped:   ${result.skipped} posts`);
  console.log(`  Errors:    ${result.errors.length}`);
  console.log(`  Duration:  ${result.duration}`);
  console.log('='.repeat(60));

  if (result.errors.length > 0 && verbose) {
    console.log('\nErrors:');
    result.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.slug}] ${err.error}`);
    });
  }
}
```

### Step 5: Implement Main runConvert Function

**File**: `src/cli/convert.ts`

**Action**: Implement the main conversion orchestration function

**Implementation**:

```typescript
/**
 * Run the convert command with parsed CLI options
 * @param options - Parsed CLI options from commander
 */
async function runConvert(options: CLIOptions): Promise<void> {
  try {
    // Validate options and get resolved paths
    const validatedPaths = validateOptions(options);
    const { exportPath, outputPath, logFilePath } = validatedPaths;

    // Display startup info
    if (!options.quiet) {
      console.log(`\nHashnode Content Converter`);
      console.log(`Export:  ${exportPath}`);
      console.log(`Output:  ${outputPath}`);
      if (logFilePath) {
        console.log(`Log:     ${logFilePath}`);
      }
      console.log(`Skip existing: ${options.skipExisting}`);
      console.log('');
    }

    // Build conversion options
    const conversionOptions: ConversionOptions = {
      skipExisting: options.skipExisting,
    };

    // Add logger config if log file specified
    if (logFilePath) {
      const loggerConfig: LoggerConfig = {
        filePath: logFilePath,
        verbosity: options.verbose ? 'verbose' : options.quiet ? 'quiet' : 'normal',
      };
      conversionOptions.loggerConfig = loggerConfig;
    }

    // Create converter with progress callback
    const progressCallback = createProgressCallback(options.quiet, options.verbose);
    const converter = Converter.withProgress(progressCallback);

    // Run conversion
    const result = await converter.convertAllPosts(exportPath, outputPath, conversionOptions);

    // Display results
    displayResult(result, options.verbose);

    // Exit with appropriate code
    if (result.errors.length > 0) {
      process.exit(1);
    }
    process.exit(0);

  } catch (error) {
    // Handle fatal errors
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
}
```

### Step 6: Implement Main Entry Point

**File**: `src/cli/convert.ts`

**Action**: Add the main function wrapper for error handling

**Implementation**:

```typescript
/**
 * Main CLI entry point
 * Wrapped in async function for top-level await support
 */
async function main(): Promise<void> {
  try {
    program.parse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    process.exit(1);
  }
}

// Execute main if this is the entry point
main();
```

---

## Testing Strategy

### 1. Unit Test Approach

**File**: `tests/unit/cli.test.ts`

**Test Categories**:

#### A. Argument Parsing Tests (8 tests)
- ☐ Should parse required --export argument
- ☐ Should parse required --output argument
- ☐ Should parse optional --log-file argument
- ☐ Should default skipExisting to true
- ☐ Should set skipExisting to false with --no-skip-existing
- ☐ Should parse --verbose flag
- ☐ Should parse --quiet flag
- ☐ Should display help with --help

#### B. validateExportPath Tests (4 tests)
- ☐ Should return resolved absolute path when file exists
- ☐ Should throw when export file does not exist
- ☐ Should resolve relative paths to absolute
- ☐ Should handle paths with spaces

#### C. validateExportIsFile Tests (3 tests)
- ☐ Should pass when path is a file
- ☐ Should throw when path is a directory
- ☐ Should throw when path is a symlink to directory

#### D. validateExportJson Tests (4 tests)
- ☐ Should pass when file contains valid JSON
- ☐ Should throw when file contains invalid JSON (SyntaxError)
- ☐ Should throw when file is unreadable (permission error)
- ☐ Should handle empty JSON object

#### E. validateOutputPath Tests (3 tests)
- ☐ Should return resolved absolute path when parent exists
- ☐ Should throw when parent directory does not exist
- ☐ Should allow output directory to not exist (will be created)

#### F. validateLogFilePath Tests (4 tests)
- ☐ Should return undefined when logFilePath is undefined
- ☐ Should return resolved path when parent directory exists
- ☐ Should throw when parent directory does not exist
- ☐ Should handle empty string as undefined

#### G. validateMutuallyExclusiveFlags Tests (3 tests)
- ☐ Should pass when only verbose is true
- ☐ Should pass when only quiet is true
- ☐ Should throw when both verbose and quiet are true

#### H. validateOptions (Orchestrator) Tests (4 tests)
- ☐ Should return ValidatedOptions with all resolved paths
- ☐ Should call validators in correct order (flags first)
- ☐ Should propagate errors from individual validators
- ☐ Should include logFilePath as undefined when not provided

#### I. Progress Display Tests (6 tests)
- ☐ Should display progress in default mode
- ☐ Should display detailed progress in verbose mode
- ☐ Should suppress progress in quiet mode
- ☐ Should create correct progress bar percentage
- ☐ Should truncate long titles in progress display
- ☐ Should clear progress line before summary

#### J. Result Display Tests (5 tests)
- ☐ Should display conversion summary
- ☐ Should show converted count
- ☐ Should show skipped count
- ☐ Should show error count
- ☐ Should list errors in verbose mode

#### K. Exit Code Tests (4 tests)
- ☐ Should exit with 0 on successful conversion
- ☐ Should exit with 1 when errors occur
- ☐ Should exit with 1 on validation failure
- ☐ Should exit with 1 on fatal error

#### L. Integration with Converter Tests (5 tests)
- ☐ Should create Converter with progress callback
- ☐ Should pass skipExisting option to Converter
- ☐ Should pass loggerConfig to Converter
- ☐ Should call convertAllPosts with correct paths
- ☐ Should handle Converter errors gracefully

**Total Tests**: ~53 tests (targeting 90% coverage)

### 2. Test Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Statements** | ≥90% | All code paths exercised |
| **Branches** | ≥90% | All conditions tested (verbose/quiet/default) |
| **Functions** | ≥90% | All functions covered |
| **Lines** | ≥90% | Complete line coverage |

### 3. Test Implementation Pattern

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import functions to test (will need to export them)
import {
  validateExportPath,
  validateExportIsFile,
  validateExportJson,
  validateOutputPath,
  validateLogFilePath,
  validateMutuallyExclusiveFlags,
  validateOptions,
} from '../../src/cli/convert';

// Mock fs module
vi.mock('fs');

describe('CLI Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateExportPath', () => {
    it('should return resolved path when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateExportPath('./export.json');

      expect(result).toBe(path.resolve('./export.json'));
    });

    it('should throw when export file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateExportPath('/nonexistent/export.json'))
        .toThrow('Export file not found');
    });
  });

  describe('validateExportIsFile', () => {
    it('should pass when path is a file', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      expect(() => validateExportIsFile('/path/to/file.json')).not.toThrow();
    });

    it('should throw when path is a directory', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => false,
      } as fs.Stats);

      expect(() => validateExportIsFile('/path/to/directory'))
        .toThrow('Export path is not a file');
    });
  });

  describe('validateExportJson', () => {
    it('should pass when file contains valid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{"posts": []}');

      expect(() => validateExportJson('/path/to/export.json')).not.toThrow();
    });

    it('should throw when file contains invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      expect(() => validateExportJson('/path/to/export.json'))
        .toThrow('Export file contains invalid JSON');
    });
  });

  describe('validateMutuallyExclusiveFlags', () => {
    it('should pass when only verbose is true', () => {
      expect(() => validateMutuallyExclusiveFlags(true, false)).not.toThrow();
    });

    it('should throw when both verbose and quiet are true', () => {
      expect(() => validateMutuallyExclusiveFlags(true, true))
        .toThrow('Cannot use both --verbose and --quiet options');
    });
  });

  describe('validateOptions', () => {
    it('should return ValidatedOptions with all resolved paths', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"posts": []}');

      const options = {
        export: './export.json',
        output: './output',
        logFile: './log.txt',
        skipExisting: true,
        verbose: false,
        quiet: false,
      };

      const result = validateOptions(options);

      expect(result.exportPath).toBe(path.resolve('./export.json'));
      expect(result.outputPath).toBe(path.resolve('./output'));
      expect(result.logFilePath).toBe(path.resolve('./log.txt'));
    });
  });
});
```

---

## Integration Points

### 1. Upstream (Input)
- **Source**: Command-line arguments via process.argv
- **Input Type**: String arguments parsed by commander.js
- **Integration**: commander.js parses argv and invokes action handler

### 2. Downstream (Output)
- **Output Type**: `ConversionResult` from Converter
- **Next Stage**: Console output and process exit
- **Integration**: Calls `Converter.withProgress()` and `convertAllPosts()`

### 3. Dependencies
- **Converter class**: `src/converter.ts` - Main conversion orchestrator
- **ConversionOptions**: `src/types/converter-options.ts` - Configuration interface
- **ConversionResult**: `src/types/conversion-result.ts` - Result interface
- **commander.js**: External package for argument parsing

### 4. Error Flow
- **Validation errors**: Caught in `runConvert()`, displayed to stderr, exit code 1
- **Converter errors**: Caught via try/catch, displayed to stderr, exit code 1
- **Fatal errors**: Caught in `main()`, displayed to stderr, exit code 1

---

## Potential Challenges & Solutions

### Challenge 1: Testing Process.exit()

**Issue**: `process.exit()` terminates the process, making testing difficult

**Solution**: Mock `process.exit()` in tests using vitest's `vi.spyOn()`:
```typescript
vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
```

**Risk Level**: Low

### Challenge 2: Testing Console Output

**Issue**: Need to verify correct console output without polluting test logs

**Solution**: Mock console methods and capture calls:
```typescript
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
// ... run code ...
expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Converted'));
```

**Risk Level**: Low

### Challenge 3: Path Resolution Across Platforms

**Issue**: Path handling may differ between Windows and Unix

**Solution**:
- Use `path.resolve()` for all path operations
- Note: Windows is explicitly unsupported per CLAUDE.md, so this is low risk

**Risk Level**: Low (Windows not supported)

### Challenge 4: Inline Progress Display

**Issue**: Overwriting the same line (`\r`) may not work in all terminals

**Solution**:
- Use `process.stdout.write()` for inline updates
- Provide `--verbose` mode with newlines for each update
- Clear line before final summary

**Risk Level**: Low

---

## Success Criteria

### Functional Requirements
- ☐ CLI parses all required arguments (--export, --output)
- ☐ CLI parses optional arguments (--log-file, --no-skip-existing, --verbose, --quiet)
- ☐ CLI validates input paths exist
- ☐ CLI displays progress during conversion
- ☐ CLI displays summary after completion
- ☐ CLI exits with code 0 on success
- ☐ CLI exits with code 1 on errors
- ☐ CLI integrates with Converter class correctly

### Non-Functional Requirements
- ☐ 90%+ test coverage
- ☐ No `any` types in production code
- ☐ All public functions documented with JSDoc
- ☐ TypeScript compilation passes
- ☐ Build succeeds
- ☐ All tests pass

### Code Quality
- ☐ Follows existing patterns for consistency
- ☐ Single responsibility principle (validation, display, conversion separate)
- ☐ Comprehensive error handling
- ☐ User-friendly error messages

---

## Verification Checklist

### Pre-Implementation
- [x] GitHub Issue #10 reviewed
- [x] Type definitions understood (ConversionOptions, ConversionResult)
- [x] Reference implementation analyzed (convert-hashnode.js)
- [x] Converter class and event system understood
- [x] commander.js dependency confirmed in package.json

### Post-Implementation

```bash
# Verify TypeScript compilation
nvm use $(cat .node-version) && npm run type-check
# Expected: No TypeScript errors

# Verify build succeeds
nvm use $(cat .node-version) && npm run build
# Expected: dist/ directory created with dist/cli/convert.js

# Run tests
nvm use $(cat .node-version) && npm test
# Expected: All tests pass

# Generate coverage report
nvm use $(cat .node-version) && npm run test:coverage
# Expected: ≥90% coverage for src/cli/convert.ts

# Manual CLI test
nvm use $(cat .node-version) && node dist/cli/convert.js --help
# Expected: Help text displayed

# Manual conversion test (with test fixture)
nvm use $(cat .node-version) && node dist/cli/convert.js convert \
  --export tests/fixtures/sample-hashnode-export.json \
  --output /tmp/test-output \
  --verbose
# Expected: Conversion completes with output
```

---

## Implementation Checklist

### Phase 1: Core CLI Structure
- [ ] Replace stub in `src/cli/convert.ts`
- [ ] Setup commander.js with program metadata
- [ ] Define `convert` command with arguments
- [ ] Add CLIOptions interface

### Phase 2: Validation Functions
- [ ] Implement `validateExportPath()` - check file exists, return resolved path
- [ ] Implement `validateExportIsFile()` - check path is a file not directory
- [ ] Implement `validateExportJson()` - check file contains valid JSON
- [ ] Implement `validateOutputPath()` - check parent directory exists
- [ ] Implement `validateLogFilePath()` - check parent directory exists (optional)
- [ ] Implement `validateMutuallyExclusiveFlags()` - check verbose/quiet conflict
- [ ] Implement `ValidatedOptions` interface
- [ ] Implement `validateOptions()` orchestrator - delegates to specific validators

### Phase 3: Progress Display
- [ ] Implement `createProgressCallback()`
- [ ] Implement `createProgressBar()`
- [ ] Implement `displayResult()`
- [ ] Handle verbose/quiet modes

### Phase 4: Conversion Integration
- [ ] Implement `runConvert()` function
- [ ] Map CLI options to ConversionOptions
- [ ] Create Converter with progress callback
- [ ] Handle conversion errors

### Phase 5: Testing
- [ ] Create `tests/unit/cli.test.ts`
- [ ] Export validation functions for testing (or test via module internals)
- [ ] Write argument parsing tests (8 tests)
- [ ] Write `validateExportPath` tests (4 tests)
- [ ] Write `validateExportIsFile` tests (3 tests)
- [ ] Write `validateExportJson` tests (4 tests)
- [ ] Write `validateOutputPath` tests (3 tests)
- [ ] Write `validateLogFilePath` tests (4 tests)
- [ ] Write `validateMutuallyExclusiveFlags` tests (3 tests)
- [ ] Write `validateOptions` orchestrator tests (4 tests)
- [ ] Write progress display tests (6 tests)
- [ ] Write result display tests (5 tests)
- [ ] Write exit code tests (4 tests)
- [ ] Write Converter integration tests (5 tests)
- [ ] Verify 90%+ coverage

### Phase 6: Verification
- [ ] Run type-check
- [ ] Run build
- [ ] Run tests
- [ ] Review coverage report
- [ ] Manual CLI testing

### Phase 7: Documentation
- [ ] Update TRANSITION.md status
- [ ] Update GitHub issue #10
- [ ] Document any deviations from plan

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Process.exit mocking issues | Low | Medium | Use established vitest patterns |
| Console output testing | Low | Low | Mock console methods |
| Progress display edge cases | Medium | Low | Provide verbose fallback |
| Path handling issues | Low | Medium | Use path.resolve(), Unix-only support |

---

## Reference Implementation

### Original Script CLI Pattern

From `convert-hashnode.js` (lines 139-168):

```javascript
// Determine export and read directories from environment variables
const exportDirName = process.env.EXPORT_DIR || 'blog';
const readDirName = process.env.READ_DIR || 'blog';

const exportDir = path.join(process.cwd(), exportDirName);
const readDir = path.join(process.cwd(), readDirName);

// Verify the export directory exists
if (!fs.existsSync(exportDir)) {
  logger.error(`✗ Error: Export directory does not exist: ${exportDir}`);
  process.exit(1);
}

// Verify the read directory exists
if (!fs.existsSync(readDir)) {
  logger.error(`✗ Error: Read directory does not exist: ${readDir}`);
  process.exit(1);
}

// Read the Hashnode export
const exportPath = path.join(__dirname, 'hashnode', 'export-articles.json');
const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

logger.info(`📚 Found ${data.posts.length} posts to convert`);
```

### Key Differences in New Implementation

1. **Configuration**: Environment variables replaced with CLI arguments
2. **Argument parsing**: Use commander.js instead of manual parsing
3. **Flexibility**: User specifies export file and output directory
4. **Progress display**: Real-time progress via Converter events
5. **Error handling**: Structured error messages with exit codes
6. **Testability**: Modular functions that can be unit tested

---

## Next Steps After Implementation

1. **Phase 6.2**: Add CLI entry point to package.json bin field
2. **Phase 7**: Integration testing with full conversion pipeline
3. **Phase 8**: Documentation (README with CLI usage examples)

---

## Summary

**Phase 6.1** will deliver a complete CLI interface that:
- Provides user-friendly command-line argument parsing via commander.js
- Validates input paths and options before conversion
- Displays real-time progress during conversion
- Shows a summary of results after completion
- Exits with appropriate status codes for scripting integration
- Achieves 90%+ test coverage with comprehensive unit tests

**Ready to implement?** This plan provides comprehensive guidance for building a robust, well-tested CLI that integrates seamlessly with the existing Converter class.
