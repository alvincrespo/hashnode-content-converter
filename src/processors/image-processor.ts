import * as fs from 'node:fs';
import * as path from 'node:path';
import { ImageDownloader } from '../services/image-downloader.js';
import type {
  ImageProcessorOptions,
  ImageProcessingResult,
  ImageProcessingError,
  ImageProcessorContext,
} from '../types/image-processor.js';

/**
 * ImageProcessor handles downloading images from Hashnode CDN and updating
 * markdown references to use local file paths.
 *
 * This processor:
 * - Extracts image URLs from markdown syntax
 * - Downloads images using the ImageDownloader service
 * - Replaces CDN URLs with local relative paths
 * - Skips already-downloaded images using marker-based tracking
 * - Tracks download failures and HTTP 403 errors
 * - Implements intelligent retry: skips permanent 403s, retries transient failures
 *
 * Marker-Based Retry Strategy:
 * - Creates `.downloaded-markers/` directory in each blog post directory
 * - Tracks download attempts with marker files:
 *   - Success: Empty `.marker` file (e.g., `uuid.png.marker`)
 *   - Transient failure: `.marker` file with error message (will retry)
 *   - Permanent failure (403): `.marker.403` file (won't retry)
 *
 * @example
 * ```typescript
 * const processor = new ImageProcessor({
 *   maxRetries: 3,
 *   downloadDelayMs: 200
 * });
 *
 * const result = await processor.process(
 *   markdown,
 *   '/path/to/blog/post-slug'
 * );
 *
 * console.log(`Downloaded ${result.imagesDownloaded} images`);
 * if (result.errors.length > 0) {
 *   const forbidden = result.errors.filter(e => e.is403);
 *   console.log(`HTTP 403 errors: ${forbidden.length}`);
 * }
 * ```
 */
export class ImageProcessor {
  private downloader: ImageDownloader;
  private options: Required<ImageProcessorOptions>;

  /**
   * Create a new ImageProcessor instance.
   *
   * @param options - Configuration options for image downloading
   */
  constructor(options?: ImageProcessorOptions) {
    // Set defaults matching reference implementation
    this.options = {
      maxRetries: options?.maxRetries ?? 3,
      retryDelayMs: options?.retryDelayMs ?? 1000,
      timeoutMs: options?.timeoutMs ?? 30000,
      downloadDelayMs: options?.downloadDelayMs ?? 200,
    };

    // Create ImageDownloader with configuration
    this.downloader = new ImageDownloader({
      maxRetries: this.options.maxRetries,
      retryDelayMs: this.options.retryDelayMs,
      timeoutMs: this.options.timeoutMs,
      downloadDelayMs: this.options.downloadDelayMs,
    });
  }

  /**
   * Process markdown content: extract image URLs, download images,
   * and replace CDN URLs with local relative paths.
   *
   * Uses marker-based tracking to enable intelligent retry:
   * - Skips successfully downloaded images (file + success marker exist)
   * - Skips permanent HTTP 403 failures (403 marker exists)
   * - Retries transient failures (error marker or no marker)
   *
   * Only replaces CDN URLs with local paths on successful download.
   * Failed images keep CDN URLs, making missing images visible in rendered markdown.
   *
   * @param markdown - Markdown content from MarkdownTransformer
   * @param blogDir - Absolute path to blog post directory where images should be saved
   * @returns Processing result with updated markdown and statistics
   * @throws {Error} If blogDir doesn't exist or isn't accessible
   *
   * @example
   * ```typescript
   * const result = await processor.process(
   *   '![Image](https://cdn.hashnode.com/.../uuid.png)',
   *   '/blog/my-post'
   * );
   * // result.markdown === '![Image](./uuid.png)'
   * // result.imagesDownloaded === 1
   * ```
   */
  async process(
    markdown: string,
    blogDir: string
  ): Promise<ImageProcessingResult> {
    // Validate directory exists (DECISION 3)
    if (!fs.existsSync(blogDir)) {
      throw new Error(
        `Blog directory does not exist: ${blogDir}. ` +
          `Ensure Converter creates the directory before calling ImageProcessor.`
      );
    }

    const imageMatches = this.extractImageUrls(markdown);
    const errors: ImageProcessingError[] = [];
    let imagesDownloaded = 0;
    let imagesSkipped = 0;
    let updatedMarkdown = markdown;

    for (const [_fullMatch, url] of imageMatches) {
      // Extract filename hash using ImageDownloader static method
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

      const filepath = path.join(blogDir, filename);

      // DECISION 6: Marker-based retry strategy
      const markerPath = this.getMarkerPath(blogDir, filename);
      const marker403Path = markerPath + '.403';

      // Check if download succeeded previously (file exists + success marker exists)
      if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
        // Verify it's a success marker (empty file or very small)
        const stats = fs.statSync(markerPath);
        if (stats.size === 0) {
          imagesSkipped++;
          // Replace URL since file exists
          updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
          continue;
        }
        // If marker has content, it's a transient failure marker - fall through to retry
      }

      // Check if 403 error occurred previously (permanent failure - don't retry)
      if (fs.existsSync(marker403Path)) {
        imagesSkipped++;
        // Keep CDN URL (shows what's missing in rendered markdown)
        continue;
      }

      // Attempt download (either never attempted OR transient failure from previous run)
      try {
        const result = await this.downloader.download(url, filepath);

        if (result.success) {
          // Success: create empty marker file
          fs.writeFileSync(markerPath, '');
          imagesDownloaded++;
          // Replace URL only on successful download
          updatedMarkdown = updatedMarkdown.replace(url, `./${filename}`);
        } else if (result.is403) {
          // HTTP 403: permanent failure, create 403 marker (don't retry)
          this.recordDownloadFailure(
            filename,
            url,
            result.error || 'HTTP 403 Forbidden',
            true,
            blogDir,
            errors
          );
        } else {
          // Transient failure: create marker with error message (will retry)
          this.recordDownloadFailure(
            filename,
            url,
            result.error || 'Download failed',
            false,
            blogDir,
            errors
          );
        }
      } catch (error) {
        // Unexpected error during download: treat as transient failure
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.recordDownloadFailure(filename, url, errorMsg, false, blogDir, errors);
      }
    }

