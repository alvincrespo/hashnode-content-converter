import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWriter, FileWriteError } from '../../src/services/file-writer';

// Mock fs and path modules
vi.mock('fs');
vi.mock('fs/promises');

import * as fs from 'fs';

describe('FileWriter', () => {
  let fileWriter: FileWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    fileWriter = new FileWriter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Path Validation', () => {
    describe('sanitizeSlug (via writePost)', () => {
      beforeEach(() => {
        // Setup default mocks for successful write
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      });

      it('should accept valid slugs with alphanumeric and hyphens', async () => {
        const result = await fileWriter.writePost('./blog', 'my-blog-post', '---\n', 'content');
        expect(result).toContain('my-blog-post');
      });

      it('should accept valid slugs with numbers', async () => {
        const result = await fileWriter.writePost('./blog', 'post-123', '---\n', 'content');
        expect(result).toContain('post-123');
      });

      it('should reject parent directory traversal', async () => {
        await expect(
          fileWriter.writePost('./blog', '../etc/passwd', '---\n', 'content')
        ).rejects.toThrow(FileWriteError);

        await expect(
          fileWriter.writePost('./blog', '../etc/passwd', '---\n', 'content')
        ).rejects.toThrow('parent directory traversal is not allowed');
      });

      it('should reject absolute paths', async () => {
        await expect(
          fileWriter.writePost('./blog', '/etc/passwd', '---\n', 'content')
        ).rejects.toThrow(FileWriteError);

        await expect(
          fileWriter.writePost('./blog', '/etc/passwd', '---\n', 'content')
        ).rejects.toThrow('absolute paths are not allowed');
      });

      it('should sanitize special characters by replacing with hyphens', async () => {
        const result = await fileWriter.writePost('./blog', 'my:post*with?chars', '---\n', 'content');
        // Should convert to 'my-post-with-chars'
        expect(result).toContain('my-post-with-chars');
      });

      it('should handle Unicode characters correctly', async () => {
        const result = await fileWriter.writePost('./blog', '日本語', '---\n', 'content');
        expect(result).toContain('日本語');
      });

      it('should reject empty slugs after sanitization', async () => {
        // Slug with only whitespace becomes empty after trim
        await expect(
          fileWriter.writePost('./blog', '   ', '---\n', 'content')
        ).rejects.toThrow(FileWriteError);

        await expect(
          fileWriter.writePost('./blog', '   ', '---\n', 'content')
        ).rejects.toThrow('empty after sanitization');
      });
    });
  });

  describe('Directory Creation', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    it('should create directory if it does not exist', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await fileWriter.writePost('./blog', 'my-post', '---\n', 'content');

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('my-post'),
        { recursive: true }
      );
    });

    it('should not fail if directory already exists (recursive:true)', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await expect(
        fileWriter.writePost('./blog', 'existing-post', '---\n', 'content')
      ).resolves.toBeDefined();

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('existing-post'),
        { recursive: true }
      );
    });

    it('should create nested directories recursively', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      await fileWriter.writePost('./blog/nested/path', 'my-post', '---\n', 'content');

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('nested/path/my-post'),
        { recursive: true }
      );
    });

    it('should throw FileWriteError on permission denied', async () => {
      const permissionError = new Error('EACCES: permission denied');
      vi.mocked(fs.promises.mkdir).mockRejectedValue(permissionError);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toThrow('Failed to create directory');
    });
  });
});
