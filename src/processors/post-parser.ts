import { HashnodePost, PostMetadata } from '../types/hashnode-schema';

/**
 * PostParser extracts and validates metadata from Hashnode posts
 *
 * Transforms a full HashnodePost object into a clean PostMetadata object
 * by extracting only the fields needed for conversion and validating
 * required fields.
 */
export class PostParser {
  /**
   * Parse a Hashnode post and extract validated metadata
   *
   * @param post - The Hashnode post object to parse
   * @returns Validated PostMetadata object
   * @throws Error if required fields are missing or invalid
   */
  parse(post: HashnodePost): PostMetadata {
    // Step 1: Validate the post object exists
    if (!post) {
      throw new Error('Cannot parse: post is null or undefined');
    }

    // Step 2: Validate and extract required fields
    this.validateRequiredFields(post);

    // Step 3: Extract and transform fields
    const metadata: PostMetadata = {
      title: this.extractTitle(post),
      slug: this.extractSlug(post),
      dateAdded: this.extractDateAdded(post),
      brief: this.extractBrief(post),
      contentMarkdown: this.extractContentMarkdown(post),
      coverImage: this.extractCoverImage(post),
      tags: this.extractTags(post),
    };

    return metadata;
  }

  /**
   * Validate all required fields are present and valid
   *
   * @param post - The post to validate
   * @throws Error with descriptive message if validation fails
   */
  private validateRequiredFields(post: HashnodePost): void {
    // Check required fields exist
    if (post.title === undefined || post.title === null) {
      throw new Error('Missing required field: title');
    }
    if (post.slug === undefined || post.slug === null) {
      throw new Error('Missing required field: slug');
    }
    if (post.dateAdded === undefined || post.dateAdded === null) {
      throw new Error('Missing required field: dateAdded');
    }
    if (post.contentMarkdown === undefined || post.contentMarkdown === null) {
      throw new Error('Missing required field: contentMarkdown');
    }
    // brief is required but can be empty string (default provided in extraction)
  }

  /**
   * Extract and validate title field
   */
  private extractTitle(post: HashnodePost): string {
    const title = post.title.trim();
    if (title.length === 0) {
      throw new Error('Invalid field: title cannot be empty');
    }
    return title;
  }

  /**
   * Extract and validate slug field
   */
  private extractSlug(post: HashnodePost): string {
    const slug = post.slug.trim();
    if (slug.length === 0) {
      throw new Error('Invalid field: slug cannot be empty');
    }
    return slug;
  }

  /**
   * Extract and validate dateAdded field
   */
  private extractDateAdded(post: HashnodePost): string {
    const dateAdded = post.dateAdded.trim();
    if (dateAdded.length === 0) {
      throw new Error('Invalid field: dateAdded cannot be empty');
    }

    // Validate ISO 8601 format (basic check)
    // Format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!isoDatePattern.test(dateAdded)) {
      throw new Error('Invalid field: dateAdded must be a valid ISO 8601 date string');
    }

    return dateAdded;
  }

  /**
   * Extract brief field (with default for missing/null)
   */
  private extractBrief(post: HashnodePost): string {
    // brief is required in schema but can be empty
    if (post.brief === undefined || post.brief === null) {
      return '';
    }
    return post.brief.trim();
  }

  /**
   * Extract and validate contentMarkdown field
   */
  private extractContentMarkdown(post: HashnodePost): string {
    const content = post.contentMarkdown.trim();
    if (content.length === 0) {
      throw new Error('Invalid field: contentMarkdown cannot be empty');
    }
    return content;
  }

  /**
   * Extract optional coverImage field
   */
  private extractCoverImage(post: HashnodePost): string | undefined {
    // coverImage is optional - return undefined if not present
    if (!post.coverImage || post.coverImage.trim().length === 0) {
      return undefined;
    }
    return post.coverImage.trim();
  }

  /**
   * Extract optional tags field
   */
  private extractTags(post: HashnodePost): string[] | undefined {
    // tags is optional - return undefined if not present or empty
    if (!post.tags || !Array.isArray(post.tags) || post.tags.length === 0) {
      return undefined;
    }
    return post.tags;
  }
}
