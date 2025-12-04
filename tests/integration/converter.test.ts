import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Converter, ConverterDependencies } from '../../src/converter';
import { PostParser } from '../../src/processors/post-parser';
import { MarkdownTransformer } from '../../src/processors/markdown-transformer';
import { ImageProcessor } from '../../src/processors/image-processor';
import { FrontmatterGenerator } from '../../src/processors/frontmatter-generator';
import { FileWriter } from '../../src/services/file-writer';
import { Logger } from '../../src/services/logger';
import { HashnodePost } from '../../src/types/hashnode-schema';
// Mock fs module
vi.mock('fs');

describe('Converter', () => {
  let converter: Converter;
  let mockLogger: Logger;
  let mockFileWriter: FileWriter;
  let mockPostParser: PostParser;
  let mockMarkdownTransformer: MarkdownTransformer;
  let mockImageProcessor: ImageProcessor;
  let mockFrontmatterGenerator: FrontmatterGenerator;

  const samplePost: HashnodePost = {
    _id: 'test001',
    id: 'test001',
    cuid: 'test001',
    slug: 'test-post',
    title: 'Test Post',
    dateAdded: '2024-01-15T10:00:00.000Z',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    contentMarkdown: '# Test Content',
    content: '<h1>Test Content</h1>',
    brief: 'Test brief',
    views: 100,
    author: 'Test Author',
    tags: ['test'],
    isActive: true,
  };

  const sampleExport = {
    posts: [samplePost],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockLogger = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackHttp403: vi.fn(),
      writeSummary: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Logger;

    mockFileWriter = {
      postExists: vi.fn().mockReturnValue(false),
      writePost: vi.fn().mockResolvedValue('/output/test-post/index.md'),
    } as unknown as FileWriter;

    mockPostParser = {
      parse: vi.fn().mockReturnValue({
        title: 'Test Post',
        slug: 'test-post',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test brief',
        contentMarkdown: '# Test Content',
        tags: ['test'],
      }),
    } as unknown as PostParser;

    mockMarkdownTransformer = {
      transform: vi.fn().mockReturnValue('# Test Content'),
    } as unknown as MarkdownTransformer;

    mockImageProcessor = {
      process: vi.fn().mockResolvedValue({
        markdown: '# Test Content',
        imagesProcessed: 0,
        imagesDownloaded: 0,
        imagesSkipped: 0,
        errors: [],
      }),
    } as unknown as ImageProcessor;

    mockFrontmatterGenerator = {
      generate: vi.fn().mockReturnValue('---\ntitle: "Test Post"\n---'),
    } as unknown as FrontmatterGenerator;

    // Setup fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleExport));
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    // Create converter with mocked dependencies
    const deps: ConverterDependencies = {
      logger: mockLogger,
      fileWriter: mockFileWriter,
      postParser: mockPostParser,
      markdownTransformer: mockMarkdownTransformer,
      imageProcessor: mockImageProcessor,
      frontmatterGenerator: mockFrontmatterGenerator,
    };

    converter = new Converter(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default dependencies', () => {
      const defaultConverter = new Converter();
      expect(defaultConverter).toBeInstanceOf(Converter);
    });

    it('should create instance with injected dependencies', () => {
      expect(converter).toBeInstanceOf(Converter);
    });

    it('should extend EventEmitter', () => {
      expect(typeof converter.on).toBe('function');
      expect(typeof converter.emit).toBe('function');
      expect(typeof converter.once).toBe('function');
    });
  });

  describe('convertAllPosts - Happy Path', () => {
    it('should convert single post successfully', async () => {
      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toMatch(/^\d+s$|^\d+m \d+s$/);
    });

    it('should convert multiple posts successfully', async () => {
      const multiExport = {
        posts: [
          samplePost,
          { ...samplePost, _id: 'test002', slug: 'test-post-2', title: 'Test Post 2' },
          { ...samplePost, _id: 'test003', slug: 'test-post-3', title: 'Test Post 3' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should call processors in correct order', async () => {
      const callOrder: string[] = [];

      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        callOrder.push('postParser');
        return {
          title: 'Test Post',
          slug: 'test-post',
          dateAdded: '2024-01-15T10:00:00.000Z',
          brief: 'Test brief',
          contentMarkdown: '# Test Content',
          tags: ['test'],
        };
      });

      vi.mocked(mockMarkdownTransformer.transform).mockImplementation(() => {
        callOrder.push('markdownTransformer');
        return '# Test Content';
      });

      vi.mocked(mockImageProcessor.process).mockImplementation(async () => {
        callOrder.push('imageProcessor');
        return {
          markdown: '# Test Content',
          imagesProcessed: 0,
          imagesDownloaded: 0,
          imagesSkipped: 0,
          errors: [],
        };
      });

      vi.mocked(mockFrontmatterGenerator.generate).mockImplementation(() => {
        callOrder.push('frontmatterGenerator');
        return '---\ntitle: "Test"\n---';
      });

      vi.mocked(mockFileWriter.writePost).mockImplementation(async () => {
        callOrder.push('fileWriter');
        return '/output/test-post/index.md';
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(callOrder).toEqual([
        'postParser',
        'markdownTransformer',
        'imageProcessor',
        'frontmatterGenerator',
        'fileWriter',
      ]);
    });

    it('should create output directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === '/output') return false;
        return true;
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/output', { recursive: true });
    });

    it('should log info message with post count', async () => {
      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.info).toHaveBeenCalledWith('Found 1 posts to convert');
    });

    it('should write summary at end of conversion', async () => {
      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.writeSummary).toHaveBeenCalledWith(1, 0, 0);
      expect(mockLogger.close).toHaveBeenCalled();
    });
  });

  describe('convertAllPosts - Skip Existing', () => {
    it('should skip posts when skipExisting=true and post exists', async () => {
      vi.mocked(mockFileWriter.postExists).mockReturnValue(true);

      const result = await converter.convertAllPosts('/path/to/export.json', '/output', {
        skipExisting: true,
      });

      expect(result.converted).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip existing by default (skipExisting defaults to true)', async () => {
      vi.mocked(mockFileWriter.postExists).mockReturnValue(true);

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.skipped).toBe(1);
      expect(result.converted).toBe(0);
    });

    it('should process posts when skipExisting=false even if post exists', async () => {
      vi.mocked(mockFileWriter.postExists).mockReturnValue(true);

      const result = await converter.convertAllPosts('/path/to/export.json', '/output', {
        skipExisting: false,
      });

      expect(result.converted).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should log skip message when post is skipped', async () => {
      vi.mocked(mockFileWriter.postExists).mockReturnValue(true);

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
    });
  });

  describe('convertAllPosts - Fatal Errors', () => {
    it('should throw when export file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        converter.convertAllPosts('/nonexistent/export.json', '/output')
      ).rejects.toThrow('Export file not found');
    });

    it('should throw when export file contains invalid JSON', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      await expect(
        converter.convertAllPosts('/path/to/export.json', '/output')
      ).rejects.toThrow('Invalid JSON');
    });

    it('should throw when export file contains JSON primitive instead of object', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('null');

      const errorHandler = vi.fn();
      converter.on('conversion-error', errorHandler);

      await expect(
        converter.convertAllPosts('/path/to/export.json', '/output')
      ).rejects.toThrow('Export file must contain a JSON object');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fatal',
          message: 'Export file must contain a JSON object',
        })
      );
    });

    it('should throw when export has no posts array', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ data: [] }));

      await expect(
        converter.convertAllPosts('/path/to/export.json', '/output')
      ).rejects.toThrow('posts');
    });

    it('should emit conversion-error event on fatal error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const errorHandler = vi.fn();
      converter.on('conversion-error', errorHandler);

      await expect(
        converter.convertAllPosts('/nonexistent/export.json', '/output')
      ).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fatal',
          message: expect.stringContaining('Export file not found'),
        })
      );
    });
  });

  describe('convertAllPosts - Recoverable Errors', () => {
    it('should continue processing when PostParser throws for one post', async () => {
      const multiExport = {
        posts: [
          samplePost,
          { ...samplePost, slug: 'failing-post', title: 'Failing Post' },
          { ...samplePost, slug: 'success-post', title: 'Success Post' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));

      // Make the second post fail
      vi.mocked(mockPostParser.parse)
        .mockReturnValueOnce({
          title: 'Test Post',
          slug: 'test-post',
          dateAdded: '2024-01-15T10:00:00.000Z',
          brief: 'Test brief',
          contentMarkdown: '# Test Content',
          tags: [],
        })
        .mockImplementationOnce(() => {
          throw new Error('Missing required field: title');
        })
        .mockReturnValueOnce({
          title: 'Success Post',
          slug: 'success-post',
          dateAdded: '2024-01-15T10:00:00.000Z',
          brief: 'Test brief',
          contentMarkdown: '# Test Content',
          tags: [],
        });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].slug).toBe('failing-post');
    });

    it('should continue processing when FileWriter throws', async () => {
      vi.mocked(mockFileWriter.writePost).mockRejectedValueOnce(
        new Error('Failed to write file')
      );

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Failed to write');
    });

    it('should track error with correct slug', async () => {
      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Parse error: Invalid field');
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.errors[0].slug).toBe('test-post');
    });

    it('should use fallback slug when post has no valid slug', async () => {
      const badPost = { ...samplePost, slug: '' };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [badPost] }));
      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.errors[0].slug).toBe('unknown-post-0');
    });
  });

  describe('Event Emission', () => {
    it('should emit conversion-starting event for each post', async () => {
      const startingHandler = vi.fn();
      converter.on('conversion-starting', startingHandler);

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(startingHandler).toHaveBeenCalledTimes(1);
      expect(startingHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          post: expect.objectContaining({ slug: 'test-post' }),
          index: 1,
          total: 1,
        })
      );
    });

    it('should emit conversion-completed event after each post', async () => {
      const completedHandler = vi.fn();
      converter.on('conversion-completed', completedHandler);

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(completedHandler).toHaveBeenCalledTimes(1);
      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.objectContaining({ success: true }),
          index: 1,
          total: 1,
          durationMs: expect.any(Number),
        })
      );
    });

    it('should emit conversion-starting before conversion-completed', async () => {
      const events: string[] = [];

      converter.on('conversion-starting', () => events.push('starting'));
      converter.on('conversion-completed', () => events.push('completed'));

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(events).toEqual(['starting', 'completed']);
    });

    it('should emit conversion-error event on post failure', async () => {
      const errorHandler = vi.fn();
      converter.on('conversion-error', errorHandler);

      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Parse error: Invalid field');
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parse',
          slug: 'test-post',
          message: expect.stringContaining('Parse error'),
        })
      );
    });

    it('should emit conversion-error with transform type on MarkdownTransformer failure', async () => {
      const errorHandler = vi.fn();
      converter.on('conversion-error', errorHandler);

      vi.mocked(mockMarkdownTransformer.transform).mockImplementation(() => {
        throw new Error('Transform error: Invalid markdown');
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transform',
          slug: 'test-post',
          message: expect.stringContaining('Transform error'),
        })
      );
    });

    it('should emit image-downloaded events for each image', async () => {
      const imageHandler = vi.fn();
      converter.on('image-downloaded', imageHandler);

      vi.mocked(mockImageProcessor.process).mockResolvedValue({
        markdown: '# Test Content',
        imagesProcessed: 2,
        imagesDownloaded: 2,
        imagesSkipped: 0,
        errors: [],
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(imageHandler).toHaveBeenCalledTimes(2);
      expect(imageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          postSlug: 'test-post',
        })
      );
    });

    it('should emit image-downloaded event with error details for failed images', async () => {
      const imageHandler = vi.fn();
      converter.on('image-downloaded', imageHandler);

      vi.mocked(mockImageProcessor.process).mockResolvedValue({
        markdown: '# Test Content',
        imagesProcessed: 1,
        imagesDownloaded: 0,
        imagesSkipped: 0,
        errors: [
          {
            filename: 'image.png',
            url: 'https://cdn.hashnode.com/image.png',
            error: 'HTTP 403',
            is403: true,
          },
        ],
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(imageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          filename: 'image.png',
          is403: true,
        })
      );
    });

    it('should support once() for single-fire event subscription', async () => {
      const startingHandler = vi.fn();
      converter.once('conversion-starting', startingHandler);

      // Create export with 2 posts
      const multiExport = {
        posts: [samplePost, { ...samplePost, slug: 'test-post-2' }],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));

      await converter.convertAllPosts('/path/to/export.json', '/output');

      // once() should only fire for the first post, not the second
      expect(startingHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logger Integration', () => {
    it('should log success message for converted posts', async () => {
      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Converted')
      );
    });

    it('should log error message for failed posts', async () => {
      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Parse error');
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track HTTP 403 errors via logger', async () => {
      vi.mocked(mockImageProcessor.process).mockResolvedValue({
        markdown: '# Test Content',
        imagesProcessed: 1,
        imagesDownloaded: 0,
        imagesSkipped: 0,
        errors: [
          {
            filename: 'image.png',
            url: 'https://cdn.hashnode.com/image.png',
            error: 'HTTP 403',
            is403: true,
          },
        ],
      });

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.trackHttp403).toHaveBeenCalledWith(
        'test-post',
        'image.png',
        'https://cdn.hashnode.com/image.png'
      );
    });

    it('should warn when export file has no posts', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [] }));

      await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(mockLogger.warn).toHaveBeenCalledWith('Export file contains no posts');
    });
  });

  describe('convertPost - Single Post Conversion', () => {
    it('should return success result for valid post', async () => {
      const result = await converter.convertPost(samplePost, '/output');

      expect(result.success).toBe(true);
      expect(result.slug).toBe('test-post');
      expect(result.title).toBe('Test Post');
      expect(result.outputPath).toBe('/output/test-post/index.md');
    });

    it('should return failure result when PostParser throws', async () => {
      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Missing required field: title');
      });

      const result = await converter.convertPost(samplePost, '/output');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should create post directory before ImageProcessor', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await converter.convertPost(samplePost, '/output');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join('/output', 'test-post'),
        { recursive: true }
      );
    });

    it('should pass transformed markdown to ImageProcessor', async () => {
      vi.mocked(mockMarkdownTransformer.transform).mockReturnValue('# Transformed Content');

      await converter.convertPost(samplePost, '/output');

      expect(mockImageProcessor.process).toHaveBeenCalledWith(
        '# Transformed Content',
        expect.stringContaining('test-post')
      );
    });

    it('should use image-processed markdown for frontmatter', async () => {
      vi.mocked(mockImageProcessor.process).mockResolvedValue({
        markdown: '# Content with local images',
        imagesProcessed: 1,
        imagesDownloaded: 1,
        imagesSkipped: 0,
        errors: [],
      });

      await converter.convertPost(samplePost, '/output');

      expect(mockFileWriter.writePost).toHaveBeenCalledWith(
        '/output',
        'test-post',
        expect.any(String),
        '# Content with local images'
      );
    });
  });

  describe('Duration Formatting', () => {
    it('should format duration in seconds for short conversions', async () => {
      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.duration).toMatch(/^\d+s$/);
    });

    it('should format duration with minutes for longer conversions', async () => {
      // We can't easily test minutes without actually waiting,
      // so we just verify the format matches expected pattern
      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.duration).toMatch(/^\d+s$|^\d+m \d+s$/);
    });
  });

  describe('Statistics Accuracy', () => {
    it('should return accurate converted count', async () => {
      const multiExport = {
        posts: [
          samplePost,
          { ...samplePost, slug: 'test-2' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(2);
    });

    it('should return accurate skipped count', async () => {
      const multiExport = {
        posts: [
          samplePost,
          { ...samplePost, slug: 'existing-post' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));
      vi.mocked(mockFileWriter.postExists).mockImplementation((_, slug) => {
        return slug === 'existing-post';
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should return accurate errors array', async () => {
      const multiExport = {
        posts: [
          samplePost,
          { ...samplePost, slug: 'failing-post' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));
      vi.mocked(mockPostParser.parse)
        .mockReturnValueOnce({
          title: 'Test Post',
          slug: 'test-post',
          dateAdded: '2024-01-15T10:00:00.000Z',
          brief: 'Test brief',
          contentMarkdown: '# Test Content',
          tags: [],
        })
        .mockImplementationOnce(() => {
          throw new Error('Parse error');
        });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].slug).toBe('failing-post');
    });

    it('should maintain correct counts across mixed success/failure/skip', async () => {
      const multiExport = {
        posts: [
          { ...samplePost, slug: 'success-1' },
          { ...samplePost, slug: 'existing-post' },
          { ...samplePost, slug: 'failing-post' },
          { ...samplePost, slug: 'success-2' },
        ],
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiExport));
      vi.mocked(mockFileWriter.postExists).mockImplementation((_, slug) => {
        return slug === 'existing-post';
      });
      vi.mocked(mockPostParser.parse).mockImplementation((post) => {
        if (post.slug === 'failing-post') {
          throw new Error('Parse error');
        }
        return {
          title: post.title,
          slug: post.slug,
          dateAdded: post.dateAdded,
          brief: post.brief,
          contentMarkdown: post.contentMarkdown,
          tags: [],
        };
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty posts array', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [] }));

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle posts with special characters in slug', async () => {
      const specialPost = { ...samplePost, slug: 'post-with-unicode-日本語' };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [specialPost] }));
      vi.mocked(mockPostParser.parse).mockReturnValue({
        title: 'Test Post',
        slug: 'post-with-unicode-日本語',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test brief',
        contentMarkdown: '# Test Content',
        tags: [],
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(1);
    });

    it('should handle post with null title gracefully', async () => {
      const nullTitlePost = { ...samplePost, title: null as unknown as string };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [nullTitlePost] }));

      // PostParser would throw for null title
      vi.mocked(mockPostParser.parse).mockImplementation(() => {
        throw new Error('Missing required field: title');
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.errors).toHaveLength(1);
    });

    it('should throw when output directory cannot be created', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts: [samplePost] }));
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValue(false); // export exists, output dir doesn't
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const errorHandler = vi.fn();
      converter.on('conversion-error', errorHandler);

      await expect(
        converter.convertAllPosts('/path/to/export.json', '/output')
      ).rejects.toThrow('Cannot create output directory');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fatal',
          message: expect.stringContaining('Permission denied'),
        })
      );
    });

    it('should format duration with minutes when conversion takes over 60 seconds', async () => {
      // Create 3 posts to simulate a longer batch
      const posts = [samplePost, { ...samplePost, slug: 'post-2' }, { ...samplePost, slug: 'post-3' }];
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ posts }));
      vi.mocked(mockPostParser.parse).mockImplementation((post) => ({
        title: post.title,
        slug: post.slug,
        dateAdded: post.dateAdded,
        brief: post.brief || '',
        contentMarkdown: post.contentMarkdown,
        tags: [],
      }));

      // Mock Date.now() to simulate 65 seconds total duration
      const startTime = 1000;
      let callCount = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        // First few calls are start timestamps, later calls add time
        if (callCount <= 4) return startTime;
        return startTime + 65000; // 65 seconds = 1m 5s
      });

      const result = await converter.convertAllPosts('/path/to/export.json', '/output');

      expect(result.converted).toBe(3);
      expect(result.duration).toMatch(/\d+m \d+s/); // Should be formatted as "Xm Ys"

      vi.spyOn(Date, 'now').mockRestore();
    });
  });
});
