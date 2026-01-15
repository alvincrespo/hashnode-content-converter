import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PostParser } from './processors/post-parser.js';
import { MarkdownTransformer } from './processors/markdown-transformer.js';
import { ImageProcessor } from './processors/image-processor.js';
import { FrontmatterGenerator } from './processors/frontmatter-generator.js';
import { FileWriter } from './services/file-writer.js';
import { Logger } from './services/logger.js';

import type { HashnodePost, HashnodeExport } from './types/hashnode-schema.js';
import type { ConversionOptions, OutputStructure, ConverterConfig } from './types/converter-options.js';
import type { ConversionResult, ConvertedPost, ConversionError } from './types/conversion-result.js';
import type {
  ConverterEventMap,
  ConversionStartingEvent,
  ConversionCompletedEvent,
  ImageDownloadedEvent,
  ConversionErrorEvent,
} from './types/converter-events.js';

/**
 * Optional dependencies for testing via dependency injection
 */
export interface ConverterDependencies {
  postParser?: PostParser;
  markdownTransformer?: MarkdownTransformer;
  imageProcessor?: ImageProcessor;
  frontmatterGenerator?: FrontmatterGenerator;
  fileWriter?: FileWriter;
  logger?: Logger;

  /**
   * Instance-level configuration (output structure, etc.)
   * Separate from runtime ConversionOptions
   */
  config?: ConverterConfig;
}

/**
 * Converter orchestrates the Hashnode export conversion pipeline.
 *
 * The conversion pipeline processes each post through:
 * 1. PostParser - Extract and validate metadata from Hashnode post
 * 2. MarkdownTransformer - Clean Hashnode-specific markdown quirks
 * 3. ImageProcessor - Download images and replace CDN URLs with local paths
 * 4. FrontmatterGenerator - Generate YAML frontmatter from metadata
 * 5. FileWriter - Write the final markdown file to disk
 *
 * The Converter extends EventEmitter to provide observable progress tracking.
 * Consumers can subscribe to events for progress bars, custom logging, or
 * integration with external systems.
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
 * converter.on('conversion-completed', ({ result, durationMs }) => {
 *   console.log(`Completed in ${durationMs}ms: ${result.title}`);
 * });
 *
 * // Error handling
 * converter.on('conversion-error', ({ type, slug, message }) => {
 *   console.error(`[${type}] ${slug}: ${message}`);
 * });
 *
 * const result = await converter.convertAllPosts('./export.json', './blog');
 * console.log(`Converted ${result.converted} posts`);
 * ```
 */
export class Converter extends EventEmitter {
  /**
   * Default dependencies used when not provided via dependency injection.
   * Follows the same pattern as FileWriter.DEFAULTS for consistency.
   */
  private static readonly DEFAULTS: Required<Omit<ConverterDependencies, 'logger' | 'config'>> = {
    postParser: new PostParser(),
    markdownTransformer: new MarkdownTransformer(),
    imageProcessor: new ImageProcessor(),
    frontmatterGenerator: new FrontmatterGenerator(),
    fileWriter: new FileWriter(),
  };

  /**
   * Default configuration when not provided.
   */
  private static readonly DEFAULT_CONFIG: Required<ConverterConfig> = {
    outputStructure: { mode: 'nested' },
  };

  private postParser: PostParser;
  private markdownTransformer: MarkdownTransformer;
  private imageProcessor: ImageProcessor;
  private frontmatterGenerator: FrontmatterGenerator;
  private fileWriter: FileWriter;
  private logger: Logger | null = null;

  /**
   * Output structure configuration set at instance creation.
   * Determines file naming and image storage location.
   */
  private readonly outputStructure: OutputStructure;

  /**
   * Create a new Converter instance.
   *
   * @param deps - Optional dependencies for testing (dependency injection)
   */
  constructor(deps?: ConverterDependencies) {
    super();

    // Resolve config with defaults
    const config = { ...Converter.DEFAULT_CONFIG, ...deps?.config };
    this.outputStructure = config.outputStructure;

    // Determine output mode based on config
    const outputMode = this.outputStructure.mode === 'flat' ? 'flat' : 'nested';

    // Resolve dependencies with defaults
    // Special handling for FileWriter: create with correct outputMode if not provided
    const defaultFileWriter = new FileWriter({ outputMode });
    const resolved = {
      ...Converter.DEFAULTS,
      fileWriter: defaultFileWriter, // Override DEFAULTS.fileWriter with mode-specific one
      ...deps, // User-provided deps override everything
    };

    // Assign resolved dependencies
    this.postParser = resolved.postParser;
    this.markdownTransformer = resolved.markdownTransformer;
    this.imageProcessor = resolved.imageProcessor;
    this.frontmatterGenerator = resolved.frontmatterGenerator;
    this.fileWriter = resolved.fileWriter;

    // Logger is optional (can be null)
    // Initialized per-conversion in convertAllPosts to allow fresh timestamp and configuration
    if (resolved.logger) {
      this.logger = resolved.logger;
    }
  }

