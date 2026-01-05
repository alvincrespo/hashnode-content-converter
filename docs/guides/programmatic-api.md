# Programmatic API

Use the converter programmatically in your Node.js applications.

## Installation

```bash
npm install @alvincrespo/hashnode-content-converter
```

## Quick Start

### One-Liner Conversion

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const result = await Converter.fromExportFile('./export.json', './blog');
```

### With Progress Tracking

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const converter = Converter.withProgress((current, total, title) => {
  console.log(`[${current}/${total}] ${title}`);
});

const result = await converter.convertAllPosts('./export.json', './blog');
```

### Full Event Control

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

const converter = new Converter();

// Subscribe to events
converter.on('conversion-starting', ({ post, index, total }) => {
  console.log(`[${index}/${total}] Starting: ${post.title}`);
});

converter.on('conversion-completed', ({ result, durationMs }) => {
  console.log(`Completed: ${result.slug} in ${durationMs}ms`);
});

converter.on('conversion-error', ({ type, slug, message }) => {
  console.error(`[${type}] Error in ${slug}: ${message}`);
});

const result = await converter.convertAllPosts('./export.json', './blog');
```

## ConversionResult

All conversion methods return a `ConversionResult`:

```typescript
interface ConversionResult {
  converted: number;    // Successfully converted posts
  skipped: number;      // Posts skipped (already exist)
  errors: number;       // Posts that failed to convert
  duration: number;     // Total duration in milliseconds
  posts: PostConversionResult[];  // Per-post details
}
```

## ConversionOptions

Customize conversion behavior:

```typescript
import { Converter, ConversionOptions } from '@alvincrespo/hashnode-content-converter';

const options: ConversionOptions = {
  skipExisting: true,           // Skip posts that already exist
  downloadOptions: {
    downloadDelayMs: 100,       // Delay between image downloads
    maxRetries: 3,              // Retry failed downloads
    timeoutMs: 30000,           // HTTP request timeout
  },
};

const result = await Converter.fromExportFile(
  './export.json',
  './blog',
  options
);
```

## Events

The `Converter` emits events during conversion:

| Event | Payload | Description |
|-------|---------|-------------|
| `conversion-starting` | `{ post, index, total }` | Post conversion starting |
| `conversion-completed` | `{ result, index, total, durationMs }` | Post conversion completed |
| `image-downloaded` | `{ filename, postSlug, success, error?, is403? }` | Image download attempted |
| `conversion-error` | `{ type, slug?, message }` | Conversion error occurred |

## Working with Post Data

You can also load and work with the export data directly:

```typescript
import { readFile } from 'fs/promises';

// Load export file
const exportJson = JSON.parse(await readFile('./export.json', 'utf-8'));

// Access posts
const posts = exportJson.posts;
console.log(`Found ${posts.length} posts`);

// Inspect a post
const post = posts[0];
console.log(post.title);
console.log(post.slug);
console.log(post.contentMarkdown);
```

## Using Individual Processors

For advanced use cases, you can use individual processors:

```typescript
import {
  PostParser,
  MarkdownTransformer,
  FrontmatterGenerator,
  ImageProcessor,
  ImageDownloader,
} from '@alvincrespo/hashnode-content-converter';

// Parse metadata from a post
const parser = new PostParser();
const metadata = parser.parse(hashnodePost);

// Transform markdown content
const transformer = new MarkdownTransformer();
const cleanMarkdown = transformer.transform(hashnodePost.contentMarkdown);

// Generate frontmatter
const frontmatter = new FrontmatterGenerator();
const yaml = frontmatter.generate(metadata);

// Process images
const imageProcessor = new ImageProcessor(new ImageDownloader());
const { markdown, images } = await imageProcessor.process(
  cleanMarkdown,
  './images'
);
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  HashnodePost,
  ConversionOptions,
  ConversionResult,
  PostConversionResult,
} from '@alvincrespo/hashnode-content-converter';
```

## Error Handling

```typescript
import { Converter } from '@alvincrespo/hashnode-content-converter';

try {
  const result = await Converter.fromExportFile('./export.json', './blog');

  if (result.errors > 0) {
    console.warn(`${result.errors} posts failed to convert`);

    result.posts
      .filter(p => p.status === 'error')
      .forEach(p => console.error(`${p.slug}: ${p.error}`));
  }
} catch (error) {
  // Fatal errors (invalid JSON, missing file, etc.)
  console.error('Conversion failed:', error.message);
}
```
