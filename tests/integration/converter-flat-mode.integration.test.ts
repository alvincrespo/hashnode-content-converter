import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Converter } from '../../src/converter.js';
import { ImageDownloader } from '../../src/services/image-downloader.js';
import type { HashnodePost } from '../../src/types/hashnode-schema.js';

// ============================================================================
// INTEGRATION TESTS WITH REAL FILE I/O
// ============================================================================
// This file does NOT mock fs - all filesystem operations are real.
// Tests verify the complete end-to-end conversion pipeline for flat output mode.
//
// ImageDownloader.download is mocked at the network boundary to avoid real
// HTTPS calls. All other pipeline behavior (directory creation, marker files,
// path rewriting, file writing) uses real code paths.
// ============================================================================

/**
 * Create a test fixture for HashnodePost with sensible defaults.
 * This reduces duplication and improves type safety across tests.
 *
 * @param overrides - Partial HashnodePost object to override defaults
 * @returns Complete HashnodePost object for testing
 */
function createTestPost(overrides: Partial<HashnodePost> = {}): HashnodePost {
  return {
    _id: 'test001',
    id: 'test001',
    cuid: 'test001',
    slug: 'test-post',
    title: 'Test Post',
    contentMarkdown: '# Test Content',
    content: '<h1>Test Content</h1>',
    dateAdded: '2024-01-15T10:00:00.000Z',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    brief: 'Test brief',
    views: 0,
    author: 'Test Author',
    tags: [],
    isActive: true,
    ...overrides,
  };
}

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

    // Mock network layer to avoid real HTTPS downloads while keeping
    // all other pipeline behavior (directory creation, markers, path rewriting) real
    vi.spyOn(ImageDownloader.prototype, 'download').mockImplementation(
      async (_url: string, filepath: string) => {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filepath, Buffer.from('fake-image-data'));
        return { success: true };
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();

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
        createTestPost({
          _id: 'test001',
          slug: 'test-post-1',
          title: 'Test Post 1',
          contentMarkdown: '# Heading\n\nContent here.',
          content: '<h1>Heading</h1><p>Content here.</p>',
          brief: 'Test brief',
          dateAdded: '2024-01-15T10:00:00.000Z',
        }),
        createTestPost({
          _id: 'test002',
          slug: 'test-post-2',
          title: 'Test Post 2',
          contentMarkdown: '# Another Post',
          content: '<h1>Another Post</h1>',
          brief: 'Another brief',
          dateAdded: '2024-01-16T10:00:00.000Z',
        }),
      ],
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

    const exportData = {
      posts: [
        createTestPost({
          slug: 'post-with-image',
          title: 'Post With Image',
          contentMarkdown: '![alt text](https://cdn.hashnode.com/res/hashnode/image/upload/v123/550e8400-e29b-41d4-a716-446655440000.png)',
          content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v123/550e8400-e29b-41d4-a716-446655440000.png" alt="alt text"></p>',
          brief: 'Test post with image',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Image directory structure
    const imageDir = path.join(outputDir, '..', '_images');
    expect(fs.existsSync(imageDir)).toBe(true);

    // Assert - Image file was downloaded
    const imageFile = path.join(imageDir, '550e8400-e29b-41d4-a716-446655440000.png');
    expect(fs.existsSync(imageFile)).toBe(true);

    // Assert - Marker file created for successful download
    const markersDir = path.join(imageDir, '.downloaded-markers');
    expect(fs.existsSync(markersDir)).toBe(true);
    expect(fs.existsSync(path.join(markersDir, '550e8400-e29b-41d4-a716-446655440000.png.marker'))).toBe(true);

    // Assert - No post directory created (flat mode)
    const postDir = path.join(outputDir, 'post-with-image');
    expect(fs.existsSync(postDir)).toBe(false);

    // Assert - Post file created with rewritten image path
    const postFile = path.join(outputDir, 'post-with-image.md');
    expect(fs.existsSync(postFile)).toBe(true);
    const content = fs.readFileSync(postFile, 'utf8');
    expect(content).toContain('![alt text](/images/550e8400-e29b-41d4-a716-446655440000.png)');
  });

  it('should use /images prefix in markdown references', async () => {
    // Arrange - Create Converter with flat mode config
    const flatConverter = new Converter({
      config: {
        outputStructure: { mode: 'flat' },
      },
    });

    const exportData = {
      posts: [
        createTestPost({
          slug: 'image-post',
          title: 'Image Post',
          contentMarkdown: 'Text before ![alt text](https://cdn.hashnode.com/res/hashnode/image/upload/v1/660e8400-e29b-41d4-a716-446655440001.jpg) text after',
          content: '<p>Text before <img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/660e8400-e29b-41d4-a716-446655440001.jpg" alt="alt text"> text after</p>',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Read markdown content
    const content = fs.readFileSync(path.join(outputDir, 'image-post.md'), 'utf8');

    // Assert - Flat mode rewrites image URLs with /images/ prefix
    expect(content).toContain('![alt text](/images/660e8400-e29b-41d4-a716-446655440001.jpg)');

    // Assert - Does NOT use relative paths (that's nested mode)
    expect(content).not.toContain('![alt text](./660e8400-e29b-41d4-a716-446655440001.jpg)');

    // Assert - Surrounding text preserved
    expect(content).toContain('Text before');
    expect(content).toContain('text after');
  });

  it('should skip existing {slug}.md files when skipExisting is true', async () => {
    // Arrange - Create Converter with flat mode config
    const flatConverter = new Converter({
      config: {
        outputStructure: { mode: 'flat' },
      },
    });

    const exportData = {
      posts: [
        createTestPost({
          _id: 'test001',
          slug: 'existing-post',
          title: 'Existing Post',
          contentMarkdown: '# New Content\n\nThis should not be written.',
          content: '<h1>New Content</h1>',
        }),
        createTestPost({
          _id: 'test002',
          slug: 'new-post',
          title: 'New Post',
          contentMarkdown: '# Fresh Content\n\nThis should be written.',
          content: '<h1>Fresh Content</h1>',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Pre-create existing post file
    const existingContent = '---\ntitle: "Old Version"\n---\n\n# Old Content';
    fs.writeFileSync(path.join(outputDir, 'existing-post.md'), existingContent);

    // Act
    const result = await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: true,
    });

    // Assert - Stats
    expect(result.converted).toBe(1); // Only new-post
    expect(result.skipped).toBe(1); // existing-post

    // Assert - Existing file unchanged
    const existingFileContent = fs.readFileSync(
      path.join(outputDir, 'existing-post.md'),
      'utf8'
    );
    expect(existingFileContent).toBe(existingContent);
    expect(existingFileContent).toContain('Old Version');
    expect(existingFileContent).not.toContain('New Content');

    // Assert - New file created
    expect(fs.existsSync(path.join(outputDir, 'new-post.md'))).toBe(true);
    const newFileContent = fs.readFileSync(path.join(outputDir, 'new-post.md'), 'utf8');
    expect(newFileContent).toContain('Fresh Content');
  });

  it('should respect custom imageFolderName', async () => {
    // Arrange - Create Converter with flat mode and custom image folder name
    const flatConverter = new Converter({
      config: {
        outputStructure: {
          mode: 'flat',
          imageFolderName: 'assets', // Custom folder name
        },
      },
    });

    const exportData = {
      posts: [
        createTestPost({
          slug: 'custom-folder-post',
          title: 'Custom Folder Post',
          contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/770e8400-e29b-41d4-a716-446655440002.png)',
          content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/770e8400-e29b-41d4-a716-446655440002.png" alt="img"></p>',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Custom image directory exists with downloaded image
    const customImageDir = path.join(outputDir, '..', 'assets');
    expect(fs.existsSync(customImageDir)).toBe(true);
    expect(fs.existsSync(path.join(customImageDir, '770e8400-e29b-41d4-a716-446655440002.png'))).toBe(true);

    // Assert - Default _images directory NOT created
    const defaultImageDir = path.join(outputDir, '..', '_images');
    expect(fs.existsSync(defaultImageDir)).toBe(false);

    // Assert - Markers directory created in custom location
    const markersDir = path.join(customImageDir, '.downloaded-markers');
    expect(fs.existsSync(markersDir)).toBe(true);
    expect(fs.existsSync(path.join(markersDir, '770e8400-e29b-41d4-a716-446655440002.png.marker'))).toBe(true);

    // Assert - Post file created
    expect(fs.existsSync(path.join(outputDir, 'custom-folder-post.md'))).toBe(true);
  });

  it('should respect custom imagePathPrefix', async () => {
    // Arrange - Create Converter with flat mode and custom image path prefix
    const flatConverter = new Converter({
      config: {
        outputStructure: {
          mode: 'flat',
          imagePathPrefix: '/static/images', // Custom path prefix
        },
      },
    });

    const exportData = {
      posts: [
        createTestPost({
          slug: 'custom-prefix-post',
          title: 'Custom Prefix Post',
          contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/880e8400-e29b-41d4-a716-446655440003.jpg)',
          content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/880e8400-e29b-41d4-a716-446655440003.jpg" alt="img"></p>',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act
    await flatConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Post file created
    expect(fs.existsSync(path.join(outputDir, 'custom-prefix-post.md'))).toBe(true);

    // Assert - Read markdown content
    const content = fs.readFileSync(
      path.join(outputDir, 'custom-prefix-post.md'),
      'utf8'
    );

    // Assert - Custom prefix used in markdown image references
    expect(content).toContain('![img](/static/images/880e8400-e29b-41d4-a716-446655440003.jpg)');

    // Assert - Not using relative path (that's nested mode)
    expect(content).not.toContain('![img](./880e8400-e29b-41d4-a716-446655440003.jpg)');

    // Assert - Image file downloaded to _images directory
    const imageDir = path.join(outputDir, '..', '_images');
    expect(fs.existsSync(imageDir)).toBe(true);
    expect(fs.existsSync(path.join(imageDir, '880e8400-e29b-41d4-a716-446655440003.jpg'))).toBe(true);
  });

  it('should maintain backwards compatibility in nested mode', async () => {
    // Arrange - Create Converter with NO config (defaults to nested mode)
    const nestedConverter = new Converter();

    const exportData = {
      posts: [
        createTestPost({
          slug: 'nested-post',
          title: 'Nested Post',
          contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/990e8400-e29b-41d4-a716-446655440004.png)',
          content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/990e8400-e29b-41d4-a716-446655440004.png" alt="img"></p>',
        }),
      ],
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportData));

    // Act - No outputStructure option (defaults to nested)
    await nestedConverter.convertAllPosts(exportPath, outputDir, {
      skipExisting: false,
    });

    // Assert - Nested directory structure
    const postDir = path.join(outputDir, 'nested-post');
    expect(fs.existsSync(postDir)).toBe(true);
    expect(fs.existsSync(path.join(postDir, 'index.md'))).toBe(true);

    // Assert - Image downloaded into post directory (nested mode)
    expect(fs.existsSync(path.join(postDir, '990e8400-e29b-41d4-a716-446655440004.png'))).toBe(true);

    // Assert - No flat file created
    expect(fs.existsSync(path.join(outputDir, 'nested-post.md'))).toBe(false);

    // Assert - Content should have frontmatter
    const content = fs.readFileSync(path.join(postDir, 'index.md'), 'utf8');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('title:');
    expect(content).toContain('Nested Post');

    // Assert - Uses relative path (nested mode), not absolute /images/ prefix
    expect(content).toContain('![img](./990e8400-e29b-41d4-a716-446655440004.png)');
    expect(content).not.toContain('/images/990e8400-e29b-41d4-a716-446655440004');
  });
});
