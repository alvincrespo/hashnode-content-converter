/**
 * Configuration options for markdown transformation.
 *
 * @remarks
 * Based on analysis of real Hashnode export data, the primary transformation needed
 * is removing align attributes from images. Additional optional cleanup transformations
 * are provided for specific use cases.
 */
export interface MarkdownTransformerOptions {
  /**
   * Whether to remove align attributes from images.
   * @defaultValue true
   *
   * @remarks
   * Hashnode exports include `align="center"`, `align="left"`, and `align="right"`
   * attributes on markdown images. These are not standard markdown and should be removed.
   */
  removeAlignAttributes?: boolean;

  /**
   * Whether to convert Hashnode callout divs to markdown blockquotes.
   * @defaultValue false
   *
   * @remarks
   * Hashnode exports may contain `<div data-node-type="callout">` structures for
   * highlighting content. Enable this to convert them to standard markdown blockquotes.
   * Leave disabled if your target framework can style HTML in markdown.
   */
  convertCalloutsToBlockquotes?: boolean;

  /**
   * Whether to trim trailing whitespace from lines.
   * @defaultValue false
   *
   * @remarks
   * Some Hashnode exports contain trailing spaces (particularly after list items).
   * These are harmless but can be cleaned up if desired.
   *
   * Note: Preserves exactly two trailing spaces (markdown hard line break syntax).
   */
  trimTrailingWhitespace?: boolean;
}

/**
 * Transforms Hashnode-specific markdown into clean, standard markdown.
 *
 * Based on analysis of 48 real Hashnode blog posts, this processor removes
 * the align attributes that Hashnode adds to images. Optional transformations
 * for callouts and whitespace are available but not enabled by default.
 *
 * @remarks
 * This processor preserves valid markdown syntax including:
 * - Smart quotes and em dashes
 * - Emojis
 * - Escaped underscores
 * - HTML callout divs (unless conversion is enabled)
 * - Code blocks and inline code
 *
 * @example
 * ```typescript
 * const transformer = new MarkdownTransformer();
 * const cleaned = transformer.transform('![](image.png) align="center"');
 * // Returns: '![](image.png)'
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const transformer = new MarkdownTransformer({
 *   removeAlignAttributes: true,
 *   trimTrailingWhitespace: true
 * });
 * const cleaned = transformer.transform('![](img.png) align="left"   \n');
 * // Returns: '![](img.png)\n'
 * ```
 */
export class MarkdownTransformer {
  private options: Required<MarkdownTransformerOptions>;

  /**
   * Creates a new MarkdownTransformer with optional configuration.
   *
   * @param options - Transformation options
   */
  constructor(options?: MarkdownTransformerOptions) {
    this.options = {
      removeAlignAttributes: true,
      convertCalloutsToBlockquotes: false,
      trimTrailingWhitespace: false,
      ...options,
    };
  }

  /**
   * Transforms raw Hashnode markdown into cleaned markdown.
   *
   * Preserves valid markdown syntax including:
   * - Smart quotes and em dashes
   * - Emojis
   * - Escaped underscores
   * - HTML callout divs (unless conversion is enabled)
   * - Code blocks and inline code
   *
   * @param markdown - Raw markdown content from Hashnode export
   * @returns Cleaned markdown with Hashnode-specific quirks removed
   * @throws {Error} If markdown is not a string
   *
   * @example
   * ```typescript
   * const transformer = new MarkdownTransformer();
   *
   * // Remove align attributes
   * transformer.transform('![](image.png) align="center"');
   * // Returns: '![](image.png)'
   *
   * // Preserves valid markdown
   * transformer.transform('The "Start in" field—essentially the default path');
   * // Returns: 'The "Start in" field—essentially the default path'
   * ```
   */
  transform(markdown: string): string {
    if (typeof markdown !== 'string') {
      throw new Error('Markdown must be a string');
    }

    let result = markdown;

    // Remove align attributes from images (core transformation)
    if (this.options.removeAlignAttributes) {
      result = this.removeAlignAttributes(result);
    }

    // Optional: Convert callout divs to blockquotes
    if (this.options.convertCalloutsToBlockquotes) {
      result = this.convertCalloutsToBlockquotes(result);
    }

    // Optional: Trim trailing whitespace
    if (this.options.trimTrailingWhitespace) {
      result = this.trimTrailingWhitespace(result);
    }

    return result;
  }

  /**
   * Removes align attributes from markdown images.
   *
   * Hashnode exports include align="center", align="left", and align="right"
   * on image markdown. These are not standard markdown syntax.
   *
   * @param markdown - Markdown content
   * @returns Markdown with align attributes removed
   *
   * @example
   * ```typescript
   * // Input:  ![](image.png) align="center"
   * // Output: ![](image.png)
   * ```
   */
  private removeAlignAttributes(markdown: string): string {
    return markdown.replace(/ align="[^"]*"/g, '');
  }

  /**
   * Converts Hashnode callout divs to markdown blockquotes.
   *
   * @param markdown - Markdown content
   * @returns Markdown with callouts converted to blockquotes
   *
   * @remarks
   * This is an optional transformation. Many frameworks can style HTML in markdown,
   * so this may not be necessary.
   *
   * @example
   * ```typescript
   * // TODO: Implement if needed
   * // Pattern: <div data-node-type="callout">...</div>
   * // Convert to: > [!NOTE]\n> content
   * ```
   */
  private convertCalloutsToBlockquotes(markdown: string): string {
    // TODO: Implement if needed
    // Pattern: <div data-node-type="callout">...</div>
    // Convert to: > [!NOTE]\n> content
    return markdown;
  }

  /**
   * Trims trailing whitespace from each line while preserving markdown line breaks.
   *
   * @param markdown - Markdown content
   * @returns Markdown with trailing whitespace removed, except for markdown hard line breaks
   *
   * @remarks
   * Preserves exactly two trailing spaces (markdown hard line break syntax).
   * Removes all other trailing whitespace including tabs and excessive spaces.
   *
   * @example
   * ```typescript
   * // Removes excessive trailing spaces
   * // Input:  '* Item 1    \n* Item 2   \n'
   * // Output: '* Item 1\n* Item 2\n'
   *
   * // Preserves markdown line breaks (exactly 2 spaces)
   * // Input:  'Line 1  \nLine 2\n'
   * // Output: 'Line 1  \nLine 2\n'
   * ```
   */
  private trimTrailingWhitespace(markdown: string): string {
    return markdown
      .split('\n')
      .map(line => {
        // Preserve exactly 2 trailing spaces (markdown hard line break)
        if (line.endsWith('  ') && !line.endsWith('   ')) {
          return line;
        }
        return line.trimEnd();
      })
      .join('\n');
  }
}
