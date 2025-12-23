# Flat Output Mode Implementation

## Problem Statement

The current output structure creates a **folder-per-post** layout:

```
output/
├── post-slug-1/
│   ├── index.md
│   └── image.png
├── post-slug-2/
│   ├── index.md
│   └── image.png
```

This structure is incompatible with static site generators like **Bridgetown**, **Jekyll**, and **Hugo** that expect:
- Markdown files named `{slug}.md` directly in a posts folder
- Images in a shared assets directory (e.g., `_images/` or `images/`)
- Absolute paths for image references (e.g., `/images/filename.png`)

Users currently cannot configure the output structure, limiting the package's usefulness for different static site generator conventions.

## Goal

Add a `--flat` CLI flag that enables an alternative **flat output mode**:

```
output/
├── _posts/
│   ├── post-slug-1.md
│   └── post-slug-2.md
└── _images/
    ├── image1.png
    └── image2.png
```

Key requirements:
- **Backwards compatible** - Default behavior remains unchanged (folder-per-post)
- **Configurable** - CLI flags for image folder name and path prefix
- **Framework-agnostic** - Works with Bridgetown, Jekyll, Hugo, Next.js, etc.
- **Testable** - Full test coverage for new code paths

## User Requirements

Based on user feedback:
1. **Image folder location**: Sibling to output directory (e.g., `src/_images` alongside `src/_posts`)
2. **Image path format**: Absolute paths like `/images/filename.png` (Bridgetown convention)
3. **Activation**: New `--flat` CLI flag (opt-in, not default)

## CLI Changes

### New Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-f, --flat` | boolean | `false` | Enable flat output mode |
| `--image-folder <name>` | string | `_images` | Image folder name (flat mode only) |
| `--image-prefix <prefix>` | string | `/images` | Image path prefix in markdown (flat mode only) |

### Example Usage

```bash
# Default (nested) mode - unchanged
npx @alvincrespo/hashnode-content-converter convert \
  --export ./hashnode-articles.json \
  --output ./src/_posts

# Flat mode with defaults
npx @alvincrespo/hashnode-content-converter convert \
  --export ./hashnode-articles.json \
  --output ./src/_posts \
  --flat

# Flat mode with custom paths (for Hugo, etc.)
npx @alvincrespo/hashnode-content-converter convert \
  --export ./hashnode-articles.json \
  --output ./content/posts \
  --flat \
  --image-folder assets \
  --image-prefix /assets
```

### Output Comparison

**Nested Mode (default):**
```
src/
└── _posts/
    └── aws-building-a-vpc/
        ├── index.md              # References: ./image.png
        └── 09f2abe4-ddfc-4388.png
```

**Flat Mode (`--flat`):**
```
src/
├── _posts/
│   └── aws-building-a-vpc.md     # References: /images/09f2abe4-ddfc-4388.png
└── _images/
    └── 09f2abe4-ddfc-4388.png
```

## Architecture Changes

### Data Flow Diagram - Nested Mode (Current)

```
┌─────────────────────────┐
│  Hashnode Export JSON   │
└────────────┬────────────┘
             │
             ▼
     ┌───────────────────┐
     │  PostParser       │
     │  Extract fields   │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Markdown         │
     │  Transformer      │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Image            │
     │  Processor        │
     │  ─────────────────│
     │  imageDir:        │
     │    {output}/{slug}│
     │  pathPrefix: ./   │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Frontmatter      │
     │  Generator        │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  FileWriter       │
     │  ─────────────────│
     │  outputMode:      │
     │    nested         │
     │  writes:          │
     │    {slug}/index.md│
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Logger           │
     │  (tracks errors)  │
     └───────────────────┘
```

### Data Flow Diagram - Flat Mode (New)

```
┌─────────────────────────┐
│  Hashnode Export JSON   │
└────────────┬────────────┘
             │
             ▼
     ┌───────────────────┐
     │  PostParser       │
     │  Extract fields   │
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │  Markdown         │
     │  Transformer      │
     └────────┬──────────┘
              │
     ┌────────▼───────────────────┐
     │  Image Processor           │
     │  ──────────────────────────│
     │  imageDir:                 │
     │    {output}/../_images     │  ◄── CHANGED: Sibling folder
     │  pathPrefix: /images       │  ◄── CHANGED: Absolute path
     │  ──────────────────────────│
     │  Uses: processWithContext()│  ◄── NEW METHOD
     └────────┬───────────────────┘
              │
     ┌────────▼──────────┐
     │  Frontmatter      │
     │  Generator        │
     └────────┬──────────┘
              │
     ┌────────▼───────────────────┐
     │  FileWriter                │
     │  ──────────────────────────│
     │  outputMode: flat          │  ◄── NEW CONFIG
     │  writes: {slug}.md         │  ◄── CHANGED: No subdirectory
     └────────┬───────────────────┘
              │
     ┌────────▼──────────┐
     │  Logger           │
     │  (tracks errors)  │
     └───────────────────┘
```

