import { PostMetadata } from '../types/hashnode-schema';

export class FrontmatterGenerator {
  generate(_metadata: PostMetadata): string {
    throw new Error('Not implemented');
  }
}
