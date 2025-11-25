/**
 * Configuration options for downloading images
 */
export interface ImageDownloadOptions {
  /**
   * Maximum number of retry attempts for failed downloads.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay between retry attempts in milliseconds.
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * HTTP request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;

  /**
   * Delay between sequential downloads (for rate limiting).
   * @default 0
   */
  downloadDelayMs?: number;
}

/**
 * Configuration options for logging
 */
export interface LoggerConfig {
  /**
   * Optional file path for writing logs to disk.
   * If not provided, logs are written to console only.
   */
  filePath?: string;

  /**
   * Verbosity level for logging output.
   * @default 'normal'
   */
  verbosity?: 'quiet' | 'normal' | 'verbose';
}

/**
 * Configuration options for the conversion process
 */
export interface ConversionOptions {
  /**
   * Skip posts that already exist in the output directory.
   * When true, posts with existing directories are skipped.
   * When false, conversion will attempt to overwrite.
   * @default true
   */
  skipExisting?: boolean;

  /**
   * Image download configuration options.
   */
  downloadOptions?: ImageDownloadOptions;

  /**
   * Logger configuration options.
   */
  loggerConfig?: LoggerConfig;
}