    // DECISION 5: Return detailed results
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
   * Handles trailing slash normalization to avoid double slashes.
   *
   * @param prefix - Path prefix (e.g., '/images', '/assets/', '.')
   * @param filename - Image filename (e.g., 'uuid.png')
   * @returns Normalized path (e.g., '/images/uuid.png')
   *
   * @example
   * ```typescript
   * buildImagePath('/images', 'test.png')   // '/images/test.png'
   * buildImagePath('/images/', 'test.png')  // '/images/test.png'
   * buildImagePath('.', 'test.png')         // './test.png'
   * ```
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
   *
   * This method differs from getMarkerPath() by accepting baseDir
   * parameter instead of using class instance blogDir, enabling
   * marker files in arbitrary directories (shared image folders).
   *
   * @param baseDir - Base directory for marker storage
   * @param filename - Image filename (e.g., 'uuid.png')
   * @returns Path to marker file (e.g., '/images/.downloaded-markers/uuid.png.marker')
   */
  private getMarkerPathForDir(baseDir: string, filename: string): string {
    const markersDir = path.join(baseDir, '.downloaded-markers');

    // Ensure markers directory exists
    if (!fs.existsSync(markersDir)) {
      fs.mkdirSync(markersDir, { recursive: true });
    }

    return path.join(markersDir, `${filename}.marker`);
  }

  /**
   * Record download failure with marker in specified directory.
   *
   * This method differs from recordDownloadFailure() by accepting baseDir
   * parameter, enabling error markers in arbitrary directories.
   *
   * Marker paths:
   * - Permanent (403): `{filename}.marker.403` - won't retry on re-run
   * - Transient: `{filename}.marker` with error message - will retry on re-run
   *
   * @param filename - Image filename (e.g., 'uuid.png')
   * @param url - Original CDN URL that failed
   * @param errorMessage - Error description to store in marker
   * @param isPermanent403 - If true, creates .403 marker; if false, creates regular marker
   * @param baseDir - Base directory for marker storage
   * @param errors - Error collection array to append to
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

  /**
   * Check image status based on existing markers.
   * Determines if image should be skipped (success/403) or retried.
   *
   * @param filepath - Path to image file
   * @param markerPath - Path to success marker
   * @param marker403Path - Path to 403 marker
   * @returns Status object with shouldSkip flag and reason
   */
  private checkImageStatus(
    filepath: string,
    markerPath: string,
    marker403Path: string
  ): { shouldSkip: boolean; reason: 'success' | '403' | 'retry' } {
    // Check if download succeeded previously
    if (fs.existsSync(filepath) && fs.existsSync(markerPath)) {
      const stats = fs.statSync(markerPath);
      if (stats.size === 0) {
        // Empty marker = success
        return { shouldSkip: true, reason: 'success' };
      }
      // Non-empty marker = transient failure, retry
    }

    // Check for permanent 403 failure
    if (fs.existsSync(marker403Path)) {
      return { shouldSkip: true, reason: '403' };
    }

    // No markers or transient failure marker - should retry
    return { shouldSkip: false, reason: 'retry' };
  }