### Key Differences

| Component | Nested Mode | Flat Mode |
|-----------|-------------|-----------|
| FileWriter output | `{output}/{slug}/index.md` | `{output}/{slug}.md` |
| Image directory | `{output}/{slug}/` | `{output}/../_images/` |
| Image path in MD | `./filename.png` | `/images/filename.png` |
| Post existence check | Directory exists? | File exists? |
| Marker location | `{slug}/.downloaded-markers/` | `_images/.downloaded-markers/` |

---

## Detailed Implementation Steps

### Phase 1: Type Definitions

#### Step 1.1: Add OutputStructure Interface
- [ ] Create `OutputStructure` interface in `src/types/converter-options.ts`
- [ ] Add `outputStructure` field to `ConversionOptions` interface
- [ ] Export new types from `src/index.ts`

**Proposed Changes to `src/types/converter-options.ts`:**

```typescript
// Add after LoggerConfig interface (around line 45)

/**
 * Output structure configuration for the conversion process.
 * Controls how posts and images are organized on disk.
 */
export interface OutputStructure {
  /**
   * Output mode determines file organization:
   * - 'nested': Creates {slug}/index.md with images in same directory (default)
   * - 'flat': Creates {slug}.md with images in shared sibling directory
   * @default 'nested'
   */
  mode: 'nested' | 'flat';

  /**
   * Name of the shared image folder (flat mode only).
   * Created as a sibling to the output directory.
   * @default '_images'
   * @example 'assets' -> creates {output}/../assets/
   */
  imageFolderName?: string;

  /**
   * Path prefix for image references in markdown (flat mode only).
   * Should match your static site generator's asset path configuration.
   * @default '/images'
   * @example '/assets/images' -> ![alt](/assets/images/filename.png)
   */
  imagePathPrefix?: string;
}
```

**Proposed Changes to `ConversionOptions` interface:**

```typescript
export interface ConversionOptions {
  skipExisting?: boolean;
  downloadOptions?: ImageDownloadOptions;
  loggerConfig?: LoggerConfig;

  /**
   * Output structure configuration.
   * Controls file naming and image storage location.
   * @default { mode: 'nested' }
   */
  outputStructure?: OutputStructure;
}
```

#### Step 1.2: Add ImageProcessorContext Interface
- [ ] Create `ImageProcessorContext` interface in `src/types/image-processor.ts`
- [ ] Export from `src/index.ts`

**New File: `src/types/image-processor.ts`:**

```typescript
/**
 * Context for image processing that includes output structure information.
 * Used by ImageProcessor.processWithContext() for flat mode support.
 */
export interface ImageProcessorContext {
  /**
   * Directory where images should be saved.
   * In nested mode: {output}/{slug}/
   * In flat mode: {output}/../_images/
   */
  imageDir: string;

  /**
   * Path prefix for image references in markdown.
   * In nested mode: '.'
   * In flat mode: '/images' (or custom prefix)
   */
  imagePathPrefix: string;

  /**
   * Optional custom directory for download markers.
   * Defaults to {imageDir}/.downloaded-markers/
   */
  markerDir?: string;
}
```

---

### Phase 2: FileWriter Service Updates

#### Step 2.1: Add outputMode Configuration
- [ ] Add `outputMode` to `FileWriterConfig` interface
- [ ] Store output mode in class property
- [ ] Update constructor to accept new config

**Proposed Changes to `src/services/file-writer.ts`:**

