import { Type, type Static } from "@sinclair/typebox";
import type { NylasClient } from "../client.js";

// Helper to format participant
function formatParticipant(p: { email: string; name?: string; status?: string }): string {
  const parts = [p.email];
  if (p.name) parts.unshift(p.name);
  if (p.status && p.status !== "noreply") parts.push(`(${p.status})`);
  return parts.join(" ");
}

// Helper to parse participant emails
function parseParticipants(emails: string | string[] | undefined): Array<{ email: string }> | undefined {
  if (!emails) return undefined;
  const items = Array.isArray(emails) ? emails : emails.split(",").map((s) => s.trim());
  return items.filter(Boolean).map((email) => ({ email }));
}

// Helper to format event time for display
function formatEventWhen(when: any): { start: string; end?: string; all_day?: boolean } {
  if (!when) return { start: "unknown" };

  // Handle different "when" types from Nylas SDK
  if (when.date) {
    return { start: when.date, all_day: true };
  }
  if (when.startDate && when.endDate) {
    return { start: when.startDate, end: when.endDate, all_day: true };
  }
  if (when.time) {
    return { start: new Date(when.time * 1000).toISOString() };
  }
  if (when.startTime && when.endTime) {
    return {
      start: new Date(when.startTime * 1000).toISOString(),
      end: new Date(when.endTime * 1000).toISOString(),
    };
  }

  return { start: JSON.stringify(when) };
}

// Helper to create "when" object for SDK
function createWhen(
  start: string,
  end?: string,
  allDay?: boolean,
  timezone?: string,
): any {
  if (allDay) {
    if (end) {
      return {
        startDate: start.slice(0, 10),
        endDate: end.slice(0, 10),
      };
    }
    return { date: start.slice(0, 10) };
  }

  const startTime = Math.floor(new Date(start).getTime() / 1000);
  if (end) {
    const endTime = Math.floor(new Date(end).getTime() / 1000);
    return {
      startTime,
      endTime,
      startTimezone: timezone,
      endTimezone: timezone,
    };
  }
  return { time: startTime, timezone };
}

// =============================================================================
// List Calendars Tool
// =============================================================================

export const ListCalendarsSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type ListCalendarsParams = Static<typeof ListCalendarsSchema>;

export async function listCalendars(client: NylasClient, params: ListCalendarsParams) {
  const response = await client.listCalendars(params.grant);

  const calendars = response.data.map((cal) => ({
    id: cal.id,
    name: cal.name,
    description: cal.description,
    is_primary: cal.isPrimary,
    timezone: cal.timezone,
    read_only: cal.readOnly,
  }));

  return { calendars };
}

// =============================================================================
// List Events Tool
// =============================================================================

