import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWriter, FileWriteError } from '../../src/services/file-writer.js';

// Mock fs and path modules
vi.mock('node:fs');
vi.mock('node:fs/promises');

import * as fs from 'node:fs';

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

  describe('File Writing', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    it('should write frontmatter + content correctly', async () => {
      const frontmatter = '---\ntitle: Test\n---';
      const content = '# Hello World';

      await fileWriter.writePost('./blog', 'test-post', frontmatter, content);

      const expectedContent = frontmatter + '\n' + content;
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expectedContent,
        'utf8'
      );
    });

    it('should create index.md in post directory', async () => {
      const result = await fileWriter.writePost('./blog', 'my-post', '---\n', 'content');

      expect(result).toContain('my-post/index.md');
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('my-post/index.md.tmp'),
        expect.any(String),
        'utf8'
      );
    });

    it('should return absolute path to written file', async () => {
      const result = await fileWriter.writePost('./blog', 'my-post', '---\n', 'content');

      expect(result).toMatch(/^\/.*my-post\/index\.md$/);
    });

    it('should respect encoding configuration', async () => {
      const writerWithLatin1 = new FileWriter({ encoding: 'latin1' });
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await writerWithLatin1.writePost('./blog', 'my-post', '---\n', 'content');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String),
        'latin1'
      );
    });

    it('should write empty content (edge case)', async () => {
      const result = await fileWriter.writePost('./blog', 'empty-post', '---\n', '');

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        '---\n\n',
        'utf8'
      );
    });

    it('should handle very large content (stress test)', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of 'x'

      const result = await fileWriter.writePost('./blog', 'large-post', '---\n', largeContent);

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining(largeContent),
        'utf8'
      );
    });
  });

  describe('Atomic Writes', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    });

    it('should write to .tmp file first when atomicWrites is true', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await fileWriter.writePost('./blog', 'atomic-post', '---\n', 'content');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String),
        'utf8'
      );
    });

    it('should rename .tmp to final file after write', async () => {
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

      await fileWriter.writePost('./blog', 'atomic-post', '---\n', 'content');

      expect(fs.promises.rename).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('index.md')
      );
    });

    it('should cleanup .tmp file on write failure', async () => {
      vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('Write failed'));
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await expect(
        fileWriter.writePost('./blog', 'fail-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    it('should use direct write when atomicWrites is false', async () => {
      const directWriter = new FileWriter({ atomicWrites: false });
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await directWriter.writePost('./blog', 'direct-post', '---\n', 'content');

      // Should NOT rename when using direct writes
      expect(fs.promises.rename).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.md'),
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('Overwrite Behavior', () => {
    beforeEach(() => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    it('should throw error if file exists and overwrite is false', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(
        fileWriter.writePost('./blog', 'existing-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      await expect(
        fileWriter.writePost('./blog', 'existing-post', '---\n', 'content')
      ).rejects.toThrow('already exists and overwrite is disabled');
    });

    it('should overwrite file if overwrite is true', async () => {
      const overwriteWriter = new FileWriter({ overwrite: true });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(
        overwriteWriter.writePost('./blog', 'existing-post', '---\n', 'new content')
      ).resolves.toBeDefined();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should create file if it does not exist regardless of overwrite setting', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        fileWriter.writePost('./blog', 'new-post', '---\n', 'content')
      ).resolves.toBeDefined();

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });

  describe('postExists()', () => {
    it('should return true if post directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = fileWriter.postExists('./blog', 'existing-post');

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('existing-post'));
    });

    it('should return false if post directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = fileWriter.postExists('./blog', 'non-existent-post');

      expect(result).toBe(false);
    });

    it('should return false on invalid slug (sanitization fails)', () => {
      const result = fileWriter.postExists('./blog', '/invalid/slug');

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should wrap mkdir errors in FileWriteError', async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toMatchObject({
        operation: 'create_dir',
        cause: expect.objectContaining({ message: 'EACCES: permission denied' })
      });
    });

    it('should wrap write errors in FileWriteError', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('ENOSPC: no space left'));
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toMatchObject({
        operation: 'write_file'
      });
    });

    it('should wrap rename errors in FileWriteError', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockRejectedValue(new Error('rename failed'));
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toThrow(FileWriteError);

      await expect(
        fileWriter.writePost('./blog', 'my-post', '---\n', 'content')
      ).rejects.toMatchObject({
        operation: 'rename_file'
      });
    });

    it('should include path in error message', async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('Failed'));

      try {
        await fileWriter.writePost('./blog', 'my-post', '---\n', 'content');
      } catch (error) {
        expect(error).toBeInstanceOf(FileWriteError);
        expect((error as FileWriteError).path).toContain('my-post');
      }
    });

    it('should chain original error as cause', async () => {
      const originalError = new Error('Original error');
      vi.mocked(fs.promises.mkdir).mockRejectedValue(originalError);

      try {
        await fileWriter.writePost('./blog', 'my-post', '---\n', 'content');
      } catch (error) {
        expect(error).toBeInstanceOf(FileWriteError);
        expect((error as FileWriteError).cause).toBe(originalError);
      }
    });
  });
});
