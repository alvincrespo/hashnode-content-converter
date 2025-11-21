import { describe, it, expect } from 'vitest';
import { FrontmatterGenerator } from '../../src/processors/frontmatter-generator';
import { PostMetadata } from '../../src/types/hashnode-schema';

describe('FrontmatterGenerator', () => {
  const generator = new FrontmatterGenerator();

  it('should generate basic frontmatter with required fields', () => {
    const metadata: PostMetadata = {
      title: 'My Post Title',
      slug: 'my-post-slug',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'A brief description',
      contentMarkdown: 'Content',
    };

    const result = generator.generate(metadata);

    expect(result).toContain('---');
    expect(result).toContain('title: "My Post Title"');
    expect(result).toContain('slug: "my-post-slug"');
    expect(result).toContain('date: 2023-01-01T12:00:00.000Z');
    expect(result).toContain('description: "A brief description"');
  });

  it('should escape quotes in strings', () => {
    const metadata: PostMetadata = {
      title: 'Post with "Quotes"',
      slug: 'post-with-quotes',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'Description with "quotes"',
      contentMarkdown: 'Content',
    };

    const result = generator.generate(metadata);

    expect(result).toContain('title: "Post with \\"Quotes\\""');
    expect(result).toContain('description: "Description with \\"quotes\\""');
  });

  it('should handle optional coverImage', () => {
    const metadata: PostMetadata = {
      title: 'Post',
      slug: 'post',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'Brief',
      contentMarkdown: 'Content',
      coverImage: 'https://example.com/image.png',
    };

    const result = generator.generate(metadata);

    expect(result).toContain('coverImage: "https://example.com/image.png"');
  });

  it('should handle tags', () => {
    const metadata: PostMetadata = {
      title: 'Post',
      slug: 'post',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'Brief',
      contentMarkdown: 'Content',
      tags: ['tag1', 'tag2', 'tag with spaces'],
    };

    const result = generator.generate(metadata);

    expect(result).toContain('tags:');
    expect(result).toContain('  - "tag1"');
    expect(result).toContain('  - "tag2"');
    expect(result).toContain('  - "tag with spaces"');
  });

  it('should escape quotes in tags', () => {
    const metadata: PostMetadata = {
      title: 'Post',
      slug: 'post',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'Brief',
      contentMarkdown: 'Content',
      tags: ['tag "one"'],
    };

    const result = generator.generate(metadata);

    expect(result).toContain('  - "tag \\"one\\""');
  });

  it('should format date correctly', () => {
    const metadata: PostMetadata = {
      title: 'Post',
      slug: 'post',
      dateAdded: '2023-01-01T12:00:00.000Z',
      brief: 'Brief',
      contentMarkdown: 'Content',
    };

    const result = generator.generate(metadata);

    expect(result).toContain('date: 2023-01-01T12:00:00.000Z');
  });

  it('should fallback to original date string if invalid', () => {
    const metadata: PostMetadata = {
      title: 'Post',
      slug: 'post',
      dateAdded: 'invalid-date',
      brief: 'Brief',
      contentMarkdown: 'Content',
    };

    const result = generator.generate(metadata);

    expect(result).toContain('date: invalid-date');
  });
});
