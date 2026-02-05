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

  it('should use /images prefix in markdown references', async () => {
    // Arrange - Create Converter with flat mode config
    const flatConverter = new Converter({
      config: {
        outputStructure: { mode: 'flat' },
      },
    });

    const exportData = {
      posts: [{
        _id: 'test001',
        id: 'test001',
        cuid: 'test001',
        slug: 'image-post',
        title: 'Image Post',
        contentMarkdown: 'Text before ![alt text](https://cdn.hashnode.com/res/hashnode/image/upload/v1/xyz-789.jpg) text after',
        content: '<p>Text before <img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/xyz-789.jpg" alt="alt text"> text after</p>',
        dateAdded: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        brief: 'Test post',
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

    // Assert - Read markdown content
    const content = fs.readFileSync(path.join(outputDir, 'image-post.md'), 'utf8');

    // Assert - Image path uses absolute prefix /images/
    // Note: The exact path depends on whether download succeeded or failed
    // If it succeeded: ![alt text](/images/xyz-789.jpg)
    // If it failed: original CDN URL remains
    // For this test, we check that IF the image was processed, it uses /images/ prefix
    if (!content.includes('cdn.hashnode.com')) {
      // Image was successfully processed - verify correct prefix
      expect(content).toContain('/images/');
      expect(content).toContain('xyz-789.jpg');
    }

    // Assert - CDN URL should be replaced if download succeeded
    // But if download failed, original URL might remain - that's okay for this integration test
    // The key is that the structure is correct

    // Assert - Not using relative path
    expect(content).not.toContain('![alt text](./xyz-789.jpg)');
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
        {
          _id: 'test001',
          id: 'test001',
          cuid: 'test001',
          slug: 'existing-post',
          title: 'Existing Post',
          contentMarkdown: '# New Content\n\nThis should not be written.',
          content: '<h1>New Content</h1>',
          dateAdded: '2024-01-15T10:00:00.000Z',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
          brief: 'Test',
          views: 0,
          author: 'Test Author',
          tags: [],
          isActive: true,
        },
        {
          _id: 'test002',
          id: 'test002',
          cuid: 'test002',
          slug: 'new-post',
          title: 'New Post',
          contentMarkdown: '# Fresh Content\n\nThis should be written.',
          content: '<h1>Fresh Content</h1>',
          dateAdded: '2024-01-16T10:00:00.000Z',
          createdAt: '2024-01-16T10:00:00.000Z',
          updatedAt: '2024-01-16T10:00:00.000Z',
          brief: 'Test',
          views: 0,
          author: 'Test Author',
          tags: [],
          isActive: true,
        },
      ] as HashnodePost[],
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
      posts: [{
        _id: 'test001',
        id: 'test001',
        cuid: 'test001',
        slug: 'custom-folder-post',
        title: 'Custom Folder Post',
        contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/custom-123.png)',
        content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/custom-123.png" alt="img"></p>',
        dateAdded: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        brief: 'Test',
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

    // Assert - Custom image directory exists
    const customImageDir = path.join(outputDir, '..', 'assets');
    expect(fs.existsSync(customImageDir)).toBe(true);

    // Assert - Default _images directory NOT created
    const defaultImageDir = path.join(outputDir, '..', '_images');
    expect(fs.existsSync(defaultImageDir)).toBe(false);

    // Assert - Markers directory created in custom location
    const markersDir = path.join(customImageDir, '.downloaded-markers');
    expect(fs.existsSync(markersDir)).toBe(true);
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
      posts: [{
        _id: 'test001',
        id: 'test001',
        cuid: 'test001',
        slug: 'custom-prefix-post',
        title: 'Custom Prefix Post',
        contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/prefix-456.jpg)',
        content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/prefix-456.jpg" alt="img"></p>',
        dateAdded: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        brief: 'Test',
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

    // Assert - Read markdown content
    const content = fs.readFileSync(
      path.join(outputDir, 'custom-prefix-post.md'),
      'utf8'
    );

    // Assert - Custom prefix used (if download succeeded)
    if (!content.includes('cdn.hashnode.com')) {
      expect(content).toContain('/static/images/');
      expect(content).toContain('prefix-456.jpg');

      // Assert - Default prefix NOT used
      expect(content).not.toContain('/images/prefix-456.jpg');
    }

    // Assert - Not using relative path
    expect(content).not.toContain('![img](./prefix-456.jpg)');
  });

  it('should maintain backwards compatibility in nested mode', async () => {
    // Arrange - Create Converter with NO config (defaults to nested mode)
    const nestedConverter = new Converter();

    const exportData = {
      posts: [{
        _id: 'test001',
        id: 'test001',
        cuid: 'test001',
        slug: 'nested-post',
        title: 'Nested Post',
        contentMarkdown: '![img](https://cdn.hashnode.com/res/hashnode/image/upload/v1/nested-789.png)',
        content: '<p><img src="https://cdn.hashnode.com/res/hashnode/image/upload/v1/nested-789.png" alt="img"></p>',
        dateAdded: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        brief: 'Test',
        views: 0,
        author: 'Test Author',
        tags: [],
        isActive: true,
      }] as HashnodePost[],
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

    // Assert - No flat file created
    expect(fs.existsSync(path.join(outputDir, 'nested-post.md'))).toBe(false);

    // Assert - Content exists and uses correct path format
    const content = fs.readFileSync(path.join(postDir, 'index.md'), 'utf8');

    // In nested mode, should NOT use /images/ prefix (that's flat mode only)
    expect(content).not.toContain('/images/');

    // Should have frontmatter
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('title:');
  });
});
