import { Type, type Static } from "@sinclair/typebox";
import type { NylasClient } from "../client.js";

// Helper to parse email addresses from string format "name <email>" or just "email"
function parseEmailAddress(input: string): { email: string; name?: string } {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: trimmed };
}

function parseEmailAddresses(input: string | string[] | undefined): Array<{ email: string; name?: string }> | undefined {
  if (!input) return undefined;
  const items = Array.isArray(input) ? input : input.split(",").map((s) => s.trim());
  return items.filter(Boolean).map(parseEmailAddress);
}

function formatEmailAddress(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

function formatEmailAddresses(addrs?: Array<{ email: string; name?: string }>): string {
  if (!addrs || addrs.length === 0) return "";
  return addrs.map(formatEmailAddress).join(", ");
}

// =============================================================================
// List Emails Tool
// =============================================================================

export const ListEmailsSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
  folder: Type.Optional(Type.String({ description: "Folder name or ID (e.g., 'INBOX', 'SENT', 'DRAFTS')" })),
  subject: Type.Optional(Type.String({ description: "Filter by subject (partial match)" })),
  from: Type.Optional(Type.String({ description: "Filter by sender email" })),
  to: Type.Optional(Type.String({ description: "Filter by recipient email" })),
  unread: Type.Optional(Type.Boolean({ description: "Filter by unread status" })),
  starred: Type.Optional(Type.Boolean({ description: "Filter by starred status" })),
  has_attachment: Type.Optional(Type.Boolean({ description: "Filter by attachment presence" })),
  received_after: Type.Optional(Type.String({ description: "ISO 8601 date - emails received after this date" })),
  received_before: Type.Optional(Type.String({ description: "ISO 8601 date - emails received before this date" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 10, max: 50)" })),
  page_token: Type.Optional(Type.String({ description: "Pagination token for next page" })),
});

export type ListEmailsParams = Static<typeof ListEmailsSchema>;

export async function listEmails(client: NylasClient, params: ListEmailsParams) {
  const limit = Math.min(params.limit ?? 10, 50);

  const response = await client.listMessages({
    grant: params.grant,
    limit,
    pageToken: params.page_token,
    subject: params.subject,
    from: params.from,
    to: params.to,
    in: params.folder,
    unread: params.unread,
    starred: params.starred,
    hasAttachment: params.has_attachment,
    receivedAfter: params.received_after ? Math.floor(new Date(params.received_after).getTime() / 1000) : undefined,
    receivedBefore: params.received_before ? Math.floor(new Date(params.received_before).getTime() / 1000) : undefined,
  });

  const emails = response.data.map((msg) => ({
    id: msg.id,
    thread_id: msg.threadId,
    subject: msg.subject ?? "(no subject)",
    from: formatEmailAddresses(msg.from),
    to: formatEmailAddresses(msg.to),
    date: msg.date ? new Date(msg.date * 1000).toISOString() : undefined,
    unread: msg.unread,
    starred: msg.starred,
    snippet: msg.snippet,
    has_attachments: (msg.attachments?.length ?? 0) > 0,
    folders: msg.folders,
  }));

  return {
    emails,
    has_more: !!response.nextCursor,
    next_page_token: response.nextCursor,
    count: emails.length,
  };
}

// =============================================================================
// Get Email Tool
// =============================================================================

export const GetEmailSchema = Type.Object({
  message_id: Type.String({ description: "The email message ID" }),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type GetEmailParams = Static<typeof GetEmailSchema>;

export async function getEmail(client: NylasClient, params: GetEmailParams) {
  const response = await client.getMessage(params.message_id, params.grant);
  const msg = response.data;

  return {
    id: msg.id,
    thread_id: msg.threadId,
    subject: msg.subject ?? "(no subject)",
    from: formatEmailAddresses(msg.from),
    to: formatEmailAddresses(msg.to),
    cc: formatEmailAddresses(msg.cc),
    bcc: formatEmailAddresses(msg.bcc),
    reply_to: formatEmailAddresses(msg.replyTo),
    date: msg.date ? new Date(msg.date * 1000).toISOString() : undefined,
    unread: msg.unread,
    starred: msg.starred,
    body: msg.body,
    folders: msg.folders,
    attachments: msg.attachments?.map((a) => ({
      id: a.id,
      filename: a.filename,
      content_type: a.contentType,
      size: a.size,
    })),
  };
}

// =============================================================================
// Send Email Tool
// =============================================================================

export const SendEmailSchema = Type.Object({
  to: Type.String({ description: "Recipient email(s), comma-separated. Format: 'email' or 'Name <email>'" }),
  subject: Type.String({ description: "Email subject" }),
  body: Type.String({ description: "Email body (HTML supported)" }),
  cc: Type.Optional(Type.String({ description: "CC recipients, comma-separated" })),
  bcc: Type.Optional(Type.String({ description: "BCC recipients, comma-separated" })),
  reply_to_message_id: Type.Optional(Type.String({ description: "Message ID to reply to (for threading)" })),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type SendEmailParams = Static<typeof SendEmailSchema>;

export async function sendEmail(client: NylasClient, params: SendEmailParams) {
  const response = await client.sendMessage({
    grant: params.grant,
    to: parseEmailAddresses(params.to),
    subject: params.subject,
    body: params.body,
    cc: parseEmailAddresses(params.cc),
    bcc: parseEmailAddresses(params.bcc),
    replyToMessageId: params.reply_to_message_id,
  });

  return {
    success: true,
    message_id: response.data.id,
    thread_id: response.data.threadId,
  };
}

// =============================================================================
// Create Draft Tool
// =============================================================================

export const CreateDraftSchema = Type.Object({
  to: Type.Optional(Type.String({ description: "Recipient email(s), comma-separated" })),
  subject: Type.Optional(Type.String({ description: "Email subject" })),
  body: Type.Optional(Type.String({ description: "Email body (HTML supported)" })),
  cc: Type.Optional(Type.String({ description: "CC recipients, comma-separated" })),
  bcc: Type.Optional(Type.String({ description: "BCC recipients, comma-separated" })),
  reply_to_message_id: Type.Optional(Type.String({ description: "Message ID to reply to (for threading)" })),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type CreateDraftParams = Static<typeof CreateDraftSchema>;

export async function createDraft(client: NylasClient, params: CreateDraftParams) {
  const response = await client.createDraft({
    grant: params.grant,
    to: parseEmailAddresses(params.to),
    subject: params.subject,
    body: params.body,
    cc: parseEmailAddresses(params.cc),
    bcc: parseEmailAddresses(params.bcc),
    replyToMessageId: params.reply_to_message_id,
  });

  return {
    success: true,
    draft_id: response.data.id,
    thread_id: response.data.threadId,
  };
}

// =============================================================================
// List Threads Tool
// =============================================================================

export const ListThreadsSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
  folder: Type.Optional(Type.String({ description: "Folder name or ID" })),
  subject: Type.Optional(Type.String({ description: "Filter by subject (partial match)" })),
  from: Type.Optional(Type.String({ description: "Filter by sender email" })),
  to: Type.Optional(Type.String({ description: "Filter by recipient email" })),
  unread: Type.Optional(Type.Boolean({ description: "Filter by unread status" })),
  starred: Type.Optional(Type.Boolean({ description: "Filter by starred status" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 10, max: 50)" })),
  page_token: Type.Optional(Type.String({ description: "Pagination token for next page" })),
});

export type ListThreadsParams = Static<typeof ListThreadsSchema>;

export async function listThreads(client: NylasClient, params: ListThreadsParams) {
  const limit = Math.min(params.limit ?? 10, 50);

  const response = await client.listThreads({
    grant: params.grant,
    limit,
    pageToken: params.page_token,
    subject: params.subject,
    from: params.from,
    to: params.to,
    in: params.folder,
    unread: params.unread,
    starred: params.starred,
  });

  const threads = response.data.map((thread) => ({
    id: thread.id,
    subject: thread.subject ?? "(no subject)",
    participants: thread.participants?.map(formatEmailAddress) ?? [],
    message_count: thread.messageIds?.length ?? 0,
    snippet: thread.snippet,
    unread: thread.unread,
    starred: thread.starred,
    latest_message_date: thread.latestMessageReceivedDate
      ? new Date(thread.latestMessageReceivedDate * 1000).toISOString()
      : undefined,
    folders: thread.folders,
  }));

  return {
    threads,
    has_more: !!response.nextCursor,
    next_page_token: response.nextCursor,
    count: threads.length,
  };
}

// =============================================================================
// List Folders Tool
// =============================================================================

export const ListFoldersSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type ListFoldersParams = Static<typeof ListFoldersSchema>;

export async function listFolders(client: NylasClient, params: ListFoldersParams) {
  const response = await client.listFolders(params.grant);

  const folders = response.data.map((folder) => ({
    id: folder.id,
    name: folder.name,
    system_folder: folder.systemFolder,
    unread_count: folder.unreadCount,
    total_count: folder.totalCount,
  }));

  return { folders };
}
