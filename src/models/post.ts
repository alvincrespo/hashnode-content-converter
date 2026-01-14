import * as path from 'node:path';

export type OutputMode = 'nested' | 'flat';

export interface PostConfig {
  slug: string;
  frontmatter: string;
  content: string;
  outputMode?: OutputMode;
}

/**
 * Custom error class for Post validation errors.
 * Provides context about slug validation failures.
 */
export class PostValidationError extends Error {
  constructor(
    message: string,
    public readonly slug: string
  ) {
    super(message);
    this.name = 'PostValidationError';
  }
}

/**
 * Represents a blog post with its content and path resolution logic.
 * Encapsulates knowledge of how posts are organized on disk.
 *
 * The Post model handles:
 * - Slug sanitization (filesystem safety)
 * - Path resolution (mode-aware: nested vs flat)
 * - Content combination (frontmatter + body)
 *
 * @example
 * ```typescript
 * const post = new Post({
 *   slug: 'my-blog-post',
 *   frontmatter: '---\ntitle: My Post\n---',
 *   content: '# Hello World',
 *   outputMode: 'flat',
 * });
 *
 * post.getFilePath('./blog'); // './blog/my-blog-post.md'
 * post.getMarkdown();         // '---\ntitle: My Post\n---\n# Hello World'
 * ```
 */
export class Post {
  readonly slug: string;
  readonly frontmatter: string;
  readonly content: string;
  readonly outputMode: OutputMode;

  constructor(config: PostConfig) {
    this.slug = this.sanitizeSlug(config.slug);
    this.frontmatter = config.frontmatter;
    this.content = config.content;
    this.outputMode = config.outputMode ?? 'nested';
  }

  /**
   * Get the full file path for this post.
   * @param outputDir - Base output directory
   * @returns Full path to the markdown file
   *
   * @example
   * // Nested mode (default)
   * post.getFilePath('./blog'); // './blog/my-post/index.md'
   *
   * // Flat mode
   * post.getFilePath('./blog'); // './blog/my-post.md'
   */
  getFilePath(outputDir: string): string {
    if (this.outputMode === 'flat') {
      return path.join(outputDir, `${this.slug}.md`);
    }
    return path.join(outputDir, this.slug, 'index.md');
  }

  /**
   * Get the directory path that must exist before writing.
   * @param outputDir - Base output directory
   * @returns Directory path to ensure exists
   *
   * @example
   * // Nested mode: needs post subdirectory
   * post.getDirectoryPath('./blog'); // './blog/my-post'
   *
   * // Flat mode: only needs output directory
   * post.getDirectoryPath('./blog'); // './blog'
   */
  getDirectoryPath(outputDir: string): string {
    if (this.outputMode === 'flat') {
      return outputDir;
    }
    return path.join(outputDir, this.slug);
  }

  /**
   * Get the combined markdown content (frontmatter + content).
   * @returns Full markdown string ready to write to file
   */
  getMarkdown(): string {
    return this.frontmatter + '\n' + this.content;
  }

  /**
   * Get the path to check for post existence.
   * In nested mode, checks for directory.
   * In flat mode, checks for file.
   * @param outputDir - Base output directory
   * @returns Path to check for existence
   */
  getExistencePath(outputDir: string): string {
    if (this.outputMode === 'flat') {
      return path.join(outputDir, `${this.slug}.md`);
    }
    return path.join(outputDir, this.slug);
  }

  /**
   * Sanitize a slug for filesystem safety.
   * @throws PostValidationError if slug is invalid
   */
  private sanitizeSlug(slug: string): string {
    const trimmed = slug.trim();

    this.rejectAbsolutePath(trimmed, slug);
    this.rejectDirectoryTraversal(trimmed, slug);

    // Replace invalid filename characters with hyphens
    const sanitized = trimmed.replace(/[/\\:*?"<>|]/g, '-');

    if (sanitized.length === 0) {
      throw new PostValidationError(
        `Invalid slug: slug is empty after sanitization (original: ${slug})`,
        slug
      );
    }

    return sanitized;
  }

  /**
   * Reject slugs that are absolute paths.
   * @throws PostValidationError if slug starts with '/'
   */
  private rejectAbsolutePath(sanitized: string, original: string): void {
    if (sanitized.startsWith('/')) {
      throw new PostValidationError(
        `Invalid slug: absolute paths are not allowed (${original})`,
        original
      );
    }
  }

  /**
   * Reject slugs containing parent directory traversal.
   * @throws PostValidationError if slug contains '..'
   */
  private rejectDirectoryTraversal(sanitized: string, original: string): void {
    if (sanitized.includes('..')) {
      throw new PostValidationError(
        `Invalid slug: parent directory traversal is not allowed (${original})`,
        original
      );
    }
  }
}
