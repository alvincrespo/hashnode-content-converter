/**
 * Event type definitions for the Converter class.
 *
 * The Converter emits events during the conversion pipeline to enable
 * progress tracking, custom logging, and integration with external systems.
 *
 * @example
 * ```typescript
 * const converter = new Converter();
 *
 * // Progress tracking
 * converter.on('conversion-starting', ({ index, total, post }) => {
 *   console.log(`[${index}/${total}] Converting: ${post.title}`);
 * });
 *
 * // Error handling
 * converter.on('conversion-error', ({ type, slug, message }) => {
 *   errorTracker.record(type, message, slug);
 * });
 *
 * const result = await converter.convertAllPosts('./export.json', './blog');
 * ```
 */

import type { HashnodePost } from './hashnode-schema.js';
import type { ConvertedPost } from './conversion-result.js';

/**
 * Event payload emitted before a post conversion begins.
 * Consumers can use this for progress tracking or pre-conversion setup.
 */
export interface ConversionStartingEvent {
  /**
   * The Hashnode post about to be converted
   */
  post: HashnodePost;

  /**
   * 1-based index of the current post in the batch
   */
  index: number;

  /**
   * Total number of posts being converted
   */
  total: number;
}

/**
 * Event payload emitted after a post conversion completes.
 * Includes the result and timing information for progress tracking.
 */
export interface ConversionCompletedEvent {
  /**
   * The conversion result (success or failure)
   */
  result: ConvertedPost;

  /**
   * 1-based index of the current post in the batch
   */
  index: number;

  /**
   * Total number of posts being converted
   */
  total: number;

  /**
   * Duration of this post's conversion in milliseconds
   */
  durationMs: number;
}

/**
 * Event payload emitted after each image download attempt.
 * Enables fine-grained progress tracking for image-heavy posts.
 */
export interface ImageDownloadedEvent {
  /**
   * The filename that was downloaded (e.g., "uuid.png")
   */
  filename: string;

  /**
   * Post slug this image belongs to
   */
  postSlug: string;

  /**
   * Whether the download was successful
   */
  success: boolean;

  /**
   * Error message if download failed
   */
  error?: string;

  /**
   * Whether this was an HTTP 403 error (permanent failure)
   */
  is403?: boolean;
}

/**
 * Event payload for conversion errors.
 * Emitted for both recoverable and fatal errors.
 */
export interface ConversionErrorEvent {
  /**
   * Error type for categorization:
   * - 'parse': PostParser validation failure
   * - 'transform': MarkdownTransformer failure
   * - 'image': Image download failure
   * - 'write': FileWriter failure
   * - 'fatal': Unrecoverable error (e.g., invalid export file)
   */
  type: 'parse' | 'transform' | 'image' | 'write' | 'fatal';

  /**
   * Post slug where error occurred (undefined for fatal errors)
   */
  slug?: string;

  /**
   * Error message describing what went wrong
   */
  message: string;
}

/**
 * Map of event names to their payload types.
 * Used for type-safe event subscriptions.
 */
export interface ConverterEventMap {
  'conversion-starting': ConversionStartingEvent;
  'conversion-completed': ConversionCompletedEvent;
  'image-downloaded': ImageDownloadedEvent;
  'conversion-error': ConversionErrorEvent;
}
