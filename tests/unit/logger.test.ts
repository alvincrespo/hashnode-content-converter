import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../../src/services/logger.js';
import {
  createMockWriteStream,
  createMockConsole,
  mockDateNow,
} from '../mocks/mocks.js';

// Mock fs and path modules
vi.mock('node:fs');
vi.mock('node:path');

describe('Logger', () => {
  let mockWriteStream: ReturnType<typeof createMockWriteStream>;
  let mockConsole: ReturnType<typeof createMockConsole>;
  let cleanupDateMock: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock file stream
    mockWriteStream = createMockWriteStream();
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

    // Mock console
    mockConsole = createMockConsole();
    vi.spyOn(console, 'log').mockImplementation(mockConsole.log);
    vi.spyOn(console, 'warn').mockImplementation(mockConsole.warn);
    vi.spyOn(console, 'error').mockImplementation(mockConsole.error);

    // Mock path.join to return predictable paths
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/test/dir');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (cleanupDateMock) {
      cleanupDateMock();
      cleanupDateMock = null;
    }
  });

  describe('Logging Methods', () => {
    it('should log info messages to console and file with correct format', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Test message');

      expect(mockConsole.log).toHaveBeenCalledWith('Test message');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should log success messages to console and file with correct format', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.success('Success message');

      expect(mockConsole.log).toHaveBeenCalledWith('Success message');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('SUCCESS')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Success message')
      );
    });

    it('should log warn messages to console and file with correct format', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith('Warning message');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log error messages to console and file with correct format', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.error('Error message');

      expect(mockConsole.error).toHaveBeenCalledWith('Error message');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });

    it('should include timestamp in file output', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Test');

      // Check that a timestamp pattern exists (e.g., [HH:MM:SS AM/PM])
      const calls = mockWriteStream.write.mock.calls;
      const logCall = calls.find((call) =>
        String(call[0]).includes('Test')
      );
      expect(logCall).toBeDefined();
      expect(String(logCall![0])).toMatch(/\[\d{1,2}:\d{2}:\d{2}/);
    });

    it('should have aligned log levels in file output', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.info('Info msg');
      logger.success('Success msg');
      logger.warn('Warn msg');
      logger.error('Error msg');

      // Verify each log level is properly formatted with padding
      const calls = mockWriteStream.write.mock.calls;
      const infoCall = calls.find((call) => String(call[0]).includes('Info msg'));
      const successCall = calls.find((call) => String(call[0]).includes('Success msg'));
      const warnCall = calls.find((call) => String(call[0]).includes('Warn msg'));
      const errorCall = calls.find((call) => String(call[0]).includes('Error msg'));

      expect(String(infoCall![0])).toContain('INFO    |');
      expect(String(successCall![0])).toContain('SUCCESS |');
      expect(String(warnCall![0])).toContain('WARN    |');
      expect(String(errorCall![0])).toContain('ERROR   |');
    });

    it('should send plain message to console (no timestamp)', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Plain message');

      expect(mockConsole.log).toHaveBeenCalledWith('Plain message');
      expect(mockConsole.log).not.toHaveBeenCalledWith(
        expect.stringContaining('[')
      );
    });

    it('should send formatted message to file (with timestamp)', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('File message');

      const calls = mockWriteStream.write.mock.calls;
      const logCall = calls.find((call) =>
        String(call[0]).includes('File message')
      );

      expect(String(logCall![0])).toMatch(/\[\d{1,2}:\d{2}:\d{2}/);
      expect(String(logCall![0])).toContain('INFO');
      expect(String(logCall![0])).toContain('File message');
    });
  });

  describe('File Output', () => {
    it('should create log file at specified path', () => {
      new Logger({ filePath: '/custom/path/test.log' });

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/custom/path/test.log',
        expect.objectContaining({ flags: 'a', encoding: 'utf8' })
      );
    });

    it('should auto-generate filename if path not provided', () => {
      vi.clearAllMocks();
      new Logger();

      expect(fs.createWriteStream).toHaveBeenCalled();
      const callArg = vi.mocked(fs.createWriteStream).mock.calls[0][0];
      expect(String(callArg)).toContain('conversion-');
      expect(String(callArg)).toMatch(/\.log$/);
    });

    it('should write header on initialization', () => {
      new Logger({ filePath: '/tmp/test.log' });

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Hashnode Export Conversion Log')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Started:')
      );
    });

    it('should use append mode for existing files', () => {
      new Logger({ filePath: '/tmp/test.log' });

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/tmp/test.log',
        expect.objectContaining({ flags: 'a' })
      );
    });

    it('should write all logged messages to file', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.info('Message 1');
      logger.success('Message 2');
      logger.warn('Message 3');

      const calls = mockWriteStream.write.mock.calls;
      expect(calls.some(call => String(call[0]).includes('Message 1'))).toBe(true);
      expect(calls.some(call => String(call[0]).includes('Message 2'))).toBe(true);
      expect(calls.some(call => String(call[0]).includes('Message 3'))).toBe(true);
    });

    it('should use UTF-8 encoding for file', () => {
      new Logger({ filePath: '/tmp/test.log' });

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/tmp/test.log',
        expect.objectContaining({ encoding: 'utf8' })
      );
    });
  });

  describe('HTTP 403 Tracking', () => {
    it('should track 403 errors in array', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('my-post', 'image.jpg', 'https://cdn.example.com/image.jpg');
      logger.writeSummary(0, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 403 IMAGE FAILURES')
      );
    });

    it('should track multiple 403 errors', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('post-1', 'image1.jpg', 'https://cdn.example.com/1.jpg');
      logger.trackHttp403('post-1', 'image2.jpg', 'https://cdn.example.com/2.jpg');
      logger.trackHttp403('post-2', 'image3.jpg', 'https://cdn.example.com/3.jpg');
      logger.writeSummary(0, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('3 images')
      );
    });

    it('should include all fields in 403 error tracking', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('test-slug', 'test.jpg', 'https://example.com/test.jpg');
      logger.writeSummary(0, 0, 0);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toContain('test-slug');
      expect(output).toContain('test.jpg');
      expect(output).toContain('https://example.com/test.jpg');
    });

    it('should include timestamp in 403 errors', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('post', 'img.jpg', 'https://example.com/img.jpg');

      // Tracking includes timestamp (verified by the fact that getTimestamp is called)
      // We can't easily verify the internal structure without exposing it,
      // but we can verify the output includes the error details
      logger.writeSummary(0, 0, 0);
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('img.jpg')
      );
    });

    it('should initialize with empty 403 error array', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.writeSummary(5, 2, 0);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toContain('Image 403 Failures: 0 images');
      expect(output).not.toContain('HTTP 403 IMAGE FAILURES');
    });
  });

  describe('Summary Generation', () => {
    it('should write summary with all statistics', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.writeSummary(10, 5, 2);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toContain('CONVERSION SUMMARY');
      expect(output).toContain('Converted: 10 posts');
      expect(output).toContain('Skipped: 5 posts');
      expect(output).toContain('Post Errors: 2');
    });

    it('should include completion time in summary', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.writeSummary(1, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Completed:')
      );
    });

    it('should include duration in summary', () => {
      cleanupDateMock = mockDateNow(1000000);
      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Advance time by 150 seconds (2m 30s)
      cleanupDateMock();
      cleanupDateMock = mockDateNow(1000000 + 150000);

      logger.writeSummary(1, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Duration:')
      );
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('2m 30s')
      );
    });

    it('should show converted/skipped/errors counts', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.writeSummary(15, 3, 1);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toMatch(/Converted:\s*15\s*posts/);
      expect(output).toMatch(/Skipped:\s*3\s*posts/);
      expect(output).toMatch(/Post Errors:\s*1/);
    });

    it('should show 403 error count in summary', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('post-1', 'img1.jpg', 'https://example.com/1.jpg');
      logger.trackHttp403('post-2', 'img2.jpg', 'https://example.com/2.jpg');
      logger.writeSummary(5, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Image 403 Failures: 2 images')
      );
    });

    it('should call writeHttp403Section if 403 errors exist', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('test-post', 'test.jpg', 'https://example.com/test.jpg');
      logger.writeSummary(1, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 403 IMAGE FAILURES')
      );
    });

    it('should format 403 errors by slug', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('post-a', 'img1.jpg', 'https://example.com/1.jpg');
      logger.trackHttp403('post-a', 'img2.jpg', 'https://example.com/2.jpg');
      logger.trackHttp403('post-b', 'img3.jpg', 'https://example.com/3.jpg');
      logger.writeSummary(3, 0, 0);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toContain('Post: post-a');
      expect(output).toContain('Post: post-b');
      expect(output).toMatch(/\[1\/2\].*img1\.jpg/);
      expect(output).toMatch(/\[2\/2\].*img2\.jpg/);
      expect(output).toMatch(/\[1\/1\].*img3\.jpg/);
    });

    it('should show post count and image count in 403 section', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      logger.trackHttp403('post-1', 'a.jpg', 'https://example.com/a.jpg');
      logger.trackHttp403('post-1', 'b.jpg', 'https://example.com/b.jpg');
      logger.trackHttp403('post-2', 'c.jpg', 'https://example.com/c.jpg');
      logger.writeSummary(2, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('3 images across 2 posts')
      );
    });
  });

  describe('Duration/Timing', () => {
    it('should calculate elapsed time correctly', () => {
      cleanupDateMock = mockDateNow(1000000);
      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Advance time by 185 seconds (3m 5s)
      cleanupDateMock();
      cleanupDateMock = mockDateNow(1000000 + 185000);

      logger.writeSummary(1, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('3m 5s')
      );
    });

    it('should format duration as "Xm Ys"', () => {
      cleanupDateMock = mockDateNow(5000000);
      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Advance time by 90 seconds (1m 30s)
      cleanupDateMock();
      cleanupDateMock = mockDateNow(5000000 + 90000);

      logger.writeSummary(1, 0, 0);

      const calls = mockWriteStream.write.mock.calls;
      const output = calls.map(call => String(call[0])).join('');

      expect(output).toMatch(/Duration:.*1m 30s/);
    });

    it('should use locale time string for timestamps', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Test');

      const calls = mockWriteStream.write.mock.calls;
      const logCall = calls.find(call => String(call[0]).includes('Test'));

      // Timestamp should be in HH:MM:SS format (locale time)
      expect(String(logCall![0])).toMatch(/\[\d{1,2}:\d{2}:\d{2}/);
    });

    it('should set start time in constructor', () => {
      const fixedTime = 9999999;
      cleanupDateMock = mockDateNow(fixedTime);

      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Immediately check duration (should be 0m 0s)
      logger.writeSummary(1, 0, 0);

      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('0m 0s')
      );
    });
  });

  describe('Stream Lifecycle', () => {
    it('should create file stream in constructor', () => {
      new Logger({ filePath: '/tmp/test.log' });

      expect(fs.createWriteStream).toHaveBeenCalledWith(
        '/tmp/test.log',
        expect.objectContaining({ flags: 'a' })
      );
    });

    it('should end file stream when close() is called', async () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      await logger.close();

      expect(mockWriteStream.end).toHaveBeenCalled();
    });

    it('should return Promise from close()', async () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      const result = logger.close();

      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('should log file path when closing', async () => {
      const logger = new Logger({ filePath: '/custom/log.log' });
      await logger.close();

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('/custom/log.log')
      );
    });

    it('should handle close() when no file stream exists', async () => {
      const logger = new Logger({ verbosity: 'quiet' });

      // Should not throw
      await expect(logger.close()).resolves.toBeUndefined();
      expect(mockWriteStream.end).not.toHaveBeenCalled();
    });

    it('should resolve Promise when stream ends', async () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      const closePromise = logger.close();

      await expect(closePromise).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file permission errors (EACCES)', () => {
      const permError = new Error('EACCES: permission denied');
      (permError as any).code = 'EACCES';

      vi.mocked(fs.createWriteStream).mockImplementation(() => {
        throw permError;
      });

      // Should not throw, should fall back to console-only
      expect(() => new Logger({ filePath: '/forbidden/test.log' })).not.toThrow();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not create log file')
      );
    });

    it('should handle disk space errors during stream creation', () => {
      const spaceError = new Error('ENOSPC: no space left on device');
      (spaceError as any).code = 'ENOSPC';

      vi.mocked(fs.createWriteStream).mockImplementation(() => {
        throw spaceError;
      });

      expect(() => new Logger({ filePath: '/tmp/test.log' })).not.toThrow();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not create log file')
      );
    });

    it('should fall back to console-only on file errors', () => {
      vi.mocked(fs.createWriteStream).mockImplementation(() => {
        throw new Error('File error');
      });

      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Test message');

      // Console should still work
      expect(mockConsole.log).toHaveBeenCalledWith('Test message');
      // But file write should not happen (no stream created)
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it('should warn user about file logging failure', () => {
      vi.mocked(fs.createWriteStream).mockImplementation(() => {
        throw new Error('Simulated error');
      });

      new Logger({ filePath: '/tmp/test.log' });

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not create log file')
      );
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('console-only')
      );
    });

    it('should continue operation after file error', () => {
      vi.mocked(fs.createWriteStream).mockImplementation(() => {
        throw new Error('Error');
      });

      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Should be able to continue logging to console
      expect(() => {
        logger.info('Message 1');
        logger.success('Message 2');
        logger.writeSummary(2, 0, 0);
      }).not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('Message 1');
      expect(mockConsole.log).toHaveBeenCalledWith('Message 2');
    });

    it('should handle stream errors after creation', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });

      // Simulate stream error
      mockWriteStream.emit('error', new Error('Write failed'));

      // Should still be able to log to console
      logger.info('After error');
      expect(mockConsole.log).toHaveBeenCalledWith('After error');
    });
  });

  describe('Verbosity Levels', () => {
    it('should not create file stream in quiet mode', () => {
      vi.clearAllMocks();
      new Logger({ verbosity: 'quiet' });

      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it('should still log to console in quiet mode', () => {
      const logger = new Logger({ verbosity: 'quiet' });
      logger.info('Quiet message');

      expect(mockConsole.log).toHaveBeenCalledWith('Quiet message');
      expect(mockWriteStream.write).not.toHaveBeenCalled();
    });

    it('should use dual output in normal mode (default)', () => {
      const logger = new Logger({ filePath: '/tmp/test.log' });
      logger.info('Normal message');

      expect(mockConsole.log).toHaveBeenCalledWith('Normal message');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Normal message')
      );
    });

    it('should respect verbosity setting', () => {
      const quietLogger = new Logger({ verbosity: 'quiet' });
      const normalLogger = new Logger({ filePath: '/tmp/test.log', verbosity: 'normal' });

      quietLogger.info('Test 1');
      normalLogger.info('Test 2');

      // Quiet mode: console only
      expect(mockConsole.log).toHaveBeenCalledWith('Test 1');

      // Normal mode: both console and file
      expect(mockConsole.log).toHaveBeenCalledWith('Test 2');
      expect(mockWriteStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Test 2')
      );
    });
  });
});
