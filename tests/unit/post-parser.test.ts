import { describe, it, expect } from 'vitest';
import { PostParser } from '../../src/processors/post-parser';
import { HashnodePost } from '../../src/types/hashnode-schema';

describe('PostParser', () => {
  // Helper function to create a valid HashnodePost
  const createValidPost = (overrides?: Partial<HashnodePost>): HashnodePost => ({
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
    ...overrides,
  });

  describe('A. Successful Parsing', () => {
    it('should successfully parse a complete post with all fields', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({
        coverImage: 'https://example.com/image.png',
      });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result).toEqual({
        title: 'Test Post',
        slug: 'test-post',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test brief',
        contentMarkdown: '# Test Content',
        coverImage: 'https://example.com/image.png',
      });
    });

    it('should successfully parse a post without coverImage (optional field)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete post.coverImage;

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result).toEqual({
        title: 'Test Post',
        slug: 'test-post',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: 'Test brief',
        contentMarkdown: '# Test Content',
        coverImage: undefined,
      });
    });

    it('should successfully parse a post with minimal required fields only', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({
        brief: '',
      });
      delete post.coverImage;

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result).toEqual({
        title: 'Test Post',
        slug: 'test-post',
        dateAdded: '2024-01-15T10:00:00.000Z',
        brief: '',
        contentMarkdown: '# Test Content',
        coverImage: undefined,
      });
    });
  });

  describe('B. Required Field Validation - Missing Fields', () => {
    it('should throw error when post is null', () => {
      // Arrange
      const parser = new PostParser();

      // Act & Assert
      expect(() => parser.parse(null as unknown as HashnodePost)).toThrow(
        'Cannot parse: post is null or undefined'
      );
    });

    it('should throw error when post is undefined', () => {
      // Arrange
      const parser = new PostParser();

      // Act & Assert
      expect(() => parser.parse(undefined as unknown as HashnodePost)).toThrow(
        'Cannot parse: post is null or undefined'
      );
    });

    it('should throw error when title is missing (undefined)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete (post as unknown as Record<string, unknown>).title;

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Missing required field: title');
    });

    it('should throw error when slug is missing (undefined)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete (post as unknown as Record<string, unknown>).slug;

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Missing required field: slug');
    });

    it('should throw error when dateAdded is missing (undefined)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete (post as unknown as Record<string, unknown>).dateAdded;

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Missing required field: dateAdded');
    });

    it('should throw error when contentMarkdown is missing (undefined)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete (post as unknown as Record<string, unknown>).contentMarkdown;

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Missing required field: contentMarkdown');
    });
  });

  describe('C. Required Field Validation - Empty Fields', () => {
    it('should throw error when title is empty string', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ title: '' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: title cannot be empty');
    });

    it('should throw error when slug is empty string', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ slug: '' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: slug cannot be empty');
    });

    it('should throw error when dateAdded is empty string', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: dateAdded cannot be empty');
    });

    it('should throw error when contentMarkdown is empty string', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ contentMarkdown: '' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: contentMarkdown cannot be empty');
    });
  });

  describe('D. Required Field Validation - Whitespace Fields', () => {
    it('should throw error when title is only whitespace', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ title: '   ' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: title cannot be empty');
    });

    it('should throw error when slug is only whitespace', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ slug: '   ' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: slug cannot be empty');
    });

    it('should throw error when dateAdded is only whitespace', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '   ' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: dateAdded cannot be empty');
    });

    it('should throw error when contentMarkdown is only whitespace', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ contentMarkdown: '   ' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow('Invalid field: contentMarkdown cannot be empty');
    });
  });

  describe('E. Date Validation', () => {
    it('should accept valid ISO 8601 date with milliseconds', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '2024-01-15T10:00:00.000Z' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.dateAdded).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should accept valid ISO 8601 date without milliseconds', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '2024-01-15T10:00:00Z' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.dateAdded).toBe('2024-01-15T10:00:00Z');
    });

    it('should throw error for non-ISO date format (e.g., "Jan 15, 2024")', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: 'Jan 15, 2024' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow(
        'Invalid field: dateAdded must be a valid ISO 8601 date string'
      );
    });

    it('should throw error for incomplete ISO date (missing time)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '2024-01-15' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow(
        'Invalid field: dateAdded must be a valid ISO 8601 date string'
      );
    });

    it('should throw error for invalid date format (arbitrary string)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: 'not a date' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow(
        'Invalid field: dateAdded must be a valid ISO 8601 date string'
      );
    });

    it('should throw error for date without timezone indicator', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '2024-01-15T10:00:00' });

      // Act & Assert
      expect(() => parser.parse(post)).toThrow(
        'Invalid field: dateAdded must be a valid ISO 8601 date string'
      );
    });
  });

  describe('F. Optional Field Handling - coverImage', () => {
    it('should return undefined when coverImage is not present', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete post.coverImage;

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBeUndefined();
    });

    it('should return undefined when coverImage is undefined', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ coverImage: undefined });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBeUndefined();
    });

    it('should return undefined when coverImage is null', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ coverImage: null as unknown as string });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBeUndefined();
    });

    it('should return undefined when coverImage is empty string', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ coverImage: '' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBeUndefined();
    });

    it('should return undefined when coverImage is only whitespace', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ coverImage: '   ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBeUndefined();
    });

    it('should return trimmed URL when coverImage is valid', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ coverImage: '  https://example.com/image.png  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.coverImage).toBe('https://example.com/image.png');
    });
  });

  describe('G. Field Transformation - Whitespace Trimming', () => {
    it('should trim leading whitespace from title', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ title: '  My Title' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.title).toBe('My Title');
    });

    it('should trim trailing whitespace from title', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ title: 'My Title  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.title).toBe('My Title');
    });

    it('should trim whitespace from slug', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ slug: '  my-slug  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.slug).toBe('my-slug');
    });

    it('should trim whitespace from dateAdded', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ dateAdded: '  2024-01-15T10:00:00.000Z  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.dateAdded).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should trim whitespace from brief', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ brief: '  My brief  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.brief).toBe('My brief');
    });

    it('should trim whitespace from contentMarkdown', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ contentMarkdown: '  # My Content  ' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.contentMarkdown).toBe('# My Content');
    });
  });

  describe('H. Brief Field Special Handling', () => {
    it('should use empty string default when brief is undefined', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost();
      delete (post as unknown as Record<string, unknown>).brief;

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.brief).toBe('');
    });

    it('should use empty string default when brief is null', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ brief: null as unknown as string });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.brief).toBe('');
    });

    it('should accept empty string for brief (valid case)', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({ brief: '' });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.brief).toBe('');
    });
  });

  describe('I. Edge Cases', () => {
    it('should handle very long contentMarkdown (10,000+ characters)', () => {
      // Arrange
      const parser = new PostParser();
      const longContent = 'a'.repeat(10000);
      const post = createValidPost({ contentMarkdown: longContent });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.contentMarkdown).toBe(longContent);
      expect(result.contentMarkdown.length).toBe(10000);
    });

    it('should handle special characters in all string fields', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({
        title: 'Title with @#$%^&*() special chars',
        slug: 'slug-with-special-chars-123',
        brief: 'Brief with "quotes" and \'apostrophes\'',
        contentMarkdown: '# Content with <tags> & entities',
      });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.title).toBe('Title with @#$%^&*() special chars');
      expect(result.slug).toBe('slug-with-special-chars-123');
      expect(result.brief).toBe('Brief with "quotes" and \'apostrophes\'');
      expect(result.contentMarkdown).toBe('# Content with <tags> & entities');
    });

    it('should handle Unicode characters in title and content', () => {
      // Arrange
      const parser = new PostParser();
      const post = createValidPost({
        title: 'Title with émojis 🎉 and 中文字符',
        contentMarkdown: '# Content with Ünïcödë and 日本語',
      });

      // Act
      const result = parser.parse(post);

      // Assert
      expect(result.title).toBe('Title with émojis 🎉 and 中文字符');
      expect(result.contentMarkdown).toBe('# Content with Ünïcödë and 日本語');
    });
  });
});