```typescript
// Update FileWriterConfig interface (around line 7-26)
export interface FileWriterConfig {
  overwrite?: boolean;
  encoding?: BufferEncoding;
  atomicWrites?: boolean;

  /**
   * Output mode for file organization:
   * - 'nested': Creates {slug}/index.md (default)
   * - 'flat': Creates {slug}.md directly in output directory
   * @default 'nested'
   */
  outputMode?: 'nested' | 'flat';
}

// Add class property (around line 57)
private readonly outputMode: 'nested' | 'flat';

// Update constructor (around line 59-63)
constructor(config?: FileWriterConfig) {
  this.overwrite = config?.overwrite ?? false;
  this.encoding = config?.encoding ?? 'utf8';
  this.atomicWrites = config?.atomicWrites ?? true;
  this.outputMode = config?.outputMode ?? 'nested';
}
```

#### Step 2.2: Update postExists Method
- [ ] Check for `{slug}.md` file in flat mode
- [ ] Check for `{slug}/` directory in nested mode (current behavior)
- [ ] Add unit tests for flat mode existence check

**Proposed Changes to `postExists` method (lines 183-192):**

```typescript
/**
 * Check if a post already exists in the output directory.
 * In nested mode, checks for directory existence.
 * In flat mode, checks for {slug}.md file existence.
 */
postExists(outputDir: string, slug: string): boolean {
  try {
    const sanitized = this.sanitizeSlug(slug);

    if (this.outputMode === 'flat') {
      // Flat mode: check for {slug}.md file
      const filePath = path.join(outputDir, `${sanitized}.md`);
      return fs.existsSync(filePath);
    } else {
      // Nested mode: check for {slug}/ directory
      const postDir = path.join(outputDir, sanitized);
      return fs.existsSync(postDir);
    }
  } catch {
    return false;
  }
}
```

#### Step 2.3: Update writePost Method
- [ ] Write to `{slug}.md` in flat mode
- [ ] Write to `{slug}/index.md` in nested mode (current behavior)
- [ ] Ensure output directory exists (but don't create subdirectory in flat mode)
- [ ] Add unit tests for flat mode file writing

**Proposed Changes to `writePost` method (lines 203-244):**

```typescript
/**
 * Write a post to the output directory.
 * In nested mode: creates {output}/{slug}/index.md
 * In flat mode: creates {output}/{slug}.md
 */
async writePost(
  outputDir: string,
  slug: string,
  frontmatter: string,
  content: string
): Promise<string> {
  const sanitized = this.sanitizeSlug(slug);
  let filePath: string;

  if (this.outputMode === 'flat') {
    // Flat mode: write {output}/{slug}.md
    filePath = path.join(outputDir, `${sanitized}.md`);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      try {
        await fs.promises.mkdir(outputDir, { recursive: true });
      } catch (error) {
        throw new FileWriteError(
          `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
          outputDir,
          'create_dir',
          error instanceof Error ? error : undefined
        );
      }
    }
  } else {
    // Nested mode: write {output}/{slug}/index.md
    const postDir = path.join(outputDir, sanitized);
    filePath = path.join(postDir, 'index.md');

    // Create post directory
    try {
      await fs.promises.mkdir(postDir, { recursive: true });
    } catch (error) {
      throw new FileWriteError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        postDir,
        'create_dir',
        error instanceof Error ? error : undefined
      );
    }
  }

  // Check if file exists and handle overwrite behavior
  if (!this.overwrite && fs.existsSync(filePath)) {
    throw new FileWriteError(
      `File already exists and overwrite is disabled: ${filePath}`,
      filePath,
      'write_file'
    );
  }

  // Combine frontmatter + content and write
  const markdown = frontmatter + '\n' + content;

  if (this.atomicWrites) {
    await this.writeFileAtomic(filePath, markdown);
  } else {
    await this.writeFileDirect(filePath, markdown);
  }

  return path.resolve(filePath);
}
```

#### Step 2.4: Write FileWriter Unit Tests
- [ ] Test `postExists()` returns true when `{slug}.md` exists in flat mode
- [ ] Test `postExists()` returns false when `{slug}.md` does not exist in flat mode
- [ ] Test `writePost()` creates `{slug}.md` in flat mode (no subdirectory)
- [ ] Test `writePost()` creates output directory if missing in flat mode
- [ ] Test nested mode behavior remains unchanged

**Test Cases for `tests/unit/services/file-writer.test.ts`:**

```typescript
describe('Flat Output Mode', () => {
  describe('postExists', () => {
    it('should return true when {slug}.md exists in flat mode', () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Create test-slug.md file
      // Assert postExists returns true
    });

    it('should return false when {slug}.md does not exist in flat mode', () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Assert postExists returns false for non-existent file
    });

    it('should ignore {slug}/ directory in flat mode', () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Create test-slug/ directory (but no .md file)
      // Assert postExists returns false
    });
  });

  describe('writePost', () => {
    it('should write {slug}.md directly in output directory', async () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Write post
      // Assert file exists at {output}/test-slug.md
      // Assert no {output}/test-slug/ directory created
    });

    it('should create output directory if missing', async () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Write post to non-existent directory
      // Assert directory created and file written
    });

    it('should not create subdirectory in flat mode', async () => {
      const flatWriter = new FileWriter({ outputMode: 'flat' });
      // Write post
      // Assert {output}/test-slug/ directory does NOT exist
    });
  });
});
```

---

### Phase 3: ImageProcessor Updates

#### Step 3.1: Add processWithContext Method
- [ ] Create new `processWithContext()` method that accepts `ImageProcessorContext`
- [ ] Use provided `imageDir` for downloads instead of inferring from blogDir
- [ ] Use provided `imagePathPrefix` for markdown URL replacement
- [ ] Keep existing `process()` method for backwards compatibility

**Proposed Changes to `src/processors/image-processor.ts`:**

```typescript
// Add import for new type
import { ImageProcessorContext } from '../types/image-processor';

