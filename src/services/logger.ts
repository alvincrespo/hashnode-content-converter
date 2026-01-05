import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /**
   * Path to log file (optional)
   * If not provided, auto-generates timestamped filename
   * If verbosity is 'quiet', no file logging occurs
   */
  filePath?: string;

  /**
   * Logging verbosity level
   * - 'quiet': Console-only, no file output
   * - 'normal': Standard dual output (default)
   * - 'verbose': Reserved for future use (currently behaves like 'normal')
   */
  verbosity?: 'quiet' | 'normal' | 'verbose';
}

/**
 * HTTP 403 error tracking structure
 */
export interface Http403Error {
  slug: string;
  filename: string;
  url: string;
  timestamp: string;
}

/**
 * Logger service for dual-output logging (console + file)
 * Tracks conversion progress, errors, and generates summaries
 */
export class Logger {
  private logFilePath: string | null;
  private fileStream: fs.WriteStream | null;
  private http403Errors: Http403Error[];
  private startTime: number;
  private verbosity: 'quiet' | 'normal' | 'verbose';

  /**
   * Create a new Logger instance
   * @param config - Optional logger configuration
   */
  constructor(config?: LoggerConfig) {
    this.verbosity = config?.verbosity || 'normal';
    // Note: 'verbose' mode is reserved for future enhancements
    // Currently behaves identically to 'normal' mode
    this.http403Errors = [];
    this.startTime = Date.now();
    this.fileStream = null;
    this.logFilePath = null;

    // Initialize file logging if not in quiet mode
    if (this.verbosity !== 'quiet') {
      this.logFilePath = config?.filePath || this.generateLogFileName();
      try {
        this.fileStream = fs.createWriteStream(this.logFilePath, {
          flags: 'a',
          encoding: 'utf8',
        });

        // Handle stream errors
        this.fileStream.on('error', (err) => {
          console.warn(
            `Warning: File logging failed (${err.message}). Continuing with console-only.`
          );
          this.fileStream = null;
        });

        // Write header
        this.writeHeader();
      } catch (err) {
        console.warn(
          `Warning: Could not create log file (${err instanceof Error ? err.message : 'unknown error'}). Continuing with console-only.`
        );
        this.fileStream = null;
      }
    }
  }

  /**
   * Generate a timestamped log filename
   * @returns Log filename with timestamp
   */
  private generateLogFileName(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    return path.join(process.cwd(), `conversion-${timestamp}.log`);
  }

  /**
   * Get formatted timestamp for log entries
   * @returns Formatted time string (HH:MM:SS AM/PM)
   */
  private getTimestamp(): string {
    return new Date().toLocaleTimeString();
  }

  /**
   * Calculate duration since logger start
   * @returns Formatted duration string (Xm Ys)
   */
  private getDuration(): string {
    const elapsedMs = Date.now() - this.startTime;
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Write header to log file
   */
  private writeHeader(): void {
    if (!this.fileStream) return;

    const divider = '='.repeat(80);
    const header = `${divider}\nHashnode Export Conversion Log\nStarted: ${new Date().toLocaleString()}\n${divider}\n\n`;
    this.fileStream.write(header);
  }

  /**
   * Log an informational message
   * @param message - Message to log
   */
  info(message: string): void {
    console.log(message);

    if (this.fileStream) {
      const timestamp = this.getTimestamp();
      this.fileStream.write(`[${timestamp}] INFO    | ${message}\n`);
    }
  }

  /**
   * Log a success message
   * @param message - Success message to log
   */
  success(message: string): void {
    console.log(message);

    if (this.fileStream) {
      const timestamp = this.getTimestamp();
      this.fileStream.write(`[${timestamp}] SUCCESS | ${message}\n`);
    }
  }

  /**
   * Log a warning message
   * @param message - Warning message to log
   */
  warn(message: string): void {
    console.warn(message);

    if (this.fileStream) {
      const timestamp = this.getTimestamp();
      this.fileStream.write(`[${timestamp}] WARN    | ${message}\n`);
    }
  }

  /**
   * Log an error message
   * @param message - Error message to log
   */
  error(message: string): void {
    console.error(message);

    if (this.fileStream) {
      const timestamp = this.getTimestamp();
      this.fileStream.write(`[${timestamp}] ERROR   | ${message}\n`);
    }
  }

  /**
   * Track an HTTP 403 error for detailed reporting
   * @param slug - Post slug where error occurred
   * @param filename - Image filename that failed
   * @param url - CDN URL that returned 403
   */
  trackHttp403(slug: string, filename: string, url: string): void {
    this.http403Errors.push({
      slug,
      filename,
      url,
      timestamp: this.getTimestamp(),
    });
  }

  /**
   * Write detailed HTTP 403 error section
   */
  private writeHttp403Section(): void {
    const divider = '='.repeat(80);
    const uniquePosts = new Set(this.http403Errors.map((e) => e.slug)).size;
    const header = `\n${divider}\nHTTP 403 IMAGE FAILURES (${this.http403Errors.length} images across ${uniquePosts} posts)\n${divider}\n`;

    console.log(header);
    if (this.fileStream) {
      this.fileStream.write(header);
    }

    // Group errors by slug
    const errorsBySlug: Record<string, Http403Error[]> = {};
    this.http403Errors.forEach((error) => {
      if (!errorsBySlug[error.slug]) {
        errorsBySlug[error.slug] = [];
      }
      errorsBySlug[error.slug].push(error);
    });

    // Write each group
    Object.entries(errorsBySlug).forEach(([slug, errors]) => {
      const postSection = `\nPost: ${slug}\n`;
      console.log(postSection);
      if (this.fileStream) {
        this.fileStream.write(postSection);
      }

      errors.forEach((error, index) => {
        const errorLine = `  ✗ [${index + 1}/${errors.length}] ${error.filename}\n    ${error.url}\n`;
        console.log(`  ✗ [${index + 1}/${errors.length}] ${error.filename}`);
        console.log(`    ${error.url}`);
        if (this.fileStream) {
          this.fileStream.write(errorLine);
        }
      });
    });

    const footer = `\n${divider}\n`;
    console.log(footer);
    if (this.fileStream) {
      this.fileStream.write(footer);
    }
  }

  /**
   * Write conversion summary with statistics
   * @param converted - Number of posts successfully converted
   * @param skipped - Number of posts skipped
   * @param errors - Number of posts with errors
   */
  writeSummary(converted: number, skipped: number, errors: number): void {
    const divider = '='.repeat(80);
    const summary = `
${divider}
CONVERSION SUMMARY
Completed: ${new Date().toLocaleString()}
Duration: ${this.getDuration()}
${divider}
✓ Converted: ${converted} posts
⏭  Skipped: ${skipped} posts
✗ Post Errors: ${errors}
✗ Image 403 Failures: ${this.http403Errors.length} images
${divider}
`;

    console.log(summary);
    if (this.fileStream) {
      this.fileStream.write(summary);
    }

    // Write 403 error section if any exist
    if (this.http403Errors.length > 0) {
      this.writeHttp403Section();
    }
  }

  /**
   * Close the file stream and cleanup resources
   * @returns Promise that resolves when stream is closed
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.fileStream) {
        resolve();
        return;
      }

      // Attach error listener before calling end() to catch any errors during closing
      this.fileStream.on('error', reject);

      this.fileStream.end(() => {
        // eslint-disable-next-line no-console
        console.log(`\n📋 Log file saved to: ${this.logFilePath}`);
        resolve();
      });
    });
  }
}
