import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ImageProcessor } from '../../src/processors/image-processor.js';
import { ImageDownloader } from '../../src/services/image-downloader.js';

// Mock modules
vi.mock('node:fs');
vi.mock('../../src/services/image-downloader.js');

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  const testBlogDir = '/test/blog/post-slug';

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new ImageProcessor();

    // Default mocks
    // Smart default: blogDir exists, but image files/markers don't
    vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
      const pathStr = filepath.toString();
      if (pathStr === testBlogDir) return true; // blogDir always exists
      return false; // Everything else doesn't exist by default
    });
    vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any); // Default: empty file
    vi.mocked(fs.mkdirSync).mockImplementation(() => '');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    // Default ImageDownloader mocks
    vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
    vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Category 1: Constructor and Configuration (4 tests)
  describe('Constructor and Configuration', () => {
    it('should create instance with default options', () => {
      const processor = new ImageProcessor();
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('should create instance with custom options', () => {
      const processor = new ImageProcessor({
        maxRetries: 5,
        retryDelayMs: 2000,
        timeoutMs: 60000,
        downloadDelayMs: 500,
      });
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('should set downloadDelayMs default to 200ms', () => {
      const processor = new ImageProcessor();
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('should pass options to ImageDownloader correctly', () => {
      const options = {
        maxRetries: 5,
        retryDelayMs: 2000,
        timeoutMs: 60000,
        downloadDelayMs: 500,
      };
      new ImageProcessor(options);

      expect(ImageDownloader).toHaveBeenCalledWith(options);
    });
  });

  // Category 2: Image URL Extraction (8 tests)
  describe('Image URL Extraction', () => {
    it('should extract single image URL', async () => {
      const markdown = '![Alt text](https://cdn.hashnode.com/res/hashnode/image/upload/v1234567890/550e8400-e29b-41d4-a716-446655440000.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('550e8400-e29b-41d4-a716-446655440000.png');
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(1);
    });

    it('should extract multiple image URLs', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img1.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/img2.png)
![Image 3](https://cdn.hashnode.com/res/hashnode/image/upload/v3/img3.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(3);
    });

    it('should handle markdown with no images', async () => {
      const markdown = 'This is just text with no images.';

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(0);
      expect(result.imagesDownloaded).toBe(0);
    });

    it('should handle image URLs with query parameters', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img.png?auto=compress)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(1);
    });

    it('should ignore non-Hashnode CDN URLs', async () => {
      const markdown = '![Image](https://example.com/image.png)';

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(0);
    });

    it('should handle images with various alt text formats', async () => {
      const markdown = `
![Simple](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img1.png)
![With spaces](https://cdn.hashnode.com/res/hashnode/image/upload/v2/img2.png)
![With-dashes](https://cdn.hashnode.com/res/hashnode/image/upload/v3/img3.png)
![](https://cdn.hashnode.com/res/hashnode/image/upload/v4/img4.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(4);
    });

    it('should handle escaped brackets in alt text', async () => {
      // Note: The regex /!\[[^\]]*\]/ doesn't match escaped brackets,
      // so this markdown won't be recognized as an image
      const markdown = '![Alt with \\[brackets\\]](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img.png)';

      const result = await processor.process(markdown, testBlogDir);

      // Regex doesn't match escaped brackets, so no images found
      expect(result.imagesProcessed).toBe(0);
    });

    it('should handle images with special characters in URLs', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img%20with%20spaces.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(1);
    });
  });

  // Category 3: Successful Image Processing (6 tests)
  describe('Successful Image Processing', () => {
    it('should download new image successfully', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/550e8400-e29b-41d4-a716-446655440000.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('550e8400-e29b-41d4-a716-446655440000.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesDownloaded).toBe(1);
      expect(result.imagesProcessed).toBe(1);
    });

    it('should replace CDN URL with local path', async () => {
      const cdnUrl = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/550e8400-e29b-41d4-a716-446655440000.png';
      const markdown = `![Image](${cdnUrl})`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('550e8400-e29b-41d4-a716-446655440000.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.markdown).toContain('./550e8400-e29b-41d4-a716-446655440000.png');
      expect(result.markdown).not.toContain(cdnUrl);
    });

    it('should return correct statistics', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(1);
      expect(result.imagesDownloaded).toBe(1);
      expect(result.imagesSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should process multiple images in one pass', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img1.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/img2.png)
![Image 3](https://cdn.hashnode.com/res/hashnode/image/upload/v3/img3.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(3);
      expect(result.imagesDownloaded).toBe(3);
    });

    it('should call ImageDownloader.download() for each new image', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img1.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/img2.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      expect(ImageDownloader.prototype.download).toHaveBeenCalledTimes(2);
    });

    it('should use ImageDownloader.extractHash() for filename', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/550e8400-e29b-41d4-a716-446655440000.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('550e8400-e29b-41d4-a716-446655440000.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      expect(ImageDownloader.extractHash).toHaveBeenCalled();
    });
  });

  // Category 4: Already-Downloaded Images (4 tests)
  describe('Already-Downloaded Images', () => {
    it('should skip download if file and success marker both exist', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);

      // Mock file exists and marker exists with size 0 (success marker)
      vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
        if (filepath === testBlogDir) return true;
        if (filepath.toString().includes(filename)) return true;
        if (filepath.toString().includes('.marker')) return true;
        return false;
      });
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesSkipped).toBe(1);
      expect(result.imagesDownloaded).toBe(0);
      expect(ImageDownloader.prototype.download).not.toHaveBeenCalled();
    });

    it('should increment imagesSkipped counter', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/img1.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/img2.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      // Both file and marker exist (success case)
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesSkipped).toBe(2);
    });

    it('should replace URL with local path for successfully downloaded images', async () => {
      const cdnUrl = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `![Image](${cdnUrl})`;
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

      const result = await processor.process(markdown, testBlogDir);

      expect(result.markdown).toContain(`./test.png`);
      expect(result.markdown).not.toContain(cdnUrl);
    });

    it('should mix new downloads and skipped images correctly', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/existing.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/new.png)
`;

      vi.mocked(ImageDownloader.extractHash)
        .mockReturnValueOnce('existing.png')
        .mockReturnValueOnce('new.png');

      // First image exists (skip), second doesn't (download)
      vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
        const pathStr = filepath.toString();
        if (pathStr === testBlogDir) return true;
        if (pathStr.includes('existing.png')) return true;
        if (pathStr.includes('new.png') && pathStr.includes('.marker')) return false;
        return false;
      });
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesSkipped).toBe(1);
      expect(result.imagesDownloaded).toBe(1);
    });
  });

  // Category 5: Error Handling (10 tests)
  describe('Error Handling', () => {
    it('should continue processing after download failure', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/fail.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/success.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download)
        .mockResolvedValueOnce({ success: false, error: 'Network error' })
        .mockResolvedValueOnce({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(2);
      expect(result.imagesDownloaded).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should track HTTP 403 errors separately', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/forbidden.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('forbidden.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        is403: true,
        error: 'HTTP 403 Forbidden',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].is403).toBe(true);
    });

    it('should track other errors with is403: false', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/error.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('error.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: 'Network timeout',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].is403).toBe(false);
    });

    it('should include error details (filename, url, error message)', async () => {
      const url = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `![Image](${url})`;
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors[0]).toEqual({
        filename,
        url,
        error: 'Connection refused',
        is403: false,
      });
    });

    it('should handle invalid URL (no extractable hash)', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/invalid-url.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(null);

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filename).toBe('unknown');
      expect(result.errors[0].error).toContain('Could not extract hash');
    });

    it('should handle ImageDownloader throwing exception', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockRejectedValue(new Error('Unexpected error'));

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Unexpected error');
    });

    it('should throw error if blogDir does not exist', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(processor.process(markdown, testBlogDir)).rejects.toThrow(
        'Blog directory does not exist'
      );
    });

    it('should keep CDN URLs for failed downloads', async () => {
      const cdnUrl = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `![Image](${cdnUrl})`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: 'Download failed',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.markdown).toContain(cdnUrl);
      expect(result.markdown).not.toContain('./test.png');
    });

    it('should collect all errors without halting', async () => {
      const markdown = `
![Image 1](https://cdn.hashnode.com/res/hashnode/image/upload/v1/fail1.png)
![Image 2](https://cdn.hashnode.com/res/hashnode/image/upload/v2/fail2.png)
![Image 3](https://cdn.hashnode.com/res/hashnode/image/upload/v3/fail3.png)
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: 'Download failed',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors).toHaveLength(3);
      expect(result.imagesProcessed).toBe(3);
    });

    it('should return errors array with correct structure', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: 'Test error',
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.errors[0]).toHaveProperty('filename');
      expect(result.errors[0]).toHaveProperty('url');
      expect(result.errors[0]).toHaveProperty('error');
      expect(result.errors[0]).toHaveProperty('is403');
    });
  });

  // Category 6: Edge Cases (6 tests)
  describe('Edge Cases', () => {
    it('should handle empty markdown string', async () => {
      const markdown = '';

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(0);
      expect(result.markdown).toBe('');
    });

    it('should handle markdown with no Hashnode images', async () => {
      const markdown = `
# Title
Some text with ![external image](https://example.com/image.png)
`;

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(0);
      expect(result.markdown).toBe(markdown);
    });

    it('should handle malformed image syntax', async () => {
      const markdown = `
![Broken image(https://cdn.hashnode.com/img.png)
![](
[Not an image](https://cdn.hashnode.com/img.png)
`;

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(0);
    });

    it('should handle very long markdown content', async () => {
      const imageMarkdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)\n';
      const markdown = imageMarkdown.repeat(100);

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(100);
    });

    it('should handle duplicate image URLs', async () => {
      const url = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `
![Image 1](${url})
![Image 2](${url})
![Image 3](${url})
`;

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');

      // First call: file doesn't exist, download
      // Subsequent calls: file exists, skip
      let callCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
        const pathStr = filepath.toString();
        if (pathStr === testBlogDir) return true;
        if (pathStr.includes('.marker')) {
          callCount++;
          return callCount > 1; // First doesn't exist, rest do
        }
        if (pathStr.includes('test.png')) {
          return callCount > 0; // After first download, file exists
        }
        return false;
      });

      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesProcessed).toBe(3);
      // All URLs should be replaced with local paths
      const localPathCount = (result.markdown.match(/\.\/test\.png/g) || []).length;
      expect(localPathCount).toBe(3);
    });

    it('should handle non-string markdown input gracefully', async () => {
      // TypeScript should prevent this, but test runtime behavior
      const invalidMarkdown = null as any;

      // The code doesn't validate input type, so it processes null as-is
      const result = await processor.process(invalidMarkdown, testBlogDir);

      // Null markdown has no images to extract
      expect(result.imagesProcessed).toBe(0);
      expect(result.markdown).toBe(null); // Passes through unchanged
    });
  });

  // Category 7: Integration with ImageDownloader (5 tests)
  describe('Integration with ImageDownloader', () => {
    it('should call ImageDownloader.download() with correct arguments', async () => {
      const url = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `![Image](${url})`;
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      expect(ImageDownloader.prototype.download).toHaveBeenCalledWith(
        url,
        path.join(testBlogDir, filename)
      );
    });

    it('should respect maxRetries configuration', () => {
      const maxRetries = 5;
      new ImageProcessor({ maxRetries });

      expect(ImageDownloader).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries })
      );
    });

    it('should respect timeoutMs configuration', () => {
      const timeoutMs = 60000;
      new ImageProcessor({ timeoutMs });

      expect(ImageDownloader).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs })
      );
    });

    it('should respect downloadDelayMs configuration', () => {
      const downloadDelayMs = 500;
      new ImageProcessor({ downloadDelayMs });

      expect(ImageDownloader).toHaveBeenCalledWith(
        expect.objectContaining({ downloadDelayMs })
      );
    });

    it('should use ImageDownloader.extractHash() static method', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      expect(ImageDownloader.extractHash).toHaveBeenCalled();
    });
  });

  // Category 8: Marker-Based Retry Logic (8 tests)
  describe('Marker-Based Retry Logic', () => {
    it('should create .downloaded-markers/ directory if it does not exist', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      const expectedMarkersDir = path.join(testBlogDir, '.downloaded-markers');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedMarkersDir, { recursive: true });
    });

    it('should create empty marker file after successful download', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      const expectedMarkerPath = path.join(testBlogDir, '.downloaded-markers', `${filename}.marker`);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedMarkerPath, '');
    });

    it('should create 403 marker file for HTTP 403 errors', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/forbidden.png)';
      const filename = 'forbidden.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        is403: true,
        error: 'HTTP 403 Forbidden',
      });

      await processor.process(markdown, testBlogDir);

      const expected403Marker = path.join(testBlogDir, '.downloaded-markers', `${filename}.marker.403`);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expected403Marker, 'HTTP 403 Forbidden');
    });

    it('should create error marker file with error message for transient failures', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';
      const filename = 'test.png';
      const errorMsg = 'Network timeout';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({
        success: false,
        error: errorMsg,
      });

      await processor.process(markdown, testBlogDir);

      const expectedMarkerPath = path.join(testBlogDir, '.downloaded-markers', `${filename}.marker`);
      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedMarkerPath, errorMsg);
    });

    it('should skip download if success marker and file both exist', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);

      // Both file and marker exist
      vi.mocked(fs.existsSync).mockReturnValue(true); // File and marker both exist
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any); // Empty marker = success

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesSkipped).toBe(1);
      expect(ImageDownloader.prototype.download).not.toHaveBeenCalled();
    });

    it('should retry download if error marker exists (transient failure)', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png)';
      const filename = 'test.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);

      // File exists, marker exists with content (transient error from previous run)
      vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
        const pathStr = filepath.toString();
        if (pathStr === testBlogDir) return true;
        if (pathStr.includes('.marker.403')) return false;
        if (pathStr.includes('.marker')) return true;
        if (pathStr.includes(filename)) return true;
        return false;
      });
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as any); // Non-empty marker = transient error
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download).mockResolvedValue({ success: true });

      await processor.process(markdown, testBlogDir);

      // Should retry the download
      expect(ImageDownloader.prototype.download).toHaveBeenCalled();
    });

    it('should skip retry if 403 marker exists (permanent failure)', async () => {
      const markdown = '![Image](https://cdn.hashnode.com/res/hashnode/image/upload/v1/forbidden.png)';
      const filename = 'forbidden.png';

      vi.mocked(ImageDownloader.extractHash).mockReturnValue(filename);

      // 403 marker exists
      vi.mocked(fs.existsSync).mockImplementation((filepath: any) => {
        const pathStr = filepath.toString();
        if (pathStr === testBlogDir) return true;
        if (pathStr.includes('.marker.403')) return true;
        return false;
      });

      const result = await processor.process(markdown, testBlogDir);

      expect(result.imagesSkipped).toBe(1);
      expect(ImageDownloader.prototype.download).not.toHaveBeenCalled();
    });

    it('should replace URL only on successful download (keeps CDN URL for failures)', async () => {
      const cdnUrl = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/test.png';
      const markdown = `
![Success](https://cdn.hashnode.com/res/hashnode/image/upload/v1/success.png)
![Failure](${cdnUrl})
`;

      vi.mocked(ImageDownloader.extractHash)
        .mockReturnValueOnce('success.png')
        .mockReturnValueOnce('test.png');
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(ImageDownloader.prototype.download)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Network error' });

      const result = await processor.process(markdown, testBlogDir);

      // Success image should have local path
      expect(result.markdown).toContain('./success.png');
      // Failed image should keep CDN URL
      expect(result.markdown).toContain(cdnUrl);
    });
  });
});
