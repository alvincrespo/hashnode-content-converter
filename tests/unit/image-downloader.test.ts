import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as https from 'https';
import { ImageDownloader } from '../../src/services/image-downloader';
import {
  createMockResponse,
  createMockFileStream,
  createMockClientRequest,
  createSimpleStatusMock,
  createRedirectMock,
  createSuccessDownloadMock,
  createBadRedirectMock,
  createResponseStreamErrorMock,
} from '../mocks/mocks';

// Mock modules
vi.mock('https');
vi.mock('fs');

describe('ImageDownloader', () => {
  let downloader: ImageDownloader;

  beforeEach(() => {
    downloader = new ImageDownloader();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('download()', () => {
    it('should successfully download a file', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(createSuccessDownloadMock(mockFileStream));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      await downloader.download(url, filepath);
      expect(fs.createWriteStream).toHaveBeenCalledWith(filepath);
    });

    it('should throw error on download failure', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation((_urlArg, _options, _callback) => {
        return {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setTimeout(() => {
                handler(new Error('Network error'));
              }, 10);
            }
          }),
          destroy: vi.fn(),
        } as any;
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(downloader.download(url, filepath)).rejects.toThrow('Network error');
    });

    it('should handle HTTP 403 errors without retry', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation(createSimpleStatusMock(403));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      await expect(downloader.download(url, filepath)).rejects.toThrow('HTTP 403');
    });

    it('should handle HTTP 404 errors without retry', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation(createSimpleStatusMock(404));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      await expect(downloader.download(url, filepath)).rejects.toThrow('HTTP 404');
    });

    it('should follow 301 redirects', async () => {
      const url = 'https://example.com/image.png';
      const redirectUrl = 'https://cdn.example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(createRedirectMock(301, url, redirectUrl, mockFileStream));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      await downloader.download(url, filepath);

      expect(https.get).toHaveBeenCalledWith(expect.stringContaining('example.com'), expect.any(Object), expect.any(Function));
    });

    it('should follow 302 redirects', async () => {
      const url = 'https://example.com/image.png';
      const redirectUrl = 'https://cdn.example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(createRedirectMock(302, url, redirectUrl, mockFileStream));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      await downloader.download(url, filepath);

      expect(https.get).toHaveBeenCalled();
    });

    it('should handle redirect without location header', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation(createBadRedirectMock(301));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      await expect(downloader.download(url, filepath)).rejects.toThrow(
        'Redirect without location header'
      );
    });

    it('should create parent directory if it does not exist', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/subdir/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(createSuccessDownloadMock(mockFileStream));
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      await downloader.download(url, filepath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('subdir'), {
        recursive: true,
      });
    });

    it('should timeout if download takes too long', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const downloader = new ImageDownloader({ timeoutMs: 100 });

      vi.mocked(https.get).mockImplementation((_urlArg, _options, _callback) => {
        return {
          on: vi.fn((event, handler) => {
            if (event === 'timeout') {
              setTimeout(() => {
                handler();
              }, 10);
            }
          }),
          destroy: vi.fn(),
        } as any;
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      await expect(downloader.download(url, filepath)).rejects.toThrow('Download timeout');
    });

    it('should clean up partial file on write error', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(
        createSuccessDownloadMock(mockFileStream, 'error', new Error('Write failed'))
      );
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      await expect(downloader.download(url, filepath)).rejects.toThrow('File write error');
      expect(fs.unlinkSync).toHaveBeenCalledWith(filepath);
    });

    it('should handle response stream error', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation(createResponseStreamErrorMock());
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      await expect(downloader.download(url, filepath)).rejects.toThrow('Stream error');
      expect(fs.unlinkSync).toHaveBeenCalledWith(filepath);
    });
  });

  describe('applyRateLimit()', () => {
    it('should apply rate limiting delay when configured', async () => {
      const delayMs = 100;
      const downloader = new ImageDownloader({ downloadDelayMs: delayMs });
      const startTime = Date.now();

      await downloader.applyRateLimit();
      const elapsed = Date.now() - startTime;

      // Allow 10ms tolerance for timing variance in CI environments
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10);
    });

    it('should not delay when downloadDelayMs is 0', async () => {
      const downloader = new ImageDownloader({ downloadDelayMs: 0 });
      const startTime = Date.now();

      await downloader.applyRateLimit();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('extractHash()', () => {
    it('should extract hash from valid Hashnode CDN URL', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.png';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.png');
    });

    it('should extract hash with jpg extension', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.jpg';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.jpg');
    });

    it('should extract hash with jpeg extension', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.jpeg';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.jpeg');
    });

    it('should extract hash with gif extension', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.gif';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.gif');
    });

    it('should extract hash with webp extension', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.webp';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.webp');
    });

    it('should return null for invalid URL without hash', () => {
      const url = 'https://example.com/image.png';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBeNull();
    });

    it('should return null for malformed UUID', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/not-a-valid-uuid.png';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBeNull();
    });

    it('should return null for URL without extension', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBeNull();
    });

    it('should handle case-insensitive extension matching', () => {
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.PNG';

      const hash = ImageDownloader.extractHash(url);

      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.PNG');
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const downloader = new ImageDownloader({ maxRetries: 2, retryDelayMs: 10 });
      let attemptCount = 0;
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
        attemptCount++;

        if (attemptCount < 2) {
          return {
            on: vi.fn((event, handler) => {
              if (event === 'error') {
                setTimeout(() => {
                  handler(new Error('Temporary connection error'));
                }, 5);
              }
            }),
            destroy: vi.fn(),
          } as any;
        }

        const mockResponse = createMockResponse(200);
        mockResponse.pipe = vi.fn((dest) => {
          setTimeout(() => {
            mockFileStream.emit('finish');
          }, 10);
          return dest;
        });

        callback!(mockResponse);

        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      await downloader.download(url, filepath);

      expect(attemptCount).toBe(2);
    });

    it('should give up after max retries', async () => {
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const downloader = new ImageDownloader({ maxRetries: 1, retryDelayMs: 10 });

      vi.mocked(https.get).mockImplementation((_urlArg, _options, _callback) => {
        return {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              setTimeout(() => {
                handler(new Error('Connection error'));
              }, 5);
            }
          }),
          destroy: vi.fn(),
        } as any;
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      await expect(downloader.download(url, filepath)).rejects.toThrow('after 2 attempts');
    });
  });
});