// Add new method (after existing process method, around line 206)

/**
 * Process markdown with explicit image context.
 * Used for flat mode where images go to a shared directory.
 *
 * @param markdown - The markdown content to process
 * @param context - Image processing context with directory and path prefix
 * @returns Processing result with updated markdown and statistics
 */
async processWithContext(
  markdown: string,
  context: ImageProcessorContext
): Promise<ImageProcessingResult> {
  const { imageDir, imagePathPrefix, markerDir } = context;
  const effectiveMarkerDir = markerDir ?? imageDir;

  // Validate directory exists
  if (!fs.existsSync(imageDir)) {
    throw new Error(
      `Image directory does not exist: ${imageDir}. ` +
        `Ensure directory is created before calling ImageProcessor.`
    );
  }

  const imageMatches = this.extractImageUrls(markdown);
  const errors: ImageProcessingError[] = [];
  let imagesDownloaded = 0;
  let imagesSkipped = 0;
  let updatedMarkdown = markdown;

  for (const [_fullMatch, url] of imageMatches) {
    const filename = ImageDownloader.extractHash(url);

    if (!filename) {
      errors.push({
        filename: 'unknown',
        url,
        error: 'Could not extract hash from URL',
        is403: false,
      });
      continue;
    }

    const filepath = path.join(imageDir, filename);
    const markerPath = this.getMarkerPathForDir(effectiveMarkerDir, filename);
    const marker403Path = markerPath + '.403';

    // Build local path with configured prefix
    const localPath = this.buildImagePath(imagePathPrefix, filename);

    // Check if download succeeded previously
    if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
      const stats = fs.statSync(markerPath);
      if (stats.size === 0) {
        imagesSkipped++;
        updatedMarkdown = updatedMarkdown.replace(url, localPath);
        continue;
      }
    }

    // Check for permanent 403 failure
    if (fs.existsSync(marker403Path)) {
      imagesSkipped++;
      continue;
    }

    // Attempt download
    try {
      const result = await this.downloader.download(url, filepath);

      if (result.success) {
        fs.writeFileSync(markerPath, '');
        imagesDownloaded++;
        updatedMarkdown = updatedMarkdown.replace(url, localPath);
      } else if (result.is403) {
        this.recordDownloadFailureForDir(
          filename, url, result.error || 'HTTP 403 Forbidden',
          true, effectiveMarkerDir, errors
        );
      } else {
        this.recordDownloadFailureForDir(
          filename, url, result.error || 'Download failed',
          false, effectiveMarkerDir, errors
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordDownloadFailureForDir(filename, url, errorMsg, false, effectiveMarkerDir, errors);
    }
  }

  return {
    markdown: updatedMarkdown,
    imagesProcessed: imageMatches.length,
    imagesDownloaded,
    imagesSkipped,
    errors,
  };
}

/**
 * Build image path from prefix and filename.
 * Handles trailing slash normalization.
 */
private buildImagePath(prefix: string, filename: string): string {
  if (prefix.endsWith('/')) {
    return `${prefix}${filename}`;
  }
  return `${prefix}/${filename}`;
}

/**
 * Get marker path for a specific directory.
 * Creates the markers directory if it doesn't exist.
 */
private getMarkerPathForDir(baseDir: string, filename: string): string {
  const markersDir = path.join(baseDir, '.downloaded-markers');
  if (!fs.existsSync(markersDir)) {
    fs.mkdirSync(markersDir, { recursive: true });
  }
  return path.join(markersDir, `${filename}.marker`);
}

/**
 * Record download failure with marker in specified directory.
 */
private recordDownloadFailureForDir(
  filename: string,
  url: string,
  errorMessage: string,
  isPermanent403: boolean,
  baseDir: string,
  errors: ImageProcessingError[]
): void {
  const markerPath = this.getMarkerPathForDir(baseDir, filename);
  const filePath = isPermanent403 ? `${markerPath}.403` : markerPath;
  fs.writeFileSync(filePath, errorMessage);
  errors.push({
    filename,
    url,
    error: errorMessage,
    is403: isPermanent403,
  });
}
```

#### Step 3.2: Write ImageProcessor Unit Tests
- [ ] Test `processWithContext` uses provided `imageDir`
- [ ] Test `processWithContext` uses provided `imagePathPrefix`
- [ ] Test marker files created in shared directory
- [ ] Test path prefix with trailing slash
- [ ] Test path prefix without trailing slash
- [ ] Test existing `process()` method unchanged

**Test Cases for `tests/unit/processors/image-processor.test.ts`:**

```typescript
describe('processWithContext', () => {
  it('should download images to provided imageDir', async () => {
    const processor = new ImageProcessor();
    const context = {
      imageDir: '/tmp/shared-images',
      imagePathPrefix: '/images',
    };
    // Mock download, process markdown with image
    // Assert image downloaded to /tmp/shared-images/
  });

  it('should use provided imagePathPrefix in markdown', async () => {
    const processor = new ImageProcessor();
    const context = {
      imageDir: '/tmp/shared-images',
      imagePathPrefix: '/images',
    };
    const result = await processor.processWithContext(
      '![alt](https://cdn.hashnode.com/res/hashnode/image/upload/abc123.png)',
      context
    );
    expect(result.markdown).toContain('/images/abc123.png');
  });

  it('should handle imagePathPrefix with trailing slash', async () => {
    const context = {
      imageDir: '/tmp/images',
      imagePathPrefix: '/assets/',  // With trailing slash
    };
    // Assert produces /assets/filename.png (not /assets//filename.png)
  });

  it('should handle imagePathPrefix without trailing slash', async () => {
    const context = {
      imageDir: '/tmp/images',
      imagePathPrefix: '/assets',  // Without trailing slash
    };
    // Assert produces /assets/filename.png
  });

  it('should create markers in imageDir', async () => {
    const context = {
      imageDir: '/tmp/shared-images',
      imagePathPrefix: '/images',
    };
    // Process image
    // Assert marker exists at /tmp/shared-images/.downloaded-markers/
  });

  it('should skip images with existing markers in imageDir', async () => {
    const context = {
      imageDir: '/tmp/shared-images',
      imagePathPrefix: '/images',
    };
    // Create marker file
    // Process same image
    // Assert download not attempted, imagesSkipped incremented
  });

  it('should throw if imageDir does not exist', async () => {
    const context = {
      imageDir: '/nonexistent/path',
      imagePathPrefix: '/images',
    };
    await expect(processor.processWithContext(markdown, context))
      .rejects.toThrow('Image directory does not exist');
  });
});
```

---

### Phase 4: Converter Updates

#### Step 4.1: Update convertPost Method
- [ ] Read `outputStructure` from options
- [ ] Calculate image directory based on mode (nested vs flat)
- [ ] Create image directory before processing
- [ ] Use `processWithContext()` for flat mode
- [ ] Create FileWriter with appropriate `outputMode`

**Proposed Changes to `src/converter.ts` `convertPost` method (around line 375-455):**

```typescript
async convertPost(
  post: HashnodePost,
  outputDir: string,
  options?: ConversionOptions
): Promise<ConvertedPost> {
  const slug = this.extractSlugSafely(post, 0);
  const outputStructure = options?.outputStructure ?? { mode: 'nested' };
  const isFlat = outputStructure.mode === 'flat';

  try {
    // Step 1: Parse post metadata
    const metadata = this.postParser.parse(post);

    // Step 2: Transform markdown
    const transformedMarkdown = this.markdownTransformer.transform(
      metadata.contentMarkdown
    );

    // Step 3: Determine image directory and prepare it
    let imageDir: string;
    let imagePathPrefix: string;

    if (isFlat) {
      // Flat mode: images go to sibling folder
      const parentDir = path.dirname(outputDir);
      const imageFolderName = outputStructure.imageFolderName ?? '_images';
      imageDir = path.join(parentDir, imageFolderName);
      imagePathPrefix = outputStructure.imagePathPrefix ?? '/images';
    } else {
      // Nested mode: images go into post directory
      imageDir = path.join(outputDir, metadata.slug);
      imagePathPrefix = '.';
    }

    // Create image directory if needed
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Step 4: Process images
    const imageProcessor = options?.downloadOptions
      ? new ImageProcessor(options.downloadOptions)
      : this.imageProcessor;

    let imageResult: ImageProcessingResult;
    if (isFlat) {
      // Use context-aware processing for flat mode
      imageResult = await imageProcessor.processWithContext(transformedMarkdown, {
        imageDir,
        imagePathPrefix,
      });
    } else {
      // Use existing method for nested mode (backwards compatible)
      imageResult = await imageProcessor.process(transformedMarkdown, imageDir);
    }

    // Emit image events and track 403 errors
    this.emitImageDownloadedEvents(imageResult, metadata.slug);
    this.trackHttp403Errors(imageResult.errors, metadata.slug);

    // Step 5: Generate frontmatter
    const frontmatter = this.frontmatterGenerator.generate(metadata);

    // Step 6: Write file (FileWriter handles flat vs nested)
    const fileWriter = isFlat
      ? new FileWriter({ outputMode: 'flat' })
      : this.fileWriter;

    const outputPath = await fileWriter.writePost(
      outputDir,
      metadata.slug,
      frontmatter,
      imageResult.markdown
    );

    // Emit completion event
    this.emit('conversion-completed', {
      slug: metadata.slug,
      title: metadata.title,
      outputPath,
    });

    return {
      slug: metadata.slug,
      title: metadata.title,
      outputPath,
      success: true,
    };
  } catch (error) {
    // ... existing error handling unchanged
  }
}
```

#### Step 4.2: Update convertAllPosts Method
- [ ] Create FileWriter with correct output mode for `postExists` check
- [ ] Ensure image directory created once at start (for flat mode)

**Proposed Changes to `src/converter.ts` `convertAllPosts` method (around line 274):**

```typescript
// In convertAllPosts method, update post existence check:
const outputStructure = effectiveOptions.outputStructure ?? { mode: 'nested' };
const isFlat = outputStructure.mode === 'flat';

// Create FileWriter with correct mode for existence check
const existenceChecker = isFlat
  ? new FileWriter({ outputMode: 'flat' })
  : this.fileWriter;

// Create shared image directory once for flat mode
if (isFlat) {
  const parentDir = path.dirname(outputDir);
  const imageFolderName = outputStructure.imageFolderName ?? '_images';
  const imageDir = path.join(parentDir, imageFolderName);
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }
}

