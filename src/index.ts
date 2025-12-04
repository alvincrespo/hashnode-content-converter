/**
 * @packageDocumentation
 *
 * # @alvin/hashnode-content-converter
 *
 * Convert Hashnode blog exports to Markdown with YAML frontmatter.
 *
 * ## Quick Start
 * ```typescript
 * import { Converter } from '@alvin/hashnode-content-converter';
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
export { Converter, ConverterDependencies } from './converter';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
export * from './types/hashnode-schema';
export * from './types/converter-options';
export * from './types/conversion-result';
export * from './types/converter-events';

// -----------------------------------------------------------------------------
// Services (for advanced users)
// -----------------------------------------------------------------------------
export { ImageDownloader } from './services/image-downloader';
export type {
  ImageDownloadConfig,
  DownloadResult,
} from './services/image-downloader';

export { FileWriter, FileWriteError } from './services/file-writer';
export type { FileWriterConfig } from './services/file-writer';

export { Logger } from './services/logger';

// -----------------------------------------------------------------------------
// Processors (for advanced users)
// -----------------------------------------------------------------------------
export { PostParser } from './processors/post-parser';
export {
  MarkdownTransformer,
  MarkdownTransformerOptions,
} from './processors/markdown-transformer';
export { ImageProcessor } from './processors/image-processor';
export { FrontmatterGenerator } from './processors/frontmatter-generator';

export type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
} from './types/image-processor';
