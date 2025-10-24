import { HashnodePost, PostMetadata } from '../types/hashnode-schema';

export class PostParser {
  parse(_post: HashnodePost): PostMetadata {
    throw new Error('Not implemented');
  }
}
