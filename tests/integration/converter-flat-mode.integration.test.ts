import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Converter } from '../../src/converter.js';
import type { HashnodePost } from '../../src/types/hashnode-schema.js';

// ============================================================================
// INTEGRATION TESTS WITH REAL FILE I/O
// ============================================================================
// This file does NOT mock fs - all filesystem operations are real.
// Tests verify the complete end-to-end conversion pipeline for flat output mode.
// ============================================================================

describe('Converter - Flat Output Mode Integration Tests', () => {
  let tempDir: string;
  let exportPath: string;
  let outputDir: string;

  beforeEach(() => {
    // Create unique temp directory for isolation
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashnode-flat-test-'));

    // Setup nested output structure (required for flat mode validation)
    outputDir = path.join(tempDir, 'blog', '_posts');
    fs.mkdirSync(outputDir, { recursive: true });

    // Export path (will be created per-test with specific data)
    exportPath = path.join(tempDir, 'export.json');
  });

  afterEach(() => {
    // Cleanup temp directory (force: true ensures cleanup even on test failure)
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should write posts as {slug}.md in flat mode', async () => {
    // Arrange - Create Converter with flat mode config
    const flatConverter = new Converter({
      config: {
        outputStructure: { mode: 'flat' },
      },
    });

    const exportData = {
      posts: [
        {
          _id: 'test001',
          id: 'test001',
          cuid: 'test001',
          slug: 'test-post-1',
          title: 'Test Post 1',
          contentMarkdown: '# Heading\n\nContent here.',
          content: '<h1>Heading</h1><p>Content here.</p>',
          dateAdded: '2024-01-15T10:00:00.000Z',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          brief: 'Test brief',
          views: 0,
          author: 'Test Author',
          tags: [],
          isActive: true,
        },
        {
          _id: 'test002',
          id: 'test002',
          cuid: 'test002',
          slug: 'test-post-2',
          title: 'Test Post 2',
          contentMarkdown: '# Another Post',
          content: '<h1>Another Post</h1>',
          dateAdded: '2024-01-16T10:00:00.000Z',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          brief: 'Another brief',
          views: 0,
          author: 'Test Author',
          tags: [],
          isActive: true,
        },
      ] as HashnodePost[],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    const result = await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Result stats
    expect(result.converted).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Assert - File structure (flat mode)
    expect(fs.existsSync(path.join(outputDir, 'test-post-1.md'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'test-post-2.md'))).toBe(true);

    // Assert - No nested directories created
    expect(fs.existsSync(path.join(outputDir, 'test-post-1'))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, 'test-post-2'))).toBe(false);

    // Assert - Content format
    const content1 = fs.readFileSync(path.join(outputDir, 'test-post-1.md'), 'utf8');
    expect(content1).toMatch(/^---\n/); // Frontmatter start
    expect(content1).toContain('title:'); // Has title field
    expect(content1).toContain('Test Post 1'); // Title value present
    expect(content1).toContain('# Heading'); // Markdown content present
  });

  it('should place images in sibling _images folder', async () => {
    // Arrange - Create Converter with flat mode config
    const flatConverter = new Converter({
      config: {
        outputStructure: { mode: 'flat' },
      },
    });

    // Note: Using a mock/fake image URL that will fail to download
    // We're testing directory structure, not actual download success
    const exportData = {
      posts: [{
        _id: 'test001',
        id: 'test001',
        cuid: 'test001',
        slug: 'post-with-image',
        title: 'Post With Image',
        contentMarkdown: '![alt text](https://cdn.hashnode.com/res/hashnode/image/upload/v123/test-image-abc123.png)',
        content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v123/test-image-abc123.png" alt="alt text"></p>',
        dateAdded: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        brief: 'Test post with image',
        views: 0,
        author: 'Test Author',
        tags: [],
        isActive: true,
      }] as HashnodePost[],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Image directory structure exists (even if download failed)
    const imageDir = path.join(outputDir, '..', '_images');
    expect(fs.existsSync(imageDir)).toBe(true);

    // Assert - Markers directory exists (created even on failure)
    const markersDir = path.join(imageDir, '.downloaded-markers');
    expect(fs.existsSync(markersDir)).toBe(true);

    // Assert - No post directory created (flat mode)
    const postDir = path.join(outputDir, 'post-with-image');
    expect(fs.existsSync(postDir)).toBe(false);

    // Assert - Post file created
    expect(fs.existsSync(path.join(outputDir, 'post-with-image.md'))).toBe(true);
  });
});
