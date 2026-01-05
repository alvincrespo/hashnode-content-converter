/**
 * @packageDocumentation
 *
 * # @alvincrespo/hashnode-content-converter
 *
 * Convert Hashnode blog exports to Markdown with YAML frontmatter.
 *
 * ## Quick Start
 * ```typescript
 * import { Converter } from '@alvincrespo/hashnode-content-converter';
 *
 * // One-liner for simple conversions
 * const result = await Converter.fromExportFile('./export.json', './blog');
 *
 * // With progress tracking
 * const converter = Converter.withProgress((i, total, title) => {
 *   console.log(`[${i}/${total}] ${title}`);
 * });
 * const result = await converter.convertAllPosts('./export.json', './blog');
 * ```
 *
 * ## Advanced Usage
 * For full control, use the event API:
 * ```typescript
 * const converter = new Converter();
 * converter.on('conversion-error', ({ slug, message }) => console.error(`${slug}: ${message}`));
 * const result = await converter.convertAllPosts('./export.json', './blog');
 * ```
 *
 * @module
 */

// -----------------------------------------------------------------------------
// Main Converter Class
// -----------------------------------------------------------------------------
export { Converter } from './converter.js';
export type { ConverterDependencies } from './converter.js';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
export * from './types/hashnode-schema.js';
export * from './types/converter-options.js';
export * from './types/conversion-result.js';
export * from './types/converter-events.js';

// -----------------------------------------------------------------------------
// Services (for advanced users)
// -----------------------------------------------------------------------------
export { ImageDownloader } from './services/image-downloader.js';
export type {
  ImageDownloadConfig,
  DownloadResult,
} from './services/image-downloader.js';

export { FileWriter, FileWriteError } from './services/file-writer.js';
export type { FileWriterConfig } from './services/file-writer.js';

export { Logger } from './services/logger.js';

// -----------------------------------------------------------------------------
// Processors (for advanced users)
// -----------------------------------------------------------------------------
export { PostParser } from './processors/post-parser.js';
export { MarkdownTransformer } from './processors/markdown-transformer.js';
export type { MarkdownTransformerOptions } from './processors/markdown-transformer.js';
export { ImageProcessor } from './processors/image-processor.js';
export { FrontmatterGenerator } from './processors/frontmatter-generator.js';

export type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
} from './types/image-processor.js';
