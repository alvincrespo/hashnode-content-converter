import { describe, it, expect } from 'vitest';
import { Post, PostValidationError } from '../../../src/models/post.js';

describe('Post', () => {
  describe('constructor', () => {
    it('should create a post with required properties', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\ntitle: Test\n---',
        content: '# Hello',
      });

      expect(post.slug).toBe('my-post');
      expect(post.frontmatter).toBe('---\ntitle: Test\n---');
      expect(post.content).toBe('# Hello');
    });

    it('should default outputMode to nested', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
      });

      expect(post.outputMode).toBe('nested');
    });

    it('should accept flat outputMode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'flat',
      });

      expect(post.outputMode).toBe('flat');
    });

    it('should accept nested outputMode explicitly', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'nested',
      });

      expect(post.outputMode).toBe('nested');
    });
  });

  describe('getFilePath', () => {
    it('should return {slug}/index.md in nested mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'nested',
      });

      const filePath = post.getFilePath('./blog');

      expect(filePath).toBe('blog/my-post/index.md');
    });

    it('should return {slug}.md in flat mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'flat',
      });

      const filePath = post.getFilePath('./blog');

      expect(filePath).toBe('blog/my-post.md');
    });

    it('should handle absolute output directory in nested mode', () => {
      const post = new Post({
        slug: 'test-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'nested',
      });

      const filePath = post.getFilePath('/home/user/blog');

      expect(filePath).toBe('/home/user/blog/test-post/index.md');
    });

    it('should handle absolute output directory in flat mode', () => {
      const post = new Post({
        slug: 'test-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'flat',
      });

      const filePath = post.getFilePath('/home/user/blog');

      expect(filePath).toBe('/home/user/blog/test-post.md');
    });
  });

  describe('getDirectoryPath', () => {
    it('should return outputDir/slug in nested mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'nested',
      });

      const dirPath = post.getDirectoryPath('./blog');

      expect(dirPath).toBe('blog/my-post');
    });

    it('should return outputDir in flat mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'flat',
      });

      const dirPath = post.getDirectoryPath('./blog');

      expect(dirPath).toBe('./blog');
    });
  });

  describe('getMarkdown', () => {
    it('should combine frontmatter and content with newline', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\ntitle: Test\n---',
        content: '# Hello World',
      });

      const markdown = post.getMarkdown();

      expect(markdown).toBe('---\ntitle: Test\n---\n# Hello World');
    });

    it('should handle empty content', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\ntitle: Test\n---',
        content: '',
      });

      const markdown = post.getMarkdown();

      expect(markdown).toBe('---\ntitle: Test\n---\n');
    });

    it('should handle empty frontmatter', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '',
        content: '# Hello',
      });

      const markdown = post.getMarkdown();

      expect(markdown).toBe('\n# Hello');
    });
  });

  describe('getExistencePath', () => {
    it('should return directory path in nested mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'nested',
      });

      const existPath = post.getExistencePath('./blog');

      expect(existPath).toBe('blog/my-post');
    });

    it('should return file path in flat mode', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '',
        outputMode: 'flat',
      });

      const existPath = post.getExistencePath('./blog');

      expect(existPath).toBe('blog/my-post.md');
    });
  });

  describe('slug sanitization', () => {
    it('should trim whitespace from slug', () => {
      const post = new Post({
        slug: '  my-post  ',
        frontmatter: '---\n---',
        content: '',
      });

      expect(post.slug).toBe('my-post');
    });

    it('should replace invalid characters with hyphens', () => {
      const post = new Post({
        slug: 'my:post*with?chars',
        frontmatter: '---\n---',
        content: '',
      });

      expect(post.slug).toBe('my-post-with-chars');
    });

    it('should handle unicode characters', () => {
      const post = new Post({
        slug: '日本語',
        frontmatter: '---\n---',
        content: '',
      });

      expect(post.slug).toBe('日本語');
    });

    it('should throw PostValidationError for absolute paths', () => {
      expect(() => {
        new Post({
          slug: '/etc/passwd',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow(PostValidationError);

      expect(() => {
        new Post({
          slug: '/etc/passwd',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow('absolute paths are not allowed');
    });

    it('should throw PostValidationError for parent directory traversal', () => {
      expect(() => {
        new Post({
          slug: '../etc/passwd',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow(PostValidationError);

      expect(() => {
        new Post({
          slug: '../etc/passwd',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow('parent directory traversal is not allowed');
    });

    it('should throw PostValidationError for empty slug after sanitization', () => {
      expect(() => {
        new Post({
          slug: '   ',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow(PostValidationError);

      expect(() => {
        new Post({
          slug: '   ',
          frontmatter: '---\n---',
          content: '',
        });
      }).toThrow('empty after sanitization');
    });

    it('should include original slug in error', () => {
      try {
        new Post({
          slug: '/invalid/path',
          frontmatter: '---\n---',
          content: '',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PostValidationError);
        expect((error as PostValidationError).slug).toBe('/invalid/path');
      }
    });
  });

  describe('immutability', () => {
    it('should have readonly properties', () => {
      const post = new Post({
        slug: 'my-post',
        frontmatter: '---\n---',
        content: '# Hello',
        outputMode: 'flat',
      });

      // TypeScript enforces readonly, but verify values don't change
      expect(post.slug).toBe('my-post');
      expect(post.frontmatter).toBe('---\n---');
      expect(post.content).toBe('# Hello');
      expect(post.outputMode).toBe('flat');
    });
  });
});
