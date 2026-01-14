import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWriter, FileWriteError } from '../../src/services/file-writer.js';
import { Post, PostValidationError } from '../../src/models/post.js';

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
        ).rejects.toThrow(new PostValidationError('Invalid slug: parent directory traversal is not allowed (../etc/passwd)', '../etc/passwd'));
      });

      it('should reject absolute paths', async () => {
        await expect(
          fileWriter.writePost('./blog', '/etc/passwd', '---\n', 'content')
        ).rejects.toThrow(new PostValidationError('Invalid slug: absolute paths are not allowed (/etc/passwd)', '/etc/passwd'));
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
        ).rejects.toThrow(new PostValidationError('Invalid slug: slug is empty after sanitization (original:    )', '   '));
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

  describe('Post Existence Check', () => {
    describe('nested mode (default)', () => {
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

      it('should check for directory, not file, in nested mode', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        fileWriter.postExists('./blog', 'my-post');

        // Should NOT have .md extension in nested mode
        const calledPath = vi.mocked(fs.existsSync).mock.calls[0][0] as string;
        expect(calledPath).not.toContain('.md');
        expect(calledPath).toContain('my-post');
      });
    });

    describe('flat mode', () => {
      let flatWriter: FileWriter;

      beforeEach(() => {
        flatWriter = new FileWriter({ outputMode: 'flat' });
      });

      it('should return true when {slug}.md file exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const result = flatWriter.postExists('./blog', 'test-post');

        expect(result).toBe(true);
        expect(fs.existsSync).toHaveBeenCalledWith(
          expect.stringMatching(/test-post\.md$/)
        );
      });

      it('should return false when {slug}.md file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = flatWriter.postExists('./blog', 'non-existent');

        expect(result).toBe(false);
      });

      it('should check for {slug}.md file, not directory', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        flatWriter.postExists('./blog', 'my-post');

        // Verify it checks for .md file
        expect(fs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('my-post.md')
        );
      });

      it('should return false on invalid slug (graceful error handling)', () => {
        // Invalid slug triggers sanitization error
        const result = flatWriter.postExists('./blog', '/invalid/slug');

        expect(result).toBe(false);
      });
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

  describe('outputMode Configuration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    it('should default outputMode to nested when not provided', async () => {
      const writer = new FileWriter();
      const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
      // Verify nested behavior (creates {slug}/index.md)
      expect(result).toContain('my-post/index.md');
    });

    it('should accept nested outputMode explicitly', async () => {
      const writer = new FileWriter({ outputMode: 'nested' });
      const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
      expect(result).toContain('my-post/index.md');
    });

    it('should accept flat outputMode', () => {
      // For now, just verify the config is accepted without error
      // Actual flat behavior will be tested in Step 2.3
      const writer = new FileWriter({ outputMode: 'flat' });
      expect(writer).toBeInstanceOf(FileWriter);
    });

    it('should use default values when config is undefined', async () => {
      const writer = new FileWriter(undefined);
      const result = await writer.writePost('./blog', 'my-post', '---\n', 'content');
      expect(result).toContain('my-post/index.md');
    });
  });

  describe('writePost - flat mode', () => {
    let flatWriter: FileWriter;

    beforeEach(() => {
      vi.clearAllMocks();
      flatWriter = new FileWriter({ outputMode: 'flat' });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    describe('file path behavior', () => {
      it('should write {slug}.md directly in output directory', async () => {
        const result = await flatWriter.writePost('./blog', 'my-post', '---\n', 'content');

        expect(result).toContain('my-post.md');
        expect(result).not.toContain('my-post/index.md');
      });

      it('should NOT create subdirectory in flat mode', async () => {
        await flatWriter.writePost('./blog', 'my-post', '---\n', 'content');

        // mkdir should NOT be called with post subdirectory path
        const mkdirCalls = vi.mocked(fs.promises.mkdir).mock.calls;
        for (const call of mkdirCalls) {
          expect(call[0]).not.toContain('my-post');
        }
      });

      it('should return absolute path ending with {slug}.md', async () => {
        const result = await flatWriter.writePost('./blog', 'test-post', '---\n', 'content');

        expect(result).toMatch(/test-post\.md$/);
        expect(result).toMatch(/^\/.*test-post\.md$/);
      });
    });

    describe('directory creation', () => {
      it('should create output directory if it does not exist', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await flatWriter.writePost('./blog', 'my-post', '---\n', 'content');

        expect(fs.promises.mkdir).toHaveBeenCalledWith('./blog', { recursive: true });
      });

      it('should not call mkdir when output directory already exists', async () => {
        // First call for directory check returns true (exists)
        // Second call for file existence check returns false (file doesn't exist)
        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(true)  // outputDir exists
          .mockReturnValueOnce(false); // file doesn't exist

        await flatWriter.writePost('./blog', 'my-post', '---\n', 'content');

        expect(fs.promises.mkdir).not.toHaveBeenCalled();
      });

      it('should throw FileWriteError on mkdir failure', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('EACCES: permission denied'));

        await expect(
          flatWriter.writePost('./blog', 'my-post', '---\n', 'content')
        ).rejects.toThrow(FileWriteError);

        await expect(
          flatWriter.writePost('./blog', 'my-post', '---\n', 'content')
        ).rejects.toMatchObject({
          operation: 'create_dir',
          path: './blog'
        });
      });
    });

    describe('overwrite behavior', () => {
      it('should throw error if {slug}.md exists and overwrite is false', async () => {
        // outputDir exists, file exists
        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(true)  // outputDir exists (skip mkdir)
          .mockReturnValueOnce(true); // file exists (trigger overwrite error)

        await expect(
          flatWriter.writePost('./blog', 'existing-post', '---\n', 'content')
        ).rejects.toThrow('already exists and overwrite is disabled');
      });

      it('should throw FileWriteError when file exists in flat mode', async () => {
        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(true)  // outputDir exists
          .mockReturnValueOnce(true); // file exists

        await expect(
          flatWriter.writePost('./blog', 'existing-post', '---\n', 'content')
        ).rejects.toThrow(FileWriteError);
      });

      it('should overwrite {slug}.md when overwrite is true', async () => {
        const overwriteFlatWriter = new FileWriter({ outputMode: 'flat', overwrite: true });
        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(true)  // outputDir exists
          .mockReturnValueOnce(true); // file exists

        await expect(
          overwriteFlatWriter.writePost('./blog', 'existing-post', '---\n', 'new content')
        ).resolves.toBeDefined();

        expect(fs.promises.writeFile).toHaveBeenCalled();
      });
    });

    describe('atomic writes', () => {
      it('should use atomic writes for flat mode files', async () => {
        await flatWriter.writePost('./blog', 'atomic-post', '---\n', 'content');

        // Should write to .tmp file first
        expect(fs.promises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('atomic-post.md.tmp'),
          expect.any(String),
          'utf8'
        );

        // Should rename to final location
        expect(fs.promises.rename).toHaveBeenCalledWith(
          expect.stringContaining('atomic-post.md.tmp'),
          expect.stringContaining('atomic-post.md')
        );
      });

      it('should use direct writes when atomicWrites is false in flat mode', async () => {
        const directFlatWriter = new FileWriter({ outputMode: 'flat', atomicWrites: false });

        await directFlatWriter.writePost('./blog', 'direct-post', '---\n', 'content');

        // Should NOT use rename (direct write)
        expect(fs.promises.rename).not.toHaveBeenCalled();
        expect(fs.promises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('direct-post.md'),
          expect.any(String),
          'utf8'
        );
      });
    });
  });

  describe('write() method with Post model', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
    });

    describe('nested mode', () => {
      it('should write post using Post model path resolution', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'my-post',
          frontmatter: '---\ntitle: Test\n---',
          content: '# Hello',
          outputMode: 'nested',
        });

        const result = await writer.write(post, './blog');

        expect(result).toContain('my-post/index.md');
        expect(fs.promises.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('my-post'),
          { recursive: true }
        );
      });

      it('should use Post.getMarkdown() for content', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'test-post',
          frontmatter: '---\ntitle: Test\n---',
          content: '# Content',
          outputMode: 'nested',
        });

        await writer.write(post, './blog');

        expect(fs.promises.writeFile).toHaveBeenCalledWith(
          expect.any(String),
          '---\ntitle: Test\n---\n# Content',
          'utf8'
        );
      });
    });

    describe('flat mode', () => {
      it('should write {slug}.md in flat mode', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'flat-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'flat',
        });

        const result = await writer.write(post, './blog');

        expect(result).toContain('flat-post.md');
        expect(result).not.toContain('index.md');
      });

      it('should create only output directory in flat mode', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'flat-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'flat',
        });

        await writer.write(post, './blog');

        // Should create ./blog, not ./blog/flat-post
        expect(fs.promises.mkdir).toHaveBeenCalledWith('./blog', { recursive: true });
      });
    });

    describe('overwrite behavior', () => {
      it('should throw error when file exists and overwrite is false', async () => {
        const writer = new FileWriter({ overwrite: false });
        const post = new Post({
          slug: 'existing-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'nested',
        });

        // First call: directory check (not exists)
        // Second call: file exists check (exists)
        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true);

        await expect(writer.write(post, './blog')).rejects.toThrow(
          'already exists and overwrite is disabled'
        );
      });

      it('should overwrite when overwrite is true', async () => {
        const writer = new FileWriter({ overwrite: true });
        const post = new Post({
          slug: 'existing-post',
          frontmatter: '---\n---',
          content: 'new content',
          outputMode: 'nested',
        });

        vi.mocked(fs.existsSync)
          .mockReturnValueOnce(true)  // directory exists
          .mockReturnValueOnce(true); // file exists

        await expect(writer.write(post, './blog')).resolves.toBeDefined();
        expect(fs.promises.writeFile).toHaveBeenCalled();
      });
    });

    describe('directory creation', () => {
      it('should skip mkdir if directory already exists', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'my-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'nested',
        });

        // ensureDirectory checks if dir exists (true = skip mkdir)
        // write() checks if file exists for overwrite (false = don't throw)
        vi.mocked(fs.existsSync)
          .mockImplementation((p: fs.PathLike) => {
            const pathStr = p.toString();
            // Directory exists, file doesn't
            if (pathStr.includes('index.md')) {
              return false;
            }
            return true; // directory exists
          });

        await writer.write(post, './blog');

        expect(fs.promises.mkdir).not.toHaveBeenCalled();
      });

      it('should throw FileWriteError on mkdir failure', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'my-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'nested',
        });

        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('Permission denied'));

        await expect(writer.write(post, './blog')).rejects.toThrow(FileWriteError);
        await expect(writer.write(post, './blog')).rejects.toThrow('Failed to create directory');
      });
    });

    describe('atomic writes', () => {
      it('should use atomic writes by default', async () => {
        const writer = new FileWriter();
        const post = new Post({
          slug: 'atomic-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'nested',
        });

        await writer.write(post, './blog');

        expect(fs.promises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.tmp'),
          expect.any(String),
          'utf8'
        );
        expect(fs.promises.rename).toHaveBeenCalled();
      });

      it('should use direct writes when atomicWrites is false', async () => {
        const writer = new FileWriter({ atomicWrites: false });
        const post = new Post({
          slug: 'direct-post',
          frontmatter: '---\n---',
          content: '',
          outputMode: 'nested',
        });

        await writer.write(post, './blog');

        expect(fs.promises.rename).not.toHaveBeenCalled();
        expect(fs.promises.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('index.md'),
          expect.any(String),
          'utf8'
        );
      });
    });
  });
});
