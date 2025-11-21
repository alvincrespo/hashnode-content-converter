import { PostMetadata } from '../types/hashnode-schema';

/**
 * FrontmatterGenerator handles the creation of YAML frontmatter
 * from post metadata.
 *
 * It ensures all fields are properly formatted and escaped for use
 * with static site generators.
 */
export class FrontmatterGenerator {
  /**
   * Generates a YAML frontmatter string from the provided metadata.
   *
   * @param metadata - The metadata to convert to frontmatter
   * @returns The formatted YAML string (including --- delimiters)
   */
  generate(metadata: PostMetadata): string {
    const lines = ['---'];

    // Title
    lines.push(`title: "${this.escapeString(metadata.title)}"`);

    // Slug
    lines.push(`slug: "${this.escapeString(metadata.slug)}"`);

    // Date
    if (metadata.dateAdded) {
      // Ensure we have a valid date string
      try {
        const date = new Date(metadata.dateAdded);
        lines.push(`date: ${date.toISOString()}`);
      } catch (e) {
        // Fallback to original string if parsing fails (though PostParser should catch this)
        lines.push(`date: ${metadata.dateAdded}`);
      }
    }

    // Brief / Description
    if (metadata.brief) {
      lines.push(`description: "${this.escapeString(metadata.brief)}"`);
    }

    // Cover Image
    if (metadata.coverImage) {
      lines.push(`coverImage: "${this.escapeString(metadata.coverImage)}"`);
    }

    // Tags
    if (metadata.tags && metadata.tags.length > 0) {
      lines.push('tags:');
      metadata.tags.forEach(tag => {
        lines.push(`  - "${this.escapeString(tag)}"`);
      });
    }

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Escapes double quotes in a string to ensure valid YAML
   *
   * @param str - The string to escape
   * @returns The escaped string
   */
  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