  // ==================== Static Factory Methods ====================

  /**
   * Quick conversion of a Hashnode export file.
   * Creates a Converter and runs the full pipeline.
   *
   * This is the simplest way to convert a Hashnode export:
   *
   * @param exportPath - Path to Hashnode export JSON file
   * @param outputDir - Output directory for converted posts
   * @param options - Optional conversion options
   * @returns Conversion result with statistics
   *
   * @example
   * ```typescript
   * // One-liner conversion
   * const result = await Converter.fromExportFile('./export.json', './blog');
   * console.log(`Converted ${result.converted} posts`);
   *
   * // With options
   * const result = await Converter.fromExportFile('./export.json', './blog', {
   *   skipExisting: false,
   *   downloadOptions: { downloadDelayMs: 100 }
   * });
   * ```
   */
  static async fromExportFile(
    exportPath: string,
    outputDir: string,
    options?: ConversionOptions,
    config?: ConverterConfig
  ): Promise<ConversionResult> {
    const converter = new Converter({ config });
    return converter.convertAllPosts(exportPath, outputDir, options);
  }

  /**
   * Create a Converter with a simple progress callback.
   * Provides a simpler alternative to the full event API.
   *
   * The callback is invoked before each post conversion starts,
   * receiving the current index (1-based), total count, and post title.
   *
   * @param onProgress - Callback invoked before each post conversion
   * @param deps - Optional dependencies for customization
   * @returns Configured Converter instance with progress handler attached
   *
   * @example
   * ```typescript
   * // Simple progress logging
   * const converter = Converter.withProgress((current, total, title) => {
   *   console.log(`[${current}/${total}] ${title}`);
   * });
   * const result = await converter.convertAllPosts('./export.json', './blog');
   *
   * // With custom dependencies
   * const converter = Converter.withProgress(
   *   (i, n, t) => progressBar.update(i / n),
   *   { logger: customLogger }
   * );
   * ```
   */
  static withProgress(
    onProgress: (current: number, total: number, title: string) => void,
    deps?: ConverterDependencies
  ): Converter {
    const converter = new Converter(deps);
    converter.on('conversion-starting', ({ index, total, post }) => {
      onProgress(index, total, post.title);
    });
    return converter;
  }

  // ==================== Event Methods ====================

