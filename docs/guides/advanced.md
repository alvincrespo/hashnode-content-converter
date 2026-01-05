# Advanced Usage

This guide covers advanced features for customizing the conversion process.

## Custom Event Handling

The `Converter` class extends `EventEmitter`, allowing fine-grained control:

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const converter = new Converter();

// Track progress with custom UI
let startTime: number;

converter.on('conversion-started', ({ total }) => {
  startTime = Date.now();
  console.log(`Starting conversion of ${total} posts...`);
});

converter.on('post-started', ({ index, total, title }) => {
  const percent = Math.round((index / total) * 100);
  process.stdout.write(`\r[${percent}%] ${title.slice(0, 40)}...`);
});

converter.on('post-completed', ({ slug }) => {
  // Update progress bar, log to file, etc.
});

converter.on('image-downloaded', ({ url }) => {
  // Track image downloads for analytics
});

converter.on('conversion-error', ({ slug, message, error }) => {
  // Send to error tracking service
  errorTracker.capture(error, { slug, message });
});

const result = await converter.convertAllPosts('./export.json', './blog');
```

## Using Individual Processors

For maximum flexibility, use the processors directly:

### PostParser

Extracts metadata from Hashnode posts:

```typescript
import { PostParser } from '@alvincrespo/hashnode-content-converter';

const parser = new PostParser();
const metadata = parser.parse(hashnodePost);

// metadata contains:
// - title, slug, date, tags
// - coverImage, canonicalUrl
// - brief, subtitle
```

### MarkdownTransformer

Cleans Hashnode-specific markdown quirks:

```typescript
import { MarkdownTransformer } from '@alvincrespo/hashnode-content-converter';

const transformer = new MarkdownTransformer({
  removeAlignAttributes: true,  // Remove align="center" etc.
  trimWhitespace: true,         // Clean up extra whitespace
});

const cleanMarkdown = transformer.transform(rawMarkdown);
```

### ImageProcessor

Downloads and localizes images:

```typescript
import {
  ImageProcessor,
  ImageDownloader,
} from '@alvincrespo/hashnode-content-converter';

const downloader = new ImageDownloader({
  maxRetries: 3,
  retryDelayMs: 1000,
});

const processor = new ImageProcessor(downloader);

const result = await processor.process(markdown, './images');
// result.markdown - Updated markdown with local image paths
// result.images - Array of downloaded image info
// result.errors - Array of failed downloads
```

### FrontmatterGenerator

Generates YAML frontmatter:

```typescript
import { FrontmatterGenerator } from '@alvincrespo/hashnode-content-converter';

const generator = new FrontmatterGenerator();
const frontmatter = generator.generate({
  title: 'My Post',
  slug: 'my-post',
  date: new Date().toISOString(),
  tags: ['javascript', 'tutorial'],
});

// Returns:
// ---
// title: "My Post"
// slug: "my-post"
// date: "2024-01-15T10:30:00.000Z"
// tags:
//   - javascript
//   - tutorial
// ---
```

## Custom Processing Pipeline

Build your own conversion pipeline:

```typescript
import {
  PostParser,
  MarkdownTransformer,
  ImageProcessor,
  FrontmatterGenerator,
  FileWriter,
  ImageDownloader,
} from '@alvincrespo/hashnode-content-converter';
import { readFile } from 'fs/promises';

async function customConvert(exportPath: string, outputDir: string) {
  // Load export
  const exportData = JSON.parse(await readFile(exportPath, 'utf-8'));

  // Initialize processors
  const parser = new PostParser();
  const transformer = new MarkdownTransformer();
  const imageProcessor = new ImageProcessor(new ImageDownloader());
  const frontmatter = new FrontmatterGenerator();
  const writer = new FileWriter();

  for (const post of exportData.posts) {
    // 1. Parse metadata
    const metadata = parser.parse(post);

    // 2. Transform markdown
    let markdown = transformer.transform(post.contentMarkdown);

    // 3. Custom transformation (example: add disclaimer)
    markdown = addDisclaimer(markdown);

    // 4. Process images
    const imageResult = await imageProcessor.process(
      markdown,
      `${outputDir}/${metadata.slug}/images`
    );
    markdown = imageResult.markdown;

    // 5. Generate frontmatter
    const yaml = frontmatter.generate(metadata);

    // 6. Combine and write
    const content = `${yaml}\n${markdown}`;
    await writer.write(`${outputDir}/${metadata.slug}/index.md`, content);
  }
}

function addDisclaimer(markdown: string): string {
  return `> This post was migrated from Hashnode.\n\n${markdown}`;
}
```

## Image Download Configuration

Configure image downloading behavior:

```typescript
import {
  ImageDownloader,
  ImageDownloadConfig,
} from '@alvincrespo/hashnode-content-converter';

const config: ImageDownloadConfig = {
  maxRetries: 5,           // Retry failed downloads
  retryDelayMs: 2000,      // Wait between retries
  timeoutMs: 30000,        // Request timeout
};

const downloader = new ImageDownloader(config);
```

## Handling HTTP 403 Errors

Some Hashnode images may return 403 errors (access denied). The converter tracks these separately:

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const converter = new Converter();

converter.on('image-failed', ({ url, error, is403 }) => {
  if (is403) {
    // Image is permanently inaccessible
    console.log(`Access denied: ${url}`);
    // Consider using a placeholder image
  } else {
    // Transient error, might work on retry
    console.log(`Download failed: ${url}`);
  }
});
```

## Logger Service

Use the built-in logger for tracking:

```typescript
import { Logger } from '@alvincrespo/hashnode-content-converter';

const logger = new Logger({
  logFile: './conversion.log',
  consoleOutput: true,
});

// Log conversion events
logger.info('Starting conversion');
logger.warn('Skipping draft post');
logger.error('Failed to download image', { url, error });

// Track HTTP 403 errors separately
logger.track403(url);

// Get summary
const summary = logger.getSummary();
console.log(`403 errors: ${summary.http403Count}`);
```

## Integration Examples

### With Astro

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

// Convert to Astro content collection format
await Converter.fromExportFile(
  './hashnode-export.json',
  './src/content/blog'
);
```

### With Next.js

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

// Convert to Next.js MDX format
await Converter.fromExportFile(
  './hashnode-export.json',
  './content/posts'
);
```

### With Gatsby

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

// Convert to Gatsby blog format
await Converter.fromExportFile(
  './hashnode-export.json',
  './content/blog'
);
```