// ... in the post loop:
if (effectiveOptions.skipExisting && existenceChecker.postExists(outputDir, slug)) {
  // ... existing skip logic
}
```

#### Step 4.3: Write Converter Integration Tests
- [ ] Test full pipeline in flat mode
- [ ] Test image directory creation as sibling
- [ ] Test image path prefix in output markdown
- [ ] Test post existence check with flat files
- [ ] Test custom `imageFolderName` option
- [ ] Test custom `imagePathPrefix` option
- [ ] Test nested mode unchanged (regression)

**Test Cases for `tests/integration/converter.test.ts`:**

```typescript
describe('Flat Output Mode', () => {
  it('should write posts as {slug}.md in flat mode', async () => {
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      outputStructure: { mode: 'flat' },
    });
    // Assert file exists at {output}/post-slug.md
    // Assert no {output}/post-slug/ directory
  });

  it('should place images in sibling _images folder', async () => {
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      outputStructure: { mode: 'flat' },
    });
    // Assert images exist at {output}/../_images/
  });

  it('should use /images prefix in markdown references', async () => {
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      outputStructure: { mode: 'flat' },
    });
    // Read output markdown
    // Assert contains /images/filename.png
  });

  it('should skip existing {slug}.md files when skipExisting is true', async () => {
    // Create existing-post.md
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      skipExisting: true,
      outputStructure: { mode: 'flat' },
    });
    // Assert post was skipped
  });

  it('should respect custom imageFolderName', async () => {
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      outputStructure: {
        mode: 'flat',
        imageFolderName: 'assets',
      },
    });
    // Assert images in {output}/../assets/
  });

  it('should respect custom imagePathPrefix', async () => {
    const result = await converter.convertAllPosts(exportPath, outputDir, {
      outputStructure: {
        mode: 'flat',
        imagePathPrefix: '/static/images',
      },
    });
    // Read output markdown
    // Assert contains /static/images/filename.png
  });

  it('should maintain backwards compatibility in nested mode', async () => {
    // No outputStructure option (default)
    const result = await converter.convertAllPosts(exportPath, outputDir);
    // Assert {slug}/index.md structure
    // Assert images in {slug}/ directory
    // Assert ./filename.png paths in markdown
  });
});
```

---

### Phase 5: CLI Updates

#### Step 5.1: Update CLIOptions Interface
- [ ] Add `flat` boolean flag
- [ ] Add `imageFolderName` optional string (renamed from `imageFolder`)
- [ ] Add `imagePathPrefix` optional string (renamed from `imagePrefix`)

**Proposed Changes to `src/cli/convert.ts`:**

```typescript
// Update CLIOptions interface (around line 18)
interface CLIOptions {
  export: string;
  output: string;
  logFile?: string;
  skipExisting: boolean;
  verbose: boolean;
  quiet: boolean;
  flat: boolean;
  imageFolder?: string;
  imagePrefix?: string;
}
```

#### Step 5.2: Add CLI Flags
- [ ] Add `-f, --flat` boolean flag
- [ ] Add `--image-folder <name>` option
- [ ] Add `--image-prefix <prefix>` option
- [ ] Update help text

**Proposed Changes to CLI setup (around lines 325-336):**

```typescript
program
  .command('convert')
  .description('Convert a Hashnode export JSON file to Markdown files')
  .requiredOption('-e, --export <path>', 'Path to Hashnode export JSON file')
  .requiredOption('-o, --output <path>', 'Output directory for converted posts')
  .option('-l, --log-file <path>', 'Path to log file (optional)')
  .option('--no-skip-existing', 'Overwrite posts that already exist')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-q, --quiet', 'Suppress progress output (only show summary)', false)
  .option('-f, --flat', 'Use flat output mode ({slug}.md instead of {slug}/index.md)', false)
  .option('--image-folder <name>', 'Image folder name in flat mode (default: _images)')
  .option('--image-prefix <prefix>', 'Image path prefix in flat mode (default: /images)')
  .action(async (options: CLIOptions) => {
    await runConvert(options);
  });