  /**
   * Type-safe event subscription.
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke
   */
  on<K extends keyof ConverterEventMap>(
    event: K,
    listener: (payload: ConverterEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe single-event subscription.
   * @param event - Event name to listen for
   * @param listener - Callback function to invoke once
   */
  once<K extends keyof ConverterEventMap>(
    event: K,
    listener: (payload: ConverterEventMap[K]) => void
  ): this {
    return super.once(event, listener);
  }

  /**
   * Type-safe event emission.
   * @param event - Event name to emit
   * @param payload - Event payload data
   */
  emit<K extends keyof ConverterEventMap>(event: K, payload: ConverterEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  /**
   * Convert all posts from a Hashnode export file.
   *
   * Reads the export JSON, processes each post through the conversion pipeline,
   * and writes the results to the output directory. Posts that already exist
   * are skipped by default (configurable via `skipExisting` option).
   *
   * @param exportPath - Path to the Hashnode export JSON file
   * @param outputDir - Directory to write converted posts
   * @param options - Conversion options
   * @returns Conversion result with statistics
   *
   * @fires conversion-starting - Before each post conversion begins
   * @fires conversion-completed - After each post conversion completes
   * @fires image-downloaded - After each image download attempt
   * @fires conversion-error - When any error occurs during conversion
   *
   * @throws {Error} If export file doesn't exist or is invalid JSON
   * @throws {Error} If posts array is missing from export
   * @throws {Error} If output directory cannot be created
   */
  async convertAllPosts(
    exportPath: string,
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    // Apply default for skipExisting (true by default)
    const effectiveOptions: ConversionOptions = {
      ...options,
      skipExisting: options?.skipExisting ?? true,
    };

    // Initialize Logger (always create by default)
    this.initializeLogger(effectiveOptions);

    // Load and validate export file (throws on fatal errors)
    const posts = this.loadAndValidateExport(exportPath);

    // Ensure output directory exists (throws on fatal errors)
    this.ensureOutputDirectory(outputDir);

    // Initialize result tracking
    const errors: ConversionError[] = [];
    let converted = 0;
    let skipped = 0;

    this.logger?.info(`Found ${posts.length} posts to convert`);

    // Process each post with error isolation
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const index = i + 1;
      const total = posts.length;
      const postStartTime = Date.now();

      // Extract slug safely for error tracking (handles malformed posts)
      const slug = this.extractSlugSafely(post, i);

      // Emit conversion-starting event
      const startEvent: ConversionStartingEvent = { post, index, total };
      this.emit('conversion-starting', startEvent);

      try {
        // Check if post should be skipped (already exists)
        if (effectiveOptions.skipExisting && this.fileWriter.postExists(outputDir, slug)) {
          skipped++;
          this.logger?.info(`[${index}/${total}] Skipped: "${post.title || slug}" (already exists)`);

          // Emit completion event for skipped post
          const skipResult: ConvertedPost = {
            slug,
            title: post.title || slug,
            outputPath: path.join(outputDir, slug, 'index.md'),
            success: true,
          };
          const completeEvent: ConversionCompletedEvent = {
            result: skipResult,
            index,
            total,
            durationMs: Date.now() - postStartTime,
          };
          this.emit('conversion-completed', completeEvent);
          continue;
        }

        // Convert the post through the pipeline
        const result = await this.convertPost(post, outputDir, effectiveOptions);

        if (result.success) {
          converted++;
          this.logger?.success(`[${index}/${total}] Converted: "${result.title}"`);
        } else {
          errors.push({ slug: result.slug, error: result.error || 'Unknown error' });
          this.logger?.error(`[${index}/${total}] Failed: "${result.title}" - ${result.error}`);
        }

        // Emit completion event
        const completeEvent: ConversionCompletedEvent = {
          result,
          index,
          total,
          durationMs: Date.now() - postStartTime,
        };
        this.emit('conversion-completed', completeEvent);
      } catch (error) {
        // Catch any unhandled errors, log, and continue
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ slug, error: errorMessage });
        this.logger?.error(`[${index}/${total}] Error processing "${slug}": ${errorMessage}`);

        // Emit error event
        const errorEvent: ConversionErrorEvent = {
          type: 'fatal',
          slug,
          message: errorMessage,
        };
        this.emit('conversion-error', errorEvent);

        // Emit completion event with failure
        const failResult: ConvertedPost = {
          slug,
          title: post.title || slug,
          outputPath: '',
          success: false,
          error: errorMessage,
        };
        const completeEvent: ConversionCompletedEvent = {
          result: failResult,
          index,
          total,
          durationMs: Date.now() - postStartTime,
        };
        this.emit('conversion-completed', completeEvent);
      }
    }

    // Calculate duration
    const duration = this.formatDuration(Date.now() - startTime);

    // Write summary and close logger
    this.logger?.writeSummary(converted, skipped, errors.length);
    await this.logger?.close();

    return {
      converted,
      skipped,
      errors,
      duration,
    };
  }

