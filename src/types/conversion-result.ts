/**
 * Represents an error that occurred during conversion of a single post
 */
export interface ConversionError {
  /**
   * The slug of the post that failed to convert
   */
  slug: string;

  /**
   * The error message describing what went wrong
   */
  error: string;
}

/**
 * Represents a successfully converted post
 */
export interface ConvertedPost {
  /**
   * The slug of the converted post (used as identifier)
   */
  slug: string;

  /**
   * The title of the converted post
   */
  title: string;

  /**
   * The output path where the markdown file was written
   */
  outputPath: string;

  /**
   * Whether the conversion was successful
   */
  success: boolean;

  /**
   * Optional error message if conversion failed (only present if success is false)
   */
  error?: string;
}

/**
 * Result of converting a batch of Hashnode posts
 * Contains summary statistics and detailed error information
 */
export interface ConversionResult {
  /**
   * Number of posts successfully converted
   */
  converted: number;

  /**
   * Number of posts that were skipped
   */
  skipped: number;

  /**
   * Array of errors that occurred during conversion
   */
  errors: ConversionError[];

  /**
   * Human-readable duration of the conversion process
   * Example: "2.5s", "1m 30s"
   */
  duration: string;
}