  /**
   * Handle download result and create appropriate markers.
   * Processes success, 403, and transient failure cases.
   *
   * @param result - Download result from ImageDownloader
   * @param filename - Image filename
   * @param url - Original CDN URL
   * @param markerPath - Path to marker file
   * @param effectiveMarkerDir - Directory for marker files
   * @param errors - Error collection array
   * @returns True if download succeeded, false otherwise
   */
  private handleDownloadResult(
    result: { success: boolean; is403?: boolean; error?: string },
    filename: string,
    url: string,
    markerPath: string,
    effectiveMarkerDir: string,
    errors: ImageProcessingError[]
  ): boolean {
    if (result.success) {
      // Success: create empty marker file
      fs.writeFileSync(markerPath, '');
      return true;
    } else if (result.is403) {
      // HTTP 403: permanent failure, create 403 marker
      this.recordDownloadFailureForDir(
        filename,
        url,
        result.error || 'HTTP 403 Forbidden',
        true,
        effectiveMarkerDir,
        errors
      );
    } else {
      // Transient failure: create marker with error message
      this.recordDownloadFailureForDir(
        filename,
        url,
        result.error || 'Download failed',
        false,
        effectiveMarkerDir,
        errors
      );
    }
    return false;
  }

  /**
   * Process a single image URL with context.
   * Handles filename extraction, marker checking, downloading, and markdown replacement.
   *
   * @param url - CDN image URL to process
   * @param fullMatch - Full markdown match (for replacement)
   * @param imageDir - Directory for image storage
   * @param imagePathPrefix - Path prefix for markdown references
   * @param effectiveMarkerDir - Directory for marker files
   * @param errors - Error collection array
   * @returns Object with updated markdown fragment, downloaded count, and skipped count
   */
  private async processSingleImage(
    url: string,
    fullMatch: string,
    imageDir: string,
    imagePathPrefix: string,
    effectiveMarkerDir: string,
    errors: ImageProcessingError[]
  ): Promise<{ markdown: string; downloaded: number; skipped: number }> {
    // Extract filename hash
    const filename = ImageDownloader.extractHash(url);

    if (!filename) {
      errors.push({
        filename: 'unknown',
        url,
        error: 'Could not extract hash from URL',
        is403: false,
      });
      return { markdown: fullMatch, downloaded: 0, skipped: 0 };
    }

    const filepath = path.join(imageDir, filename);
    const markerPath = this.getMarkerPathForDir(effectiveMarkerDir, filename);
    const marker403Path = markerPath + '.403';
    const localPath = this.buildImagePath(imagePathPrefix, filename);

    // Check if should skip this image
    const status = this.checkImageStatus(filepath, markerPath, marker403Path);

    if (status.shouldSkip) {
      if (status.reason === 'success') {
        // Replace URL with local path
        return { markdown: localPath, downloaded: 0, skipped: 1 };
      }
      // 403 - keep CDN URL
      return { markdown: fullMatch, downloaded: 0, skipped: 1 };
    }

    // Attempt download
    try {
      const result = await this.downloader.download(url, filepath);
      const downloadedSuccessfully = this.handleDownloadResult(
        result,
        filename,
        url,
        markerPath,
        effectiveMarkerDir,
        errors
      );

      if (downloadedSuccessfully) {
        return { markdown: localPath, downloaded: 1, skipped: 0 };
      }
      // Download failed - keep CDN URL
      return { markdown: fullMatch, downloaded: 0, skipped: 0 };
    } catch (error) {
      // Unexpected error during download
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordDownloadFailureForDir(filename, url, errorMsg, false, effectiveMarkerDir, errors);
      return { markdown: fullMatch, downloaded: 0, skipped: 0 };
    }
  }

