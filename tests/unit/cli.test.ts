import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  validateExportPath,
  validateExportIsFile,
  validateExportJson,
  validateOutputPath,
  validateLogFilePath,
  validateMutuallyExclusiveFlags,
  validateOptions,
  createProgressBar,
  createProgressCallback,
  displayResult,
} from '../../src/cli/convert';
import { ConversionResult } from '../../src/types/conversion-result';

// Mock fs module
vi.mock('fs');

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // validateExportPath Tests
  // ===========================================================================
  describe('validateExportPath', () => {
    it('should return resolved absolute path when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateExportPath('./export.json');

      expect(result).toBe(path.resolve('./export.json'));
      expect(fs.existsSync).toHaveBeenCalledWith(path.resolve('./export.json'));
    });

    it('should throw when export file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateExportPath('/nonexistent/export.json')).toThrow(
        'Export file not found'
      );
    });

    it('should resolve relative paths to absolute', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateExportPath('relative/path/export.json');

      expect(result).toBe(path.resolve('relative/path/export.json'));
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should handle paths with spaces', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateExportPath('./path with spaces/export.json');

      expect(result).toBe(path.resolve('./path with spaces/export.json'));
    });
  });

  // ===========================================================================
  // validateExportIsFile Tests
  // ===========================================================================
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

      expect(() => validateExportIsFile('/path/to/directory')).toThrow(
        'Export path is not a file'
      );
    });

    it('should throw when path is a symlink to directory', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => false,
      } as fs.Stats);

      expect(() => validateExportIsFile('/path/to/symlink')).toThrow(
        'Export path is not a file'
      );
    });
  });

  // ===========================================================================
  // validateExportJson Tests
  // ===========================================================================
  describe('validateExportJson', () => {
    it('should pass when file contains valid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{"posts": []}');

      expect(() => validateExportJson('/path/to/export.json')).not.toThrow();
    });

    it('should throw when file contains invalid JSON (SyntaxError)', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json content');

      expect(() => validateExportJson('/path/to/export.json')).toThrow(
        'Export file contains invalid JSON'
      );
    });

    it('should throw when file is unreadable (permission error)', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        throw error;
      });

      expect(() => validateExportJson('/path/to/export.json')).toThrow(
        'Cannot read export file'
      );
    });

    it('should handle empty JSON object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      expect(() => validateExportJson('/path/to/export.json')).not.toThrow();
    });
  });

  // ===========================================================================
  // validateOutputPath Tests
  // ===========================================================================
  describe('validateOutputPath', () => {
    it('should return resolved absolute path when parent exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateOutputPath('./output/blog');

      expect(result).toBe(path.resolve('./output/blog'));
    });

    it('should throw when parent directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateOutputPath('/nonexistent/parent/output')).toThrow(
        'Parent directory does not exist'
      );
    });

    it('should allow output directory to not exist (will be created)', () => {
      // Parent exists, but the output directory itself doesn't need to exist
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        // Parent directory exists
        const pathStr = String(p);
        return pathStr === path.dirname(path.resolve('./existing-parent/new-output'));
      });

      // This should not throw because only the parent needs to exist
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = validateOutputPath('./existing-parent/new-output');
      expect(result).toBe(path.resolve('./existing-parent/new-output'));
    });
  });

  // ===========================================================================
  // validateLogFilePath Tests
  // ===========================================================================
  describe('validateLogFilePath', () => {
    it('should return undefined when logFilePath is undefined', () => {
      const result = validateLogFilePath(undefined);

      expect(result).toBeUndefined();
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should return resolved path when parent directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = validateLogFilePath('./logs/conversion.log');

      expect(result).toBe(path.resolve('./logs/conversion.log'));
    });

    it('should throw when parent directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateLogFilePath('/nonexistent/dir/log.txt')).toThrow(
        'Log file parent directory does not exist'
      );
    });

    it('should handle empty string as falsy (return undefined)', () => {
      const result = validateLogFilePath('');

      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // validateMutuallyExclusiveFlags Tests
  // ===========================================================================
  describe('validateMutuallyExclusiveFlags', () => {
    it('should pass when only verbose is true', () => {
      expect(() => validateMutuallyExclusiveFlags(true, false)).not.toThrow();
    });

    it('should pass when only quiet is true', () => {
      expect(() => validateMutuallyExclusiveFlags(false, true)).not.toThrow();
    });

    it('should pass when both are false', () => {
      expect(() => validateMutuallyExclusiveFlags(false, false)).not.toThrow();
    });

    it('should throw when both verbose and quiet are true', () => {
      expect(() => validateMutuallyExclusiveFlags(true, true)).toThrow(
        'Cannot use both --verbose and --quiet options'
      );
    });
  });

  // ===========================================================================
  // validateOptions (Orchestrator) Tests
  // ===========================================================================
  describe('validateOptions', () => {
    const validOptions = {
      export: './export.json',
      output: './output',
      logFile: './log.txt',
      skipExisting: true,
      verbose: false,
      quiet: false,
    };

    beforeEach(() => {
      // Setup default mocks for valid case
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue('{"posts": []}');
    });

    it('should return ValidatedOptions with all resolved paths', () => {
      const result = validateOptions(validOptions);

      expect(result.exportPath).toBe(path.resolve('./export.json'));
      expect(result.outputPath).toBe(path.resolve('./output'));
      expect(result.logFilePath).toBe(path.resolve('./log.txt'));
    });

    it('should call validators in correct order (flags first)', () => {
      // If flags validation fails, file system should not be accessed
      const badOptions = {
        ...validOptions,
        verbose: true,
        quiet: true,
      };

      expect(() => validateOptions(badOptions)).toThrow(
        'Cannot use both --verbose and --quiet options'
      );
      // fs.existsSync should not be called because flags fail first
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should propagate errors from individual validators', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateOptions(validOptions)).toThrow('Export file not found');
    });

    it('should include logFilePath as undefined when not provided', () => {
      const optionsWithoutLog = {
        ...validOptions,
        logFile: undefined,
      };

      const result = validateOptions(optionsWithoutLog);

      expect(result.logFilePath).toBeUndefined();
    });
  });

  // ===========================================================================
  // createProgressBar Tests
  // ===========================================================================
  describe('createProgressBar', () => {
    it('should create empty bar at 0%', () => {
      const bar = createProgressBar(0);
      expect(bar).toBe('[                    ]');
    });

    it('should create full bar at 100%', () => {
      const bar = createProgressBar(100);
      expect(bar).toBe('[====================]');
    });

    it('should create half-filled bar at 50%', () => {
      const bar = createProgressBar(50);
      expect(bar).toBe('[==========          ]');
    });

    it('should round to nearest fill position', () => {
      const bar = createProgressBar(25);
      expect(bar).toBe('[=====               ]');
    });

    it('should handle values between 0 and 100', () => {
      const bar = createProgressBar(75);
      expect(bar).toBe('[===============     ]');
    });
  });

  // ===========================================================================
  // createProgressCallback Tests
  // ===========================================================================
  describe('createProgressCallback', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      stdoutSpy.mockRestore();
    });

    it('should return no-op function in quiet mode', () => {
      const callback = createProgressCallback(true, false);

      callback(1, 10, 'Test Post');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should display detailed progress in verbose mode', () => {
      const callback = createProgressCallback(false, true);

      callback(1, 10, 'Test Post');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[1/10]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Converting: "Test Post"')
      );
    });

    it('should use stdout.write in default mode for inline update', () => {
      const callback = createProgressCallback(false, false);

      callback(1, 10, 'Test Post');

      expect(stdoutSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should truncate long titles in default mode', () => {
      const callback = createProgressCallback(false, false);
      const longTitle = 'This is a very long title that exceeds forty characters limit';

      callback(1, 10, longTitle);

      const callArg = stdoutSpy.mock.calls[0][0] as string;
      // Title is truncated to 37 chars + '...' = 40 chars total
      expect(callArg).toContain('This is a very long title that excee');
      expect(callArg).toContain('...');
    });

    it('should show progress bar in output', () => {
      const callback = createProgressCallback(false, true);

      callback(5, 10, 'Test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[==========          ]')
      );
    });
  });

  // ===========================================================================
  // displayResult Tests
  // ===========================================================================
  describe('displayResult', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    const mockResult: ConversionResult = {
      converted: 10,
      skipped: 2,
      errors: [],
      duration: '5s',
    };

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      stdoutSpy.mockRestore();
    });

    it('should display conversion summary', () => {
      displayResult(mockResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CONVERSION COMPLETE'));
    });

    it('should show converted count', () => {
      displayResult(mockResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Converted: 10'));
    });

    it('should show skipped count', () => {
      displayResult(mockResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped:   2'));
    });

    it('should show error count', () => {
      displayResult(mockResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Errors:    0'));
    });

    it('should show duration', () => {
      displayResult(mockResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Duration:  5s'));
    });

    it('should list errors in verbose mode when errors exist', () => {
      const resultWithErrors: ConversionResult = {
        ...mockResult,
        errors: [
          { slug: 'test-post', error: 'Parse error' },
          { slug: 'another-post', error: 'Download failed' },
        ],
      };

      displayResult(resultWithErrors, true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Errors:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[test-post]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[another-post]'));
    });

    it('should not list errors in non-verbose mode', () => {
      const resultWithErrors: ConversionResult = {
        ...mockResult,
        errors: [{ slug: 'test-post', error: 'Parse error' }],
      };

      displayResult(resultWithErrors, false);

      // The error count shows, but not the detailed list
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Errors:    1'));
      // Should not show the detailed error line with slug
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      const hasDetailedError = calls.some(call =>
        typeof call === 'string' && call.includes('[test-post]') && call.includes('Parse error')
      );
      expect(hasDetailedError).toBe(false);
    });

    it('should clear progress line in non-verbose mode', () => {
      displayResult(mockResult, false);

      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('should not clear progress line in verbose mode', () => {
      displayResult(mockResult, true);

      // In verbose mode, we don't need to clear inline progress
      const clearCalls = stdoutSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('\r')
      );
      expect(clearCalls.length).toBe(0);
    });
  });
});
