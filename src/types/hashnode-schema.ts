export interface HashnodePost {
  _id: string;
  id: string;
  cuid: string;
  slug: string;
  title: string;
  dateAdded: string;
  createdAt: string;
  updatedAt: string;
  contentMarkdown: string;
  content: string;
  brief: string;
  coverImage?: string;
  views: number;
  author: string;
  tags: string[];
  isActive: boolean;
  [key: string]: unknown;
}

export interface HashnodeExport {
  posts: HashnodePost[];
}

export interface PostMetadata {
  title: string;
  slug: string;
  dateAdded: string;
  brief: string;
  contentMarkdown: string;
  coverImage?: string;
  tags?: string[];
}
