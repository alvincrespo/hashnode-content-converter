import { HashnodePost, PostMetadata } from '../types/hashnode-schema';

export class PostParser {
  parse(post: HashnodePost): PostMetadata {
    throw new Error('Not implemented');
  }
}
