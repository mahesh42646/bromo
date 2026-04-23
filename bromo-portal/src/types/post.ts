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

export type UserPostsApiResponse = {
  posts: PortalPost[];
  page: number;
  hasMore: boolean;
};