export const ListEventsSchema = Type.Object({
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
  calendar_id: Type.Optional(Type.String({ description: "Calendar ID to list events from (uses primary if not specified)" })),
  start: Type.Optional(Type.String({ description: "ISO 8601 date/time - events starting after this time" })),
  end: Type.Optional(Type.String({ description: "ISO 8601 date/time - events ending before this time" })),
  title: Type.Optional(Type.String({ description: "Filter by event title (partial match)" })),
  show_cancelled: Type.Optional(Type.Boolean({ description: "Include cancelled events" })),
  expand_recurring: Type.Optional(Type.Boolean({ description: "Expand recurring events into individual instances" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 25, max: 100)" })),
  page_token: Type.Optional(Type.String({ description: "Pagination token for next page" })),
});

export type ListEventsParams = Static<typeof ListEventsSchema>;

export async function listEvents(client: NylasClient, params: ListEventsParams) {
  const limit = Math.min(params.limit ?? 25, 100);

  const response = await client.listEvents({
    grant: params.grant,
    calendarId: params.calendar_id,
    limit,
    pageToken: params.page_token,
    title: params.title,
    start: params.start ? Math.floor(new Date(params.start).getTime() / 1000) : undefined,
    end: params.end ? Math.floor(new Date(params.end).getTime() / 1000) : undefined,
    showCancelled: params.show_cancelled,
    expandRecurring: params.expand_recurring,
  });

  const events = response.data.map((event) => {
    const time = formatEventWhen(event.when);
    return {
      id: event.id,
      calendar_id: event.calendarId,
      title: event.title ?? "(no title)",
      description: event.description,
      location: event.location,
      start: time.start,
      end: time.end,
      all_day: time.all_day,
      participants: event.participants?.map(formatParticipant),
      status: event.status,
      busy: event.busy,
      conferencing_url: event.conferencing?.details?.url,
    };
  });

  return {
    events,
    has_more: !!response.nextCursor,
    next_page_token: response.nextCursor,
    count: events.length,
  };
}

// =============================================================================
// Get Event Tool
// =============================================================================

export const GetEventSchema = Type.Object({
  event_id: Type.String({ description: "The event ID" }),
  calendar_id: Type.String({ description: "The calendar ID the event belongs to" }),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type GetEventParams = Static<typeof GetEventSchema>;

export async function getEvent(client: NylasClient, params: GetEventParams) {
  const response = await client.getEvent(params.event_id, params.calendar_id, params.grant);
  const event = response.data;
  const time = formatEventWhen(event.when);

  return {
    id: event.id,
    calendar_id: event.calendarId,
    title: event.title ?? "(no title)",
    description: event.description,
    location: event.location,
    start: time.start,
    end: time.end,
    all_day: time.all_day,
    participants: event.participants?.map(formatParticipant),
    status: event.status,
    visibility: event.visibility,
    busy: event.busy,
    read_only: event.readOnly,
    conferencing: event.conferencing,
    created_at: event.createdAt ? new Date(event.createdAt * 1000).toISOString() : undefined,
    updated_at: event.updatedAt ? new Date(event.updatedAt * 1000).toISOString() : undefined,
  };
}

// =============================================================================
// Create Event Tool
// =============================================================================

export const CreateEventSchema = Type.Object({
  calendar_id: Type.String({ description: "Calendar ID to create the event in" }),
  title: Type.String({ description: "Event title" }),
  start: Type.String({ description: "ISO 8601 start date/time (e.g., '2024-03-20T10:00:00Z' or '2024-03-20' for all-day)" }),
  end: Type.Optional(Type.String({ description: "ISO 8601 end date/time" })),
  all_day: Type.Optional(Type.Boolean({ description: "Whether this is an all-day event" })),
  timezone: Type.Optional(Type.String({ description: "Timezone for the event (e.g., 'America/New_York')" })),
  description: Type.Optional(Type.String({ description: "Event description" })),
  location: Type.Optional(Type.String({ description: "Event location" })),
  participants: Type.Optional(Type.String({ description: "Comma-separated list of participant emails to invite" })),
  busy: Type.Optional(Type.Boolean({ description: "Whether to show as busy during this event (default: true)" })),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type CreateEventParams = Static<typeof CreateEventSchema>;

export async function createEvent(client: NylasClient, params: CreateEventParams) {
  const response = await client.createEvent({
    grant: params.grant,
    calendarId: params.calendar_id,
    title: params.title,
    when: createWhen(params.start, params.end, params.all_day, params.timezone),
    description: params.description,
    location: params.location,
    participants: parseParticipants(params.participants),
    busy: params.busy ?? true,
  });

  const event = response.data;
  const time = formatEventWhen(event.when);

  return {
    success: true,
    event_id: event.id,
    calendar_id: event.calendarId,
    title: event.title,
    start: time.start,
    end: time.end,
    all_day: time.all_day,
  };
}

// =============================================================================
// Update Event Tool
// =============================================================================

export const UpdateEventSchema = Type.Object({
  event_id: Type.String({ description: "The event ID to update" }),
  calendar_id: Type.String({ description: "The calendar ID the event belongs to" }),
  title: Type.Optional(Type.String({ description: "New event title" })),
  start: Type.Optional(Type.String({ description: "New ISO 8601 start date/time" })),
  end: Type.Optional(Type.String({ description: "New ISO 8601 end date/time" })),
  all_day: Type.Optional(Type.Boolean({ description: "Whether this is an all-day event" })),
  timezone: Type.Optional(Type.String({ description: "Timezone for the event" })),
  description: Type.Optional(Type.String({ description: "New event description" })),
  location: Type.Optional(Type.String({ description: "New event location" })),
  participants: Type.Optional(Type.String({ description: "New comma-separated list of participant emails" })),
  busy: Type.Optional(Type.Boolean({ description: "Whether to show as busy during this event" })),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type UpdateEventParams = Static<typeof UpdateEventSchema>;

export async function updateEvent(client: NylasClient, params: UpdateEventParams) {
  const updateData: any = { grant: params.grant };

  if (params.title !== undefined) updateData.title = params.title;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.location !== undefined) updateData.location = params.location;
  if (params.busy !== undefined) updateData.busy = params.busy;
  if (params.participants !== undefined) updateData.participants = parseParticipants(params.participants);
  if (params.start !== undefined) {
    updateData.when = createWhen(params.start, params.end, params.all_day, params.timezone);
  }

  const response = await client.updateEvent(params.event_id, params.calendar_id, updateData);
  const event = response.data;
  const time = formatEventWhen(event.when);

  return {
    success: true,
    event_id: event.id,
    title: event.title,
    start: time.start,
    end: time.end,
  };
}

// =============================================================================
// Delete Event Tool
// =============================================================================

export const DeleteEventSchema = Type.Object({
  event_id: Type.String({ description: "The event ID to delete" }),
  calendar_id: Type.String({ description: "The calendar ID the event belongs to" }),
  grant: Type.Optional(Type.String({ description: "Named grant or grant ID (uses default if not specified)" })),
});

export type DeleteEventParams = Static<typeof DeleteEventSchema>;

export async function deleteEvent(client: NylasClient, params: DeleteEventParams) {
  await client.deleteEvent(params.event_id, params.calendar_id, params.grant);
  return { success: true, event_id: params.event_id };
}

// =============================================================================
// Check Availability Tool
// =============================================================================

export const CheckAvailabilitySchema = Type.Object({
  emails: Type.String({ description: "Comma-separated list of participant emails to check availability for" }),
  start: Type.String({ description: "ISO 8601 start date/time for availability window" }),
  end: Type.String({ description: "ISO 8601 end date/time for availability window" }),
  duration_minutes: Type.Number({ description: "Required meeting duration in minutes" }),
  interval_minutes: Type.Optional(Type.Number({ description: "Interval between time slots in minutes (default: 15)" })),
});

export type CheckAvailabilityParams = Static<typeof CheckAvailabilitySchema>;

export async function checkAvailability(client: NylasClient, params: CheckAvailabilityParams) {
  const emails = params.emails.split(",").map((e) => e.trim()).filter(Boolean);

  const response = await client.checkAvailability({
    startTime: Math.floor(new Date(params.start).getTime() / 1000),
    endTime: Math.floor(new Date(params.end).getTime() / 1000),
    durationMinutes: params.duration_minutes,
    intervalMinutes: params.interval_minutes ?? 15,
    participants: emails.map((email) => ({ email })),
  });

  const slots = response.data.timeSlots?.map((slot) => ({
    start: new Date(slot.startTime * 1000).toISOString(),
    end: new Date(slot.endTime * 1000).toISOString(),
    available_for: slot.emails,
  })) ?? [];

  return {
    available_slots: slots,
    checked_emails: response.data.order,
    slot_count: slots.length,
  };
}
