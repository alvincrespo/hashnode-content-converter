import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as https from 'https';
import { EventEmitter } from 'events';
import { ImageDownloader } from '../../src/services/image-downloader';

// Mock modules
vi.mock('https');
vi.mock('fs');

// Helper to create a mock HTTP response object (IncomingMessage)
function createMockResponse(statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers,
    pipe: vi.fn(),
    on: vi.fn(),
  } as any;
}

// Helper to create a mock file stream object (WriteStream)
// Uses EventEmitter so emit() actually triggers listeners
function createMockFileStream() {
  const emitter = new EventEmitter();
  return {
    emit: (event: string, ...args: any[]) => emitter.emit(event, ...args),
    on: (event: string, listener: any) => emitter.on(event, listener),
    close: vi.fn(),
    destroy: vi.fn(),
  } as any;
}

// Helper to create a mock ClientRequest
function createMockClientRequest() {
  return {
    on: vi.fn(),
    destroy: vi.fn(),
  } as any;
}

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
      // Arrange
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
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

      // Act
      await downloader.download(url, filepath);

      // Assert
      expect(fs.createWriteStream).toHaveBeenCalledWith(filepath);
    });

    it('should throw error on download failure', async () => {
      // Arrange
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

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('Network error');
    });

    it('should handle HTTP 403 errors without retry', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
        const mockResponse = createMockResponse(403);
        callback!(mockResponse);
        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('HTTP 403');
    });

    it('should handle HTTP 404 errors without retry', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
        const mockResponse = createMockResponse(404);
        callback!(mockResponse);
        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('HTTP 404');
    });

    it('should follow 301 redirects', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const redirectUrl = 'https://cdn.example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((urlArg, _options, callback) => {
        if (urlArg === url) {
          const mockResponse = createMockResponse(301, { location: redirectUrl });
          callback!(mockResponse);
        } else if (urlArg === redirectUrl) {
          const successResponse = createMockResponse(200);
          successResponse.pipe = vi.fn((dest) => {
            setTimeout(() => {
              mockFileStream.emit('finish');
            }, 10);
            return dest;
          });

          callback!(successResponse);
        }

        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      // Act
      await downloader.download(url, filepath);

      // Assert
      expect(https.get).toHaveBeenCalledWith(expect.stringContaining('example.com'), expect.any(Object), expect.any(Function));
    });

    it('should follow 302 redirects', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const redirectUrl = 'https://cdn.example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((urlArg, _options, callback) => {
        if (urlArg === url) {
          const mockResponse = createMockResponse(302, { location: redirectUrl });
          callback!(mockResponse);
        } else if (urlArg === redirectUrl) {
          const successResponse = createMockResponse(200);
          successResponse.pipe = vi.fn((dest) => {
            setTimeout(() => {
              mockFileStream.emit('finish');
            }, 10);
            return dest;
          });

          callback!(successResponse);
        }

        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);

      // Act
      await downloader.download(url, filepath);

      // Assert
      expect(https.get).toHaveBeenCalled();
    });

    it('should create parent directory if it does not exist', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/subdir/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
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

      // Act
      await downloader.download(url, filepath);

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('subdir'), {
        recursive: true,
      });
    });

    it('should timeout if download takes too long', async () => {
      // Arrange
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

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('Download timeout');
    });

    it('should clean up partial file on write error', async () => {
      // Arrange
      const url = 'https://example.com/image.png';
      const filepath = '/tmp/image.png';
      const mockFileStream = createMockFileStream();

      vi.mocked(https.get).mockImplementation((_urlArg, _options, callback) => {
        const mockResponse = createMockResponse(200);
        mockResponse.pipe = vi.fn(() => {
          setTimeout(() => {
            mockFileStream.emit('error', new Error('Write failed'));
          }, 10);
          return mockFileStream;
        });

        callback!(mockResponse);

        return createMockClientRequest();
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.createWriteStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('File write error');
      expect(fs.unlinkSync).toHaveBeenCalledWith(filepath);
    });
  });

  describe('applyRateLimit()', () => {
    it('should apply rate limiting delay when configured', async () => {
      // Arrange
      const downloader = new ImageDownloader({ downloadDelayMs: 100 });
      const startTime = Date.now();

      // Act
      await downloader.applyRateLimit();
      const elapsed = Date.now() - startTime;

      // Assert
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should not delay when downloadDelayMs is 0', async () => {
      // Arrange
      const downloader = new ImageDownloader({ downloadDelayMs: 0 });
      const startTime = Date.now();

      // Act
      await downloader.applyRateLimit();
      const elapsed = Date.now() - startTime;

      // Assert
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('extractHash()', () => {
    it('should extract hash from valid Hashnode CDN URL', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.png';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.png');
    });

    it('should extract hash with jpg extension', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.jpg';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.jpg');
    });

    it('should extract hash with jpeg extension', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.jpeg';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.jpeg');
    });

    it('should extract hash with gif extension', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.gif';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.gif');
    });

    it('should extract hash with webp extension', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.webp';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.webp');
    });

    it('should return null for invalid URL without hash', () => {
      // Arrange
      const url = 'https://example.com/image.png';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBeNull();
    });

    it('should return null for malformed UUID', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/not-a-valid-uuid.png';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBeNull();
    });

    it('should return null for URL without extension', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBeNull();
    });

    it('should handle case-insensitive extension matching', () => {
      // Arrange
      const url =
        'https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.PNG';

      // Act
      const hash = ImageDownloader.extractHash(url);

      // Assert
      expect(hash).toBe('550e8400-e29b-41d4-a716-446655440000.PNG');
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      // Arrange
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

      // Act
      await downloader.download(url, filepath);

      // Assert
      expect(attemptCount).toBe(2);
    });

    it('should give up after max retries', async () => {
      // Arrange
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

      // Act & Assert
      await expect(downloader.download(url, filepath)).rejects.toThrow('after 2 attempts');
    });
  });
});