  /**
   * Convert a single Hashnode post.
   *
   * Runs the post through the full conversion pipeline:
   * PostParser -> MarkdownTransformer -> ImageProcessor -> FrontmatterGenerator -> FileWriter
   *
   * @param post - The Hashnode post to convert
   * @param outputDir - Directory to write the converted post
   * @param options - Conversion options
   * @returns Converted post result (success or failure)
   *
   * @fires image-downloaded - After each image download attempt
   * @fires conversion-error - When error occurs during conversion
   */
  async convertPost(
    post: HashnodePost,
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConvertedPost> {
    const slug = this.extractSlugSafely(post, 0);

    // Route to appropriate handler based on instance-level output mode
    if (this.outputStructure.mode === 'flat') {
      return this.convertPostFlat(post, slug, outputDir, options, this.outputStructure);
    } else {
      return this.convertPostNested(post, slug, outputDir, options);
    }
  }

  /**
   * Convert a single post using nested output mode.
   * Creates {slug}/index.md with images in the same directory.
   *
   * @private
   */
  private async convertPostNested(
    post: HashnodePost,
    slug: string,
    outputDir: string,
    options?: ConversionOptions
  ): Promise<ConvertedPost> {
    try {
      // Step 1: Parse post metadata
      const metadata = this.postParser.parse(post);

      // Step 2: Transform markdown (remove Hashnode quirks)
      const transformedMarkdown = this.markdownTransformer.transform(metadata.contentMarkdown);

      // Step 3: Create post directory for images
      const imageDir = path.join(outputDir, metadata.slug);
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      // Step 4: Process images (download and replace URLs)
      // Note: Creating a new ImageProcessor with custom downloadOptions is safe because
      // download state is persisted via .downloaded-markers/ files on disk, not in-memory.
      // A new instance will read existing markers and skip already-downloaded images.
      // Custom options only affect retry behavior for new/failed downloads.
      const imageProcessor =
        options?.downloadOptions
          ? new ImageProcessor(options.downloadOptions)
          : this.imageProcessor;

      const imageResult = await imageProcessor.process(transformedMarkdown, imageDir);

      // Emit image-downloaded events
      this.emitImageDownloadedEvents(imageResult, metadata.slug);

      // Track HTTP 403 errors with Logger
      this.trackHttp403Errors(imageResult.errors, metadata.slug);

      // Step 5: Generate frontmatter
      const frontmatter = this.frontmatterGenerator.generate(metadata);

      // Step 6: Write file to {slug}/index.md
      const outputPath = await this.fileWriter.writePost(
        outputDir,
        metadata.slug,
        frontmatter,
        imageResult.markdown
      );

      return {
        slug: metadata.slug,
        title: metadata.title,
        outputPath,
        success: true,
      };
    } catch (error) {
      return this.handleConversionError(error, slug, post);
    }
  }

  /**
   * Convert a single post using flat output mode.
   * Creates {slug}.md with images in a shared sibling directory.
   *
   * @private
   */
  private async convertPostFlat(
    post: HashnodePost,
    slug: string,
    outputDir: string,
    options: ConversionOptions | undefined,
    outputStructure: OutputStructure
  ): Promise<ConvertedPost> {
    try {
      // Step 1: Parse post metadata
      const metadata = this.postParser.parse(post);

      // Step 2: Transform markdown (remove Hashnode quirks)
      const transformedMarkdown = this.markdownTransformer.transform(metadata.contentMarkdown);

      // Step 3: Determine shared image directory
      const parentDir = path.dirname(outputDir);
      const imageFolderName = outputStructure.imageFolderName ?? '_images';
      const imageDir = path.join(parentDir, imageFolderName);
      const imagePathPrefix = outputStructure.imagePathPrefix ?? '/images';

      // Create shared image directory if it doesn't exist
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      // Step 4: Process images (download and replace URLs)
      // Note: Creating a new ImageProcessor with custom downloadOptions is safe because
      // download state is persisted via .downloaded-markers/ files on disk, not in-memory.
      // A new instance will read existing markers and skip already-downloaded images.
      // Custom options only affect retry behavior for new/failed downloads.
      const imageProcessor =
        options?.downloadOptions
          ? new ImageProcessor(options.downloadOptions)
          : this.imageProcessor;

      const imageResult = await imageProcessor.processWithContext(transformedMarkdown, {
        imageDir,
        imagePathPrefix,
      });

      // Emit image-downloaded events
      this.emitImageDownloadedEvents(imageResult, metadata.slug);

      // Track HTTP 403 errors with Logger
      this.trackHttp403Errors(imageResult.errors, metadata.slug);

      // Step 5: Generate frontmatter
      const frontmatter = this.frontmatterGenerator.generate(metadata);

      // Step 6: Write file to {slug}.md using instance FileWriter (configured for flat mode)
      const outputPath = await this.fileWriter.writePost(
        outputDir,
        metadata.slug,
        frontmatter,
        imageResult.markdown
      );

      return {
        slug: metadata.slug,
        title: metadata.title,
        outputPath,
        success: true,
      };
    } catch (error) {
      return this.handleConversionError(error, slug, post);
    }
  }

  /**
   * Handle conversion errors consistently across both modes.
   *
   * @private
   */
  private handleConversionError(
    error: unknown,
    slug: string,
    post: HashnodePost
  ): ConvertedPost {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type based on error source
    let errorType: ConversionErrorEvent['type'] = 'fatal';
    if (errorMessage.includes('Parse error') || errorMessage.includes('Missing required field')) {
      errorType = 'parse';
    } else if (errorMessage.includes('Transform error')) {
      errorType = 'transform';
    } else if (
      errorMessage.includes('Failed to write') ||
      errorMessage.includes('create directory') ||
      errorMessage.includes('Image directory does not exist')
    ) {
      errorType = 'write';
    }

    // Emit error event
    const errorEvent: ConversionErrorEvent = {
      type: errorType,
      slug,
      message: errorMessage,
    };
    this.emit('conversion-error', errorEvent);

    return {
      slug,
      title: post.title || slug,
      outputPath: '',
      success: false,
      error: errorMessage,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Initialize Logger service.
   * Always creates a logger by default (matches reference implementation).
   */
  private initializeLogger(options?: ConversionOptions): void {
    // Don't reinitialize if already injected via constructor
    if (this.logger) {
      return;
    }

    // Create logger with provided config or defaults
    this.logger = new Logger(options?.loggerConfig);
  }

  /**
   * Load and validate the Hashnode export JSON file.
   * @throws {Error} If file doesn't exist, is invalid JSON, or missing posts array
   */
  private loadAndValidateExport(exportPath: string): HashnodePost[] {
    // Check file exists
    if (!fs.existsSync(exportPath)) {
      const error = `Export file not found: ${exportPath}`;
      this.emitFatalError(error);
      throw new Error(error);
    }

    // Read and parse JSON
    let exportData: unknown;
    try {
      const content = fs.readFileSync(exportPath, 'utf8');
      exportData = JSON.parse(content);
    } catch (error) {
      const message = `Invalid JSON in export file: ${error instanceof Error ? error.message : 'Parse error'}`;
      this.emitFatalError(message);
      throw new Error(message, { cause: error });
    }

    // Validate structure
    if (!exportData || typeof exportData !== 'object') {
      const error = 'Export file must contain a JSON object';
      this.emitFatalError(error);
      throw new Error(error);
    }

    const data = exportData as HashnodeExport;
    if (!data.posts || !Array.isArray(data.posts)) {
      const error = 'Export file must contain a "posts" array';
      this.emitFatalError(error);
      throw new Error(error);
    }

    if (data.posts.length === 0) {
      this.logger?.warn('Export file contains no posts');
    }

    return data.posts;
  }

  /**
   * Ensure output directory exists, create if necessary.
   * @throws {Error} If directory cannot be created
   */
  private ensureOutputDirectory(outputDir: string): void {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (error) {
      const message = `Cannot create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.emitFatalError(message);
      throw new Error(message, { cause: error });
    }
  }

  /**
   * Extract slug safely from post for error tracking.
   * Falls back to index-based identifier if slug extraction fails.
   */
  private extractSlugSafely(post: unknown, index: number): string {
    if (post && typeof post === 'object') {
      const p = post as Record<string, unknown>;
      if (typeof p.slug === 'string' && p.slug.trim().length > 0) {
        return p.slug.trim();
      }
    }
    return `unknown-post-${index}`;
  }

  /**
   * Format duration in human-readable format (Xm Ys or Xs).
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Emit fatal error event.
   */
  private emitFatalError(message: string): void {
    const errorEvent: ConversionErrorEvent = {
      type: 'fatal',
      message,
    };
    this.emit('conversion-error', errorEvent);
  }

  /**
   * Emit image-downloaded events based on ImageProcessingResult.
   */
  private emitImageDownloadedEvents(
    imageResult: {
      imagesDownloaded: number;
      imagesSkipped: number;
      errors: Array<{ filename: string; url: string; error: string; is403: boolean }>;
    },
    postSlug: string
  ): void {
    // Emit success events for downloaded images
    for (let i = 0; i < imageResult.imagesDownloaded; i++) {
      const event: ImageDownloadedEvent = {
        filename: `image-${i + 1}`,
        postSlug,
        success: true,
      };
      this.emit('image-downloaded', event);
    }

    // Emit error events for failed images
    imageResult.errors.forEach((err) => {
      const event: ImageDownloadedEvent = {
        filename: err.filename,
        postSlug,
        success: false,
        error: err.error,
        is403: err.is403,
      };
      this.emit('image-downloaded', event);
    });
  }

  /**
   * Track HTTP 403 errors via Logger for summary reporting.
   */
  private trackHttp403Errors(
    errors: Array<{ filename: string; url: string; is403: boolean }>,
    slug: string
  ): void {
    errors
      .filter((err) => err.is403)
      .forEach((err) => {
        this.logger?.trackHttp403(slug, err.filename, err.url);
      });
  }
}
