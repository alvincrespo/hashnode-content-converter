import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration options for image downloads
 */
export interface ImageDownloadConfig {
  /** Maximum number of retry attempts for transient failures */
  maxRetries?: number;
  /** Delay in milliseconds between retry attempts */
  retryDelayMs?: number;
  /** Timeout in milliseconds for each download attempt */
  timeoutMs?: number;
  /** Delay in milliseconds between downloads (rate limiting) */
  downloadDelayMs?: number;
}

/**
 * Result of an image download attempt
 */
export interface DownloadResult {
  success: boolean;
  error?: string;
  is403?: boolean;
}

/**
 * Service for downloading images from URLs with retry logic and error handling
 */
export class ImageDownloader {
  private maxRetries: number;
  private retryDelayMs: number;
  private timeoutMs: number;
  private downloadDelayMs: number;

  constructor(config?: ImageDownloadConfig) {
    this.maxRetries = config?.maxRetries ?? 3;
    this.retryDelayMs = config?.retryDelayMs ?? 1000;
    this.timeoutMs = config?.timeoutMs ?? 30000;
    this.downloadDelayMs = config?.downloadDelayMs ?? 0;
  }

  /**
   * Download a file from a URL and save it to the specified filepath.
   * Returns a result object with success status and error details.
   *
   * @param url - The URL to download from
   * @param filepath - The local path where the file will be saved
   * @returns Download result with success status, error details, and 403 flag
   */
  async download(url: string, filepath: string): Promise<DownloadResult> {
    return this.downloadWithRetry(url, filepath, 0);
  }

  /**
   * Download with automatic retry logic for transient failures
   * @param url - The URL to download
   * @param filepath - The destination file path
   * @param attemptNumber - Current attempt number (for retry logic)
   * @returns Download result with success status and error details
   */
  private async downloadWithRetry(
    url: string,
    filepath: string,
    attemptNumber: number
  ): Promise<DownloadResult> {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const result = await this.downloadFile(url, filepath);

    if (result.success) {
      return result;
    }

    if (result.is403) {
      return result;
    }

    if (result.error?.includes('HTTP 404')) {
      return result;
    }

    // Retry on transient failures (timeout, network errors) up to maxRetries times.
    // 403/404 errors are permanent and skipped above, so we only reach here for recoverable failures.
    if (attemptNumber < this.maxRetries) {
      await this.delay(this.retryDelayMs);
      return this.downloadWithRetry(url, filepath, attemptNumber + 1);
    }

    return {
      success: false,
      error: `${result.error} (after ${attemptNumber + 1} attempts)`,
      is403: false,
    };
  }

  /**
   * Perform the actual file download via HTTPS
   * @param url - The URL to download
   * @param filepath - The destination file path
   * @returns Download result
   */
  private downloadFile(url: string, filepath: string): Promise<DownloadResult> {
    return new Promise((resolve) => {
      const request = https.get(url, { timeout: this.timeoutMs }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            resolve({
              success: false,
              error: `Redirect without location header: HTTP ${response.statusCode}`,
            });
            return;
          }

          this.downloadFile(redirectUrl, filepath)
            .then(resolve)
            .catch((err) => {
              resolve({
                success: false,
                error: err.message,
              });
            });
          return;
        }

        if (response.statusCode !== 200) {
          resolve({
            success: false,
            error: `HTTP ${response.statusCode}: ${url}`,
            is403: response.statusCode === 403,
          });
          return;
        }

        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ success: true });
        });

        fileStream.on('error', (err) => {
          // Clean up partial file to avoid disk waste and orphaned files
          try {
            fs.unlinkSync(filepath);
          } catch {
            // Ignore cleanup errors - we're already in an error state
          }
          resolve({
            success: false,
            error: `File write error: ${err.message}`,
          });
        });

        response.on('error', (err) => {
          fileStream.destroy();
          try {
            fs.unlinkSync(filepath);
          } catch {
            // Ignore cleanup errors - we're already in an error state
          }
          resolve({
            success: false,
            error: `Stream error: ${err.message}`,
          });
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          error: `Download timeout (${this.timeoutMs}ms): ${url}`,
        });
      });

      request.on('error', (err) => {
        resolve({
          success: false,
          error: `Request error: ${err.message}`,
        });
      });
    });
  }

  /**
   * Extract image hash from Hashnode CDN URL
   * Pattern: UUID.extension (e.g., 550e8400-e29b-41d4-a716-446655440000.png)
   * @param url - The image URL
   * @returns The extracted hash with extension, or null if not found
   */
  static extractHash(url: string): string | null {
    const match = url.match(
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(png|jpg|jpeg|gif|webp)/i
    );
    if (match) {
      return `${match[1]}.${match[2]}`;
    }
    return null;
  }

  /**
   * Helper method to create a promise-based delay
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Apply rate limiting delay between downloads
   * @returns Promise that resolves after the configured delay
   */
  async applyRateLimit(): Promise<void> {
    if (this.downloadDelayMs > 0) {
      await this.delay(this.downloadDelayMs);
    }
  }
}
