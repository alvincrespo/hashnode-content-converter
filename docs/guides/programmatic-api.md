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
converter.on('post-started', ({ index, total, title }) => {
  console.log(`Starting: ${title}`);
});

converter.on('post-completed', ({ slug, outputPath }) => {
  console.log(`Completed: ${slug} -> ${outputPath}`);
});

converter.on('conversion-error', ({ slug, message }) => {
  console.error(`Error in ${slug}: ${message}`);
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
  skipExisting: true,      // Skip posts that already exist
  downloadDelayMs: 100,    // Delay between image downloads
  flatOutput: false,       // Use nested directory structure
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
| `post-started` | `{ index, total, title, slug }` | Post conversion started |
| `post-completed` | `{ slug, outputPath }` | Post converted successfully |
| `post-skipped` | `{ slug, reason }` | Post skipped |
| `conversion-error` | `{ slug, message, error? }` | Post conversion failed |
| `image-downloaded` | `{ url, outputPath }` | Image downloaded |
| `image-failed` | `{ url, error }` | Image download failed |

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
