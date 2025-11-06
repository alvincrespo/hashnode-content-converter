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

  async writePost(_outputDir: string, _slug: string, _frontmatter: string, _content: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
