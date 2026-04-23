/** Subset of API `Post` used by the portal profile grid. */
export type PortalPost = {
  _id: string;
  type: "post" | "reel" | "story";
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  hlsMasterUrl?: string;
  caption?: string;
  likesCount?: number;
  viewsCount?: number;
  createdAt?: string;
};

export type PortalAuthor = {
  _id: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
};

/** Single post from `GET /posts/:id` (normalized with `author`). */
export type PortalPostDetail = PortalPost & {
  author?: PortalAuthor;
  /** Present on full post payloads; optional on grid-only rows. */
  commentsCount?: number;
  isLiked?: boolean;
};

export type PortalCommentAuthor = PortalAuthor;

export type PortalCommentNode = {
  _id: string;
  text?: string;
  createdAt?: string;
  author?: PortalCommentAuthor | null;
  replies?: PortalCommentNode[];
  threadReplyCount?: number;
  repliesCount?: number;
  replyingTo?: { userId: string; username: string };
};

export type PostCommentsApiResponse = {
  comments: PortalCommentNode[];
  page: number;
  hasMore: boolean;
  totalCount?: number;
};

export type UserPostsApiResponse = {
  posts: PortalPost[];
  page: number;
  hasMore: boolean;
};
