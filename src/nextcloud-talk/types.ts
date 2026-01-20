/**
 * Nextcloud Talk webhook payload types based on Activity Streams 2.0 format.
 * Reference: https://nextcloud-talk.readthedocs.io/en/latest/bots/
 */

/** Actor in the activity (the message sender). */
export type NextcloudTalkActor = {
  type: "Person";
  /** User ID in Nextcloud. */
  id: string;
  /** Display name of the user. */
  name: string;
};

/** The message object in the activity. */
export type NextcloudTalkObject = {
  type: "Note";
  /** Message ID. */
  id: string;
  /** Message text (same as content for text/plain). */
  name: string;
  /** Message content. */
  content: string;
  /** Media type of the content. */
  mediaType: "text/plain" | "text/markdown" | string;
};

/** Target conversation/room. */
export type NextcloudTalkTarget = {
  type: "Collection";
  /** Room token. */
  id: string;
  /** Room display name. */
  name: string;
};

/** Incoming webhook payload from Nextcloud Talk. */
export type NextcloudTalkWebhookPayload = {
  type: "Create" | "Update" | "Delete";
  actor: NextcloudTalkActor;
  object: NextcloudTalkObject;
  target: NextcloudTalkTarget;
};

/** Result from sending a message to Nextcloud Talk. */
export type NextcloudTalkSendResult = {
  messageId: string;
  roomToken: string;
  timestamp?: number;
};

/** Parsed incoming message context. */
export type NextcloudTalkInboundMessage = {
  messageId: string;
  roomToken: string;
  roomName: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaType: string;
  timestamp: number;
  isGroupChat: boolean;
};

/** Headers sent by Nextcloud Talk webhook. */
export type NextcloudTalkWebhookHeaders = {
  /** HMAC-SHA256 signature of the request. */
  signature: string;
  /** Random string used in signature calculation. */
  random: string;
  /** Backend Nextcloud server URL. */
  backend: string;
};

/** Options for the webhook server. */
export type NextcloudTalkWebhookServerOptions = {
  port: number;
  host: string;
  path: string;
  secret: string;
  onMessage: (message: NextcloudTalkInboundMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
  abortSignal?: AbortSignal;
};

/** Options for sending a message. */
export type NextcloudTalkSendOptions = {
  baseUrl: string;
  secret: string;
  roomToken: string;
  message: string;
  replyTo?: string;
};
