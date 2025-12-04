#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Converter } from '../converter';
import { ConversionOptions, LoggerConfig } from '../types/converter-options';
import { ConversionResult } from '../types/conversion-result';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and resolve the export file path
 * @param exportPath - Raw path from CLI arguments
 * @returns Resolved absolute path
 * @throws {Error} If path does not exist
 */
export function validateExportPath(exportPath: string): string {
  const resolvedPath = path.resolve(exportPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Export file not found: ${resolvedPath}`);
  }
  return resolvedPath;
}

/**
 * Validate the export path points to a file (not a directory)
 * @param exportPath - Resolved absolute path
 * @throws {Error} If path is not a file
 */
export function validateExportIsFile(exportPath: string): void {
  const stats = fs.statSync(exportPath);
  if (!stats.isFile()) {
    throw new Error(`Export path is not a file: ${exportPath}`);
  }
}

/**
 * Validate the export file contains valid, readable JSON
 * @param exportPath - Resolved absolute path to export file
 * @throws {Error} If JSON is invalid or file is unreadable
 */
export function validateExportJson(exportPath: string): void {
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

/**
 * Validate the output directory's parent exists
 * Output directory itself will be created by Converter if needed
 * @param outputPath - Raw path from CLI arguments
 * @returns Resolved absolute path
 * @throws {Error} If parent directory does not exist
 */
export function validateOutputPath(outputPath: string): string {
  const resolvedPath = path.resolve(outputPath);
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    throw new Error(`Parent directory does not exist: ${parentDir}`);
  }
  return resolvedPath;
}

/**
 * Validate the log file path if provided
 * @param logFilePath - Optional raw path from CLI arguments
 * @returns Resolved absolute path or undefined if not provided
 * @throws {Error} If parent directory does not exist
 */
export function validateLogFilePath(logFilePath: string | undefined): string | undefined {
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

/**
 * Validate that mutually exclusive CLI flags are not combined
 * @param verbose - Whether verbose flag is set
 * @param quiet - Whether quiet flag is set
 * @throws {Error} If incompatible flags are combined
 */
export function validateMutuallyExclusiveFlags(verbose: boolean, quiet: boolean): void {
  if (verbose && quiet) {
    throw new Error('Cannot use both --verbose and --quiet options');
  }
}

/**
 * Validate all CLI options by delegating to specific validators
 * @param options - Parsed CLI options
 * @returns Validated and resolved paths
 * @throws {Error} If any validation fails
 */
export function validateOptions(options: CLIOptions): ValidatedOptions {
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

// =============================================================================
// Progress Display Functions
// =============================================================================

/**
 * Create a simple ASCII progress bar
 * @param percentage - Progress percentage (0-100)
 * @returns ASCII progress bar string
 */
export function createProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round(width * (percentage / 100));
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * Create a progress callback based on verbosity settings
 * @param quiet - Whether quiet mode is enabled
 * @param verbose - Whether verbose mode is enabled
 * @returns Progress callback function
 */
export function createProgressCallback(
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
      const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
      process.stdout.write(`\r[${current}/${total}] ${progressBar} ${truncatedTitle}`.padEnd(80));
    }
  };
}

/**
 * Display the conversion result summary
 * @param result - Conversion result from Converter
 * @param verbose - Whether verbose mode is enabled
 */
export function displayResult(result: ConversionResult, verbose: boolean): void {
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

// =============================================================================
// Main Command Handler
// =============================================================================

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
      console.log('\nHashnode Content Converter');
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

// =============================================================================
// CLI Program Setup
// =============================================================================

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
let version = '0.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version || '0.0.0';
} catch {
  // Use default version if package.json can't be read
}

const program = new Command();

program
  .name('hashnode-converter')
  .description('Convert Hashnode blog exports to Markdown with YAML frontmatter')
  .version(version);

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

// Export for testing
export { program, runConvert, CLIOptions, ValidatedOptions };

// Parse arguments and execute only when run directly (not imported)
// Check if this module is being run directly via node
const isMainModule = require.main === module;
if (isMainModule) {
  program.parse();
}
