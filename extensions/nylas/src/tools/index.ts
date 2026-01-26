import { Type } from "@sinclair/typebox";
import type { NylasClient } from "../client.js";

// Email tools
import {
  ListEmailsSchema,
  listEmails,
  GetEmailSchema,
  getEmail,
  SendEmailSchema,
  sendEmail,
  CreateDraftSchema,
  createDraft,
  ListThreadsSchema,
  listThreads,
  ListFoldersSchema,
  listFolders,
} from "./email.js";

// Calendar tools
import {
  ListCalendarsSchema,
  listCalendars,
  ListEventsSchema,
  listEvents,
  GetEventSchema,
  getEvent,
  CreateEventSchema,
  createEvent,
  UpdateEventSchema,
  updateEvent,
  DeleteEventSchema,
  deleteEvent,
  CheckAvailabilitySchema,
  checkAvailability,
} from "./calendar.js";

// Contact tools
import {
  ListContactsSchema,
  listContacts,
  GetContactSchema,
  getContact,
} from "./contacts.js";

// =============================================================================
// Discover Grants Tool (Account Discovery)
// =============================================================================

export const DiscoverGrantsSchema = Type.Object({
  provider: Type.Optional(Type.String({ description: "Filter by provider (e.g., 'google', 'microsoft', 'imap')" })),
  email: Type.Optional(Type.String({ description: "Filter by email address" })),
});

export async function discoverGrants(
  client: import("../client.js").NylasClient,
  params: { provider?: string; email?: string },
) {
  const response = await client.listGrants({
    provider: params.provider,
    email: params.email,
  });

  const grants = response.data.map((grant) => ({
    id: grant.id,
    email: grant.email,
    provider: grant.provider,
    status: grant.grantStatus,
    scopes: grant.scope,
  }));

  return {
    grants,
    count: grants.length,
    hint: grants.length > 0
      ? "Use the grant 'id' as the 'grant' parameter in other nylas tools to access this account."
      : "No authenticated accounts found. User needs to add accounts at dashboard.nylas.com",
  };
}

export type NylasToolDefinition = {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (client: NylasClient, params: unknown) => Promise<unknown>;
};

export const nylasTools: NylasToolDefinition[] = [
  // Account discovery
  {
    name: "nylas_discover_grants",
    label: "Discover Grants",
    description: "Discover all authenticated email accounts (grants) available via this Nylas API key. Use this to find grant IDs for multi-account access.",
    parameters: DiscoverGrantsSchema,
    execute: (client, params) => discoverGrants(client, params as Parameters<typeof discoverGrants>[1]),
  },

  // Email tools
  {
    name: "nylas_list_emails",
    label: "List Emails",
    description: "List and search emails with filters for folder, sender, subject, date range, etc.",
    parameters: ListEmailsSchema,
    execute: (client, params) => listEmails(client, params as Parameters<typeof listEmails>[1]),
  },
  {
    name: "nylas_get_email",
    label: "Get Email",
    description: "Get full content of an email by ID including body, attachments, and metadata.",
    parameters: GetEmailSchema,
    execute: (client, params) => getEmail(client, params as Parameters<typeof getEmail>[1]),
  },
  {
    name: "nylas_send_email",
    label: "Send Email",
    description: "Send an email to recipients with subject, body, and optional CC/BCC.",
    parameters: SendEmailSchema,
    execute: (client, params) => sendEmail(client, params as Parameters<typeof sendEmail>[1]),
  },
  {
    name: "nylas_create_draft",
    label: "Create Draft",
    description: "Create an email draft to edit and send later.",
    parameters: CreateDraftSchema,
    execute: (client, params) => createDraft(client, params as Parameters<typeof createDraft>[1]),
  },
  {
    name: "nylas_list_threads",
    label: "List Threads",
    description: "List email threads (conversations) with filters.",
    parameters: ListThreadsSchema,
    execute: (client, params) => listThreads(client, params as Parameters<typeof listThreads>[1]),
  },
  {
    name: "nylas_list_folders",
    label: "List Folders",
    description: "List email folders/labels (INBOX, SENT, DRAFTS, custom folders, etc.).",
    parameters: ListFoldersSchema,
    execute: (client, params) => listFolders(client, params as Parameters<typeof listFolders>[1]),
  },

  // Calendar tools
  {
    name: "nylas_list_calendars",
    label: "List Calendars",
    description: "List available calendars for the account.",
    parameters: ListCalendarsSchema,
    execute: (client, params) => listCalendars(client, params as Parameters<typeof listCalendars>[1]),
  },
  {
    name: "nylas_list_events",
    label: "List Events",
    description: "List calendar events with optional date range and title filters.",
    parameters: ListEventsSchema,
    execute: (client, params) => listEvents(client, params as Parameters<typeof listEvents>[1]),
  },
  {
    name: "nylas_get_event",
    label: "Get Event",
    description: "Get full details of a calendar event by ID.",
    parameters: GetEventSchema,
    execute: (client, params) => getEvent(client, params as Parameters<typeof getEvent>[1]),
  },
  {
    name: "nylas_create_event",
    label: "Create Event",
    description: "Create a new calendar event with title, time, location, and participants.",
    parameters: CreateEventSchema,
    execute: (client, params) => createEvent(client, params as Parameters<typeof createEvent>[1]),
  },
  {
    name: "nylas_update_event",
    label: "Update Event",
    description: "Update an existing calendar event.",
    parameters: UpdateEventSchema,
    execute: (client, params) => updateEvent(client, params as Parameters<typeof updateEvent>[1]),
  },
  {
    name: "nylas_delete_event",
    label: "Delete Event",
    description: "Delete a calendar event.",
    parameters: DeleteEventSchema,
    execute: (client, params) => deleteEvent(client, params as Parameters<typeof deleteEvent>[1]),
  },
  {
    name: "nylas_check_availability",
    label: "Check Availability",
    description: "Check availability for a group of participants within a time window.",
    parameters: CheckAvailabilitySchema,
    execute: (client, params) => checkAvailability(client, params as Parameters<typeof checkAvailability>[1]),
  },

  // Contact tools
  {
    name: "nylas_list_contacts",
    label: "List Contacts",
    description: "List contacts with optional filters for email, phone, or group.",
    parameters: ListContactsSchema,
    execute: (client, params) => listContacts(client, params as Parameters<typeof listContacts>[1]),
  },
  {
    name: "nylas_get_contact",
    label: "Get Contact",
    description: "Get full details of a contact by ID.",
    parameters: GetContactSchema,
    execute: (client, params) => getContact(client, params as Parameters<typeof getContact>[1]),
  },
];

export { Type };
