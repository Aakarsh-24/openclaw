export type GetReplyOptions = {
  onReplyStart?: () => Promise<unknown> | void;
};

export type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
};
