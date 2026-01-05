/**
 * Represents a single blog post from a Hashnode export.
 *
 * This interface defines the structure of post data exported from Hashnode.
 * Not all fields are used during conversion - see {@link PostMetadata} for
 * the extracted subset used in the conversion pipeline.
 *
 * @example
 * ```typescript
 * const post: HashnodePost = {
 *   _id: "507f1f77bcf86cd799439011",
 *   id: "507f1f77bcf86cd799439011",
 *   cuid: "ckl3s0f8c0001ia9o9v3s3p3s",
 *   slug: "my-first-post",
 *   title: "My First Post",
 *   dateAdded: "2024-01-15T10:30:00.000Z",
 *   createdAt: "2024-01-15T10:30:00.000Z",
 *   updatedAt: "2024-01-16T12:00:00.000Z",
 *   contentMarkdown: "# Hello World\n\nThis is my post.",
 *   content: "<h1>Hello World</h1><p>This is my post.</p>",
 *   brief: "A brief introduction to my blog",
 *   coverImage: "https://cdn.hashnode.com/res/hashnode/image/upload/...",
 *   views: 100,
 *   author: "author-id",
 *   tags: ["javascript", "tutorial"],
 *   isActive: true
 * };
 * ```
 */
export interface HashnodePost {
  /** MongoDB ObjectId for the post */
  _id: string;

  /** Post identifier (same as _id) */
  id: string;

  /** Hashnode's unique identifier (collision-resistant unique ID) */
  cuid: string;

  /** URL-friendly slug for the post */
  slug: string;

  /** Post title */
  title: string;

  /** ISO 8601 date string when the post was published */
  dateAdded: string;

  /** ISO 8601 date string when the post was created */
  createdAt: string;

  /** ISO 8601 date string when the post was last updated */
  updatedAt: string;

  /** Raw markdown content of the post (used for conversion) */
  contentMarkdown: string;

  /** Rendered HTML content of the post (not used in conversion) */
  content: string;

  /** Short description or excerpt of the post */
  brief: string;

  /** Optional URL to the post's cover image */
  coverImage?: string;

  /** Number of views the post has received */
  views: number;

  /** Author identifier */
  author: string;

  /** Array of tag names associated with the post */
  tags: string[];

  /** Whether the post is currently published */
  isActive: boolean;

  /** Allow additional unknown fields from Hashnode export */
  [key: string]: unknown;
}

/**
 * Root structure of a Hashnode export JSON file.
 *
 * The export file contains an array of posts under the `posts` key.
 *
 * @example
 * ```typescript
 * import { readFileSync } from 'fs';
 *
 * const exportData: HashnodeExport = JSON.parse(
 *   readFileSync('./hashnode-export.json', 'utf-8')
 * );
 *
 * console.log(`Found ${exportData.posts.length} posts`);
 * ```
 */
export interface HashnodeExport {
  /** Array of blog posts from the Hashnode export */
  posts: HashnodePost[];
}

/**
 * Cleaned and validated metadata extracted from a Hashnode post.
 *
 * This interface represents the subset of {@link HashnodePost} fields
 * that are used in the conversion pipeline. The {@link PostParser}
 * extracts and validates these fields from raw Hashnode posts.
 *
 * @example
 * ```typescript
 * import { PostParser } from '@alvincrespo/hashnode-content-converter';
 *
 * const parser = new PostParser();
 * const metadata: PostMetadata = parser.parse(hashnodePost);
 *
 * console.log(metadata.title);  // Post title
 * console.log(metadata.slug);   // URL-friendly slug
 * console.log(metadata.tags);   // ['javascript', 'tutorial']
 * ```
 */
export interface PostMetadata {
  /** Validated post title (trimmed, non-empty) */
  title: string;

  /** Validated URL-friendly slug (trimmed, non-empty) */
  slug: string;

  /** Validated ISO 8601 date string */
  dateAdded: string;

  /** Post excerpt/description (may be empty string) */
  brief: string;

  /** Raw markdown content (trimmed, non-empty) */
  contentMarkdown: string;

  /** Optional cover image URL (undefined if not present) */
  coverImage?: string;

  /** Optional array of validated tag strings (undefined if no valid tags) */
  tags?: string[];
}
