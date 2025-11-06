import * as fs from 'fs';
import * as path from 'path';

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
   * @param cause - Original error that caused this failure
   */
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'validate_path' | 'create_dir' | 'write_file' | 'rename_file',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileWriteError';
  }
}

/**
 * Service for writing blog posts to the filesystem
 * Handles directory creation, file writing, path validation, and error handling
 */
export class FileWriter {
  private readonly overwrite: boolean;
  private readonly encoding: BufferEncoding;
  private readonly atomicWrites: boolean;

  constructor(config?: FileWriterConfig) {
    this.overwrite = config?.overwrite ?? false;
    this.encoding = config?.encoding ?? 'utf8';
    this.atomicWrites = config?.atomicWrites ?? true;
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

    try {
      // Write to temp file
      await fs.promises.writeFile(tempPath, content, this.encoding);

      // Rename to final location (atomic operation on most filesystems)
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors - temp file might not exist
      }

      throw new FileWriteError(
        `Failed to write file atomically: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error && error.message.includes('rename') ? 'rename_file' : 'write_file',
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
      await fs.promises.writeFile(filePath, content, this.encoding);
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
   * Check if a post already exists in the output directory
   * @param outputDir - Base output directory
   * @param slug - Post slug to check
   * @returns True if post directory exists, false otherwise
   */
  postExists(outputDir: string, slug: string): boolean {
    try {
      const sanitized = this.sanitizeSlug(slug);
      const postDir = path.join(outputDir, sanitized);
      return fs.existsSync(postDir);
    } catch {
      // If sanitization fails, the post doesn't exist (invalid slug)
      return false;
    }
  }

  async writePost(_outputDir: string, _slug: string, _frontmatter: string, _content: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
