/**
 * Type definitions for ImageProcessor.
 * Separated into dedicated file for reusability.
 */

/**
 * Configuration options for ImageProcessor.
 * These options are passed through to the ImageDownloader service.
 */
export interface ImageProcessorOptions {
  /**
   * Maximum number of retry attempts for failed downloads.
   * Does not apply to HTTP 403 errors (permanent failures).
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay in milliseconds between retry attempts.
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Timeout in milliseconds for each download attempt.
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Delay in milliseconds between consecutive downloads.
   * Helps avoid rate limiting from CDN.
   * @default 200 (matches reference implementation)
   */
  downloadDelayMs?: number;
}

/**
 * Result of image processing operation.
 * Contains updated markdown and detailed statistics.
 */
export interface ImageProcessingResult {
  /**
   * Markdown content with CDN URLs replaced by local relative paths.
   */
  markdown: string;

  /**
   * Total number of images found in markdown.
   */
  imagesProcessed: number;

  /**
   * Number of images successfully downloaded.
   */
  imagesDownloaded: number;

  /**
   * Number of images that already existed (skipped download).
   */
  imagesSkipped: number;

  /**
   * Errors encountered during processing.
   * Does not include skipped images (those are counted separately).
   */
  errors: ImageProcessingError[];
}

/**
 * Details about an image processing error.
 */
export interface ImageProcessingError {
  /**
   * Filename that failed to download (e.g., "uuid.png").
   */
  filename: string;

  /**
   * Original CDN URL that failed.
   */
  url: string;

  /**
   * Error message describing the failure.
   */
  error: string;

  /**
   * True if this was an HTTP 403 Forbidden error (permanent failure).
   * These should be tracked separately for reporting.
   */
  is403: boolean;
}

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
