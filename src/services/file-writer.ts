import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Configuration options for FileWriter service
 */
export interface FileWriterConfig {
  /**
   * Whether to overwrite existing files
   * @default false - throw error if file exists
   */
  overwrite?: boolean;

  /**
   * File encoding for markdown files
   * @default 'utf8'
   */
  encoding?: BufferEncoding;

  /**
   * Enable atomic writes (write to temp file, then rename)
   * Prevents partial writes on failure
   * @default true
   */
  atomicWrites?: boolean;

  /**
   * Output mode for file organization:
   * - 'nested': Creates {slug}/index.md (default)
   * - 'flat': Creates {slug}.md directly in output directory
   * @default 'nested'
   */
  outputMode?: 'nested' | 'flat';
}

/**
 * Custom error class for file writing operations
 * Provides additional context about the failure
 */
export class FileWriteError extends Error {
  /**
   * @param message - Error description
   * @param path - File or directory path where error occurred
   * @param operation - Type of operation that failed
   * @param cause - Original error that caused this failure (uses native Error.cause)
   */
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'validate_path' | 'create_dir' | 'write_file' | 'rename_file',
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'FileWriteError';
  }
}

/**
 * Service for writing blog posts to the filesystem
 * Handles directory creation, file writing, path validation, and error handling
 */
export class FileWriter {
  /**
   * Default configuration values
   */
  private static readonly DEFAULTS: Required<FileWriterConfig> = {
    overwrite: false,
    encoding: 'utf8',
    atomicWrites: true,
    outputMode: 'nested',
  };

  /**
   * Resolved configuration with defaults applied
   */
  private readonly config: Required<FileWriterConfig>;

  constructor(config?: FileWriterConfig) {
    this.config = { ...FileWriter.DEFAULTS, ...config };
  }

  /**
   * Sanitize a slug to prevent path traversal and invalid characters
   * @param slug - Raw slug from post metadata
   * @returns Sanitized slug safe for filesystem use
   * @throws FileWriteError if slug is invalid or becomes empty after sanitization
   */
  private sanitizeSlug(slug: string): string {
    // Remove leading/trailing whitespace
    let sanitized = slug.trim();

    // Reject absolute paths
    if (sanitized.startsWith('/')) {
      throw new FileWriteError(
        `Invalid slug: absolute paths are not allowed (${slug})`,
        slug,
        'validate_path'
      );
    }

    // Reject parent directory traversal
    if (sanitized.includes('..')) {
      throw new FileWriteError(
        `Invalid slug: parent directory traversal is not allowed (${slug})`,
        slug,
        'validate_path'
      );
    }

    // Replace invalid filename characters with hyphens
    // Invalid chars: / \ : * ? " < > |
    sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '-');

    // Ensure result is not empty after sanitization
    if (sanitized.length === 0) {
      throw new FileWriteError(
        `Invalid slug: slug is empty after sanitization (original: ${slug})`,
        slug,
        'validate_path'
      );
    }

    return sanitized;
  }

  /**
   * Write content to a file atomically using temp file and rename
   * Prevents partial writes if operation fails midway
   * @param filePath - Target file path
   * @param content - Content to write
   * @throws FileWriteError if write or rename fails
   */
  private async writeFileAtomic(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    // Write to temp file first
    try {
      await fs.promises.writeFile(tempPath, content, this.config.encoding);
    } catch (error) {
      // Cleanup temp file on error (may not exist if write failed early)
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors - temp file might not exist
      }

      throw new FileWriteError(
        `Failed to write file atomically: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'write_file',
        error instanceof Error ? error : undefined
      );
    }

    // Rename to final location (atomic operation on most filesystems)
    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new FileWriteError(
        `Failed to rename temp file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'rename_file',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Write content directly to a file without atomic operations
   * @param filePath - Target file path
   * @param content - Content to write
   * @throws FileWriteError if write fails
   */
  private async writeFileDirect(filePath: string, content: string): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, content, this.config.encoding);
    } catch (error) {
      throw new FileWriteError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'write_file',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a post already exists in the output directory.
   * In nested mode, checks for directory existence.
   * In flat mode, checks for {slug}.md file existence.
   * @param outputDir - Base output directory
   * @param slug - Post slug to check
   * @returns True if post exists, false otherwise (including on errors)
   */
  postExists(outputDir: string, slug: string): boolean {
    try {
      let sanitized = this.sanitizeSlug(slug);

      // Flat mode: check for {slug}.md file
      if (this.config.outputMode === 'flat') {
        sanitized = `${sanitized}.md`;
      }

      const postPath = path.join(outputDir, sanitized);
      return fs.existsSync(postPath);
    } catch {
      // If sanitization fails, the post doesn't exist (invalid slug)
      return false;
    }
  }

  /**
   * Write a blog post with frontmatter and content to the filesystem
   * @param outputDir - Base output directory (e.g., './blog')
   * @param slug - Post slug (used as subdirectory name)
   * @param frontmatter - YAML frontmatter string (includes --- markers)
   * @param content - Markdown content body
   * @returns Absolute path to the written file
   * @throws FileWriteError if write fails or file exists (when overwrite=false)
   */
  async writePost(outputDir: string, slug: string, frontmatter: string, content: string): Promise<string> {
    // Sanitize slug for filesystem safety
    const sanitized = this.sanitizeSlug(slug);

    // Construct paths
    const postDir = path.join(outputDir, sanitized);
    const filePath = path.join(postDir, 'index.md');

    // Check if file exists and handle overwrite behavior
    if (!this.config.overwrite && fs.existsSync(filePath)) {
      throw new FileWriteError(
        `File already exists and overwrite is disabled: ${filePath}`,
        filePath,
        'write_file'
      );
    }

    // Create post directory (recursive)
    try {
      await fs.promises.mkdir(postDir, { recursive: true });
    } catch (error) {
      throw new FileWriteError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        postDir,
        'create_dir',
        error instanceof Error ? error : undefined
      );
    }

    // Combine frontmatter + content
    const markdown = frontmatter + '\n' + content;

    // Write to file using selected strategy
    if (this.config.atomicWrites) {
      await this.writeFileAtomic(filePath, markdown);
    } else {
      await this.writeFileDirect(filePath, markdown);
    }

    // Return absolute path to written file
    return path.resolve(filePath);
  }
}