```

#### Step 5.3: Build outputStructure from CLI Options
- [ ] Create `OutputStructure` object when `--flat` is set
- [ ] Pass through to `ConversionOptions`

**Proposed Changes to `runConvert` function (around lines 268-279):**

```typescript
// Build conversion options
const conversionOptions: ConversionOptions = {
  skipExisting: options.skipExisting,
};

// Add output structure config if flat mode is enabled
if (options.flat) {
  conversionOptions.outputStructure = {
    mode: 'flat',
    imageFolderName: options.imageFolder,   // undefined uses default
    imagePathPrefix: options.imagePrefix,   // undefined uses default
  };
}

// Add logger config if log file specified
if (logFilePath) {
  const loggerConfig: LoggerConfig = {
    filePath: logFilePath,
    verbosity: options.verbose ? 'verbose' : options.quiet ? 'quiet' : 'normal',
  };
  conversionOptions.loggerConfig = loggerConfig;
}
```

#### Step 5.4: Update Startup Display
- [ ] Show output mode (nested/flat) in startup info
- [ ] Show image folder name when in flat mode

**Proposed Changes to startup display (around lines 256-265):**

```typescript
// Display startup info
if (!options.quiet) {
  console.log('\nHashnode Content Converter');
  console.log(`Export:  ${exportPath}`);
  console.log(`Output:  ${outputPath}`);
  if (options.flat) {
    const imageFolder = options.imageFolder ?? '_images';
    console.log(`Mode:    flat (images -> ../${imageFolder}/)`);
  } else {
    console.log(`Mode:    nested ({slug}/index.md)`);
  }
  if (logFilePath) {
    console.log(`Log:     ${logFilePath}`);
  }
  console.log(`Skip existing: ${options.skipExisting}`);
  console.log('');
}
```

#### Step 5.5: Write CLI Unit Tests
- [ ] Test `--flat` flag sets `flat: true`
- [ ] Test `--flat` defaults to `false`
- [ ] Test `--image-folder` option passed through
- [ ] Test `--image-prefix` option passed through
- [ ] Test validation: `--image-folder` without `--flat` (should warn or be ignored)

**Test Cases for `tests/unit/cli/cli.test.ts`:**

```typescript
describe('--flat flag', () => {
  it('should set flat: true when --flat is provided', async () => {
    const options = parseOptions(['convert', '-e', 'export.json', '-o', 'out', '--flat']);
    expect(options.flat).toBe(true);
  });

  it('should default flat to false', async () => {
    const options = parseOptions(['convert', '-e', 'export.json', '-o', 'out']);
    expect(options.flat).toBe(false);
  });
});