  /**
   * Process all images in markdown content.
   * Extracts image URLs and processes each one with context.
   *
   * @param markdown - Markdown content with image URLs
   * @param imageDir - Directory for image storage
   * @param imagePathPrefix - Path prefix for markdown references
   * @param effectiveMarkerDir - Directory for marker files
   * @returns Processing result with updated markdown and statistics
   */
  private async processImages(
    markdown: string,
    imageDir: string,
    imagePathPrefix: string,
    effectiveMarkerDir: string
  ): Promise<ImageProcessingResult> {
    const imageMatches = this.extractImageUrls(markdown);
    const errors: ImageProcessingError[] = [];
    let imagesDownloaded = 0;
    let imagesSkipped = 0;
    let updatedMarkdown = markdown;

    for (const [fullMatch, url] of imageMatches) {
      const result = await this.processSingleImage(
        url,
        fullMatch,
        imageDir,
        imagePathPrefix,
        effectiveMarkerDir,
        errors
      );

      // Replace the matched URL in markdown
      updatedMarkdown = updatedMarkdown.replace(fullMatch, result.markdown);
      imagesDownloaded += result.downloaded;
      imagesSkipped += result.skipped;
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
   * Process markdown with explicit image context.
   * Used for flat mode where images go to a shared directory.
   *
   * This method provides explicit control over:
   * - Image storage directory (not inferred from post structure)
   * - Image path prefix for markdown references (configurable for different SSGs)
   * - Optional custom marker directory (defaults to imageDir)
   *
   * Uses marker-based tracking for intelligent retry:
   * - Skips successfully downloaded images (file + success marker exist)
   * - Skips permanent HTTP 403 failures (403 marker exists)
   * - Retries transient failures (error marker or no marker)
   *
   * Differences from process():
   * - Accepts ImageProcessorContext instead of blogDir string
   * - Uses context.imagePathPrefix instead of hardcoded './'
   * - Validates imageDir exists (caller must create it)
   * - Supports custom marker directory for shared image deduplication
   *
   * @param markdown - The markdown content to process
   * @param context - Image processing context with directory and path prefix
   * @returns Processing result with updated markdown and statistics
   * @throws {Error} If imageDir does not exist
   *
   * @example
   * ```typescript
   * // Flat mode: images to shared directory
   * const result = await processor.processWithContext(markdown, {
   *   imageDir: '/blog/_images',
   *   imagePathPrefix: '/images',
   * });
   * // result.markdown contains: ![alt](/images/uuid.png)
   * ```
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

    // Process all images using helper method
    return this.processImages(markdown, imageDir, imagePathPrefix, effectiveMarkerDir);
  }

  /**
   * Extract all Hashnode CDN image URLs from markdown content.
   *
   * @param markdown - Markdown content to parse
   * @returns Array of [fullMatch, imageUrl] tuples
   *
   * @example
   * ```typescript
   * const matches = this.extractImageUrls('![alt](https://cdn.hashnode.com/.../image.png)');
   * // Returns: [['![alt](https://...)', 'https://...']]
   * ```
   */
  private extractImageUrls(markdown: string): Array<[string, string]> {
    // Regex pattern from reference implementation (convert-hashnode.js:245)
    // Matches: ![any-text](https://cdn.hashnode.com/any-path)
    const imageRegex = /!\[[^\]]*\]\((https:\/\/cdn\.hashnode\.com[^)]+)\)/g;

    const matches: Array<[string, string]> = [];
    let match: RegExpExecArray | null;

    while ((match = imageRegex.exec(markdown)) !== null) {
      matches.push([match[0], match[1]]);
    }

    return matches;
  }

  /**
   * Get path to marker file for tracking download status.
   * Creates .downloaded-markers/ directory if it doesn't exist.
   *
   * Marker types:
   * - Empty file: Successful download (skip on re-run)
   * - File with content: Transient failure (retry on re-run)
   * - File with .403 extension: Permanent HTTP 403 failure (skip on re-run)
   *
   * @param blogDir - Blog post directory
   * @param filename - Image filename (e.g., "uuid.png")
   * @returns Path to marker file
   */
  private getMarkerPath(blogDir: string, filename: string): string {
    const markersDir = path.join(blogDir, '.downloaded-markers');

    // Ensure markers directory exists
    if (!fs.existsSync(markersDir)) {
      fs.mkdirSync(markersDir, { recursive: true });
    }

    return path.join(markersDir, `${filename}.marker`);
  }

  /**
   * Record a download failure by creating a marker file and tracking the error.
   *
   * This method centralizes error handling for failed image downloads. It creates
   * the appropriate marker file (regular or .403) and adds the error to the tracking array.
   *
   * Marker paths:
   * - Permanent (403): `{filename}.marker.403` - won't retry on re-run
   * - Transient: `{filename}.marker` with error message - will retry on re-run
   *
   * @param filename - Image filename (e.g., "uuid.png")
   * @param url - Original CDN URL that failed
   * @param errorMessage - Error description to store in marker
   * @param isPermanent403 - If true, creates .403 marker; if false, creates regular marker
   * @param blogDir - Blog post directory
   * @param errors - Error collection array to append to
   */
  private recordDownloadFailure(
    filename: string,
    url: string,
    errorMessage: string,
    isPermanent403: boolean,
    blogDir: string,
    errors: ImageProcessingError[]
  ): void {
    const markerPath = this.getMarkerPath(blogDir, filename);
    const filePath = isPermanent403 ? `${markerPath}.403` : markerPath;

    fs.writeFileSync(filePath, errorMessage);
    errors.push({
      filename,
      url,
      error: errorMessage,
      is403: isPermanent403,
    });
  }
}