describe('--image-folder option', () => {
  it('should accept --image-folder with --flat', async () => {
    const options = parseOptions([
      'convert', '-e', 'export.json', '-o', 'out',
      '--flat', '--image-folder', 'assets'
    ]);
    expect(options.imageFolder).toBe('assets');
  });

  it('should be undefined when not provided', async () => {
    const options = parseOptions(['convert', '-e', 'export.json', '-o', 'out', '--flat']);
    expect(options.imageFolder).toBeUndefined();
  });
});

describe('--image-prefix option', () => {
  it('should accept --image-prefix with --flat', async () => {
    const options = parseOptions([
      'convert', '-e', 'export.json', '-o', 'out',
      '--flat', '--image-prefix', '/static/images'
    ]);
    expect(options.imagePrefix).toBe('/static/images');
  });
});
```

---

### Phase 6: Exports and Documentation

#### Step 6.1: Update Public Exports
- [ ] Export `OutputStructure` type from `src/index.ts`
- [ ] Export `ImageProcessorContext` type from `src/index.ts`

**Proposed Changes to `src/index.ts`:**

```typescript
// Add to type exports section
export type { OutputStructure } from './types/converter-options';
export type { ImageProcessorContext } from './types/image-processor';
```

#### Step 6.2: Update README
- [ ] Add flat mode to CLI options table
- [ ] Add flat mode usage example
- [ ] Document `--image-folder` and `--image-prefix` options
- [ ] Add library usage example with `outputStructure`

#### Step 6.3: Update CHANGELOG
- [ ] Document new feature in Unreleased/next version section
- [ ] List new CLI options
- [ ] Note backwards compatibility

---

## Test Summary

### Unit Tests to Add

| Component | Test File | Tests |
|-----------|-----------|-------|
| FileWriter | `tests/unit/services/file-writer.test.ts` | ~8 new tests |
| ImageProcessor | `tests/unit/processors/image-processor.test.ts` | ~10 new tests |
| CLI | `tests/unit/cli/cli.test.ts` | ~6 new tests |

### Integration Tests to Add

| Test File | Tests |
|-----------|-------|
| `tests/integration/converter.test.ts` | ~8 new tests |

### Expected Coverage

- Maintain 99%+ overall coverage
- New code paths should have 100% coverage

---

## Edge Cases and Considerations

1. **Image deduplication**: Multiple posts may reference the same image. The marker system handles this - if an image exists with a success marker, it's skipped and the URL replaced.

2. **Parent directory validation**: In flat mode, `path.dirname(outputDir)` must exist. Add validation to ensure parent exists before creating `_images` sibling.

3. **Image filename collisions**: Different Hashnode CDN URLs might produce the same filename hash. The current `ImageDownloader.extractHash()` uses UUID from the URL, which should be unique.

4. **Static site generator compatibility**: The `/images` prefix works for Bridgetown/Jekyll. Other generators may need different prefixes (e.g., `/assets/images` for Hugo).

5. **Backwards compatibility**: Default behavior (no `--flat` flag) must remain unchanged. All existing tests must pass without modification.

6. **CLI option validation**: Consider warning if `--image-folder` or `--image-prefix` are used without `--flat`.

---

## Success Criteria

1. **Functionality**: Flat mode produces expected output structure
2. **Backwards Compatible**: Default behavior unchanged
3. **Testing**: 90%+ coverage on new code
4. **Documentation**: README updated with new options
5. **CLI**: New flags work correctly with helpful error messages
