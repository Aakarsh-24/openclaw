import Nylas from "nylas";
import type { NylasConfig } from "./config.js";

/**
 * Filter out undefined values from an object.
 * The Nylas SDK sends undefined values as query params, causing API errors.
 */
function filterDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }
  return result;
}

export type NylasClientOptions = {
  config: NylasConfig;
  logger?: {
    debug?: (message: string) => void;
    error: (message: string) => void;
  };
};

export class NylasApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly requestId?: string,
    public readonly errorType?: string,
  ) {
    super(message);
    this.name = "NylasApiError";
  }
}

/**
 * Wrapper around the official Nylas SDK that handles grant resolution
 * and provides a simplified interface for the plugin.
 */
export class NylasClient {
  public readonly sdk: Nylas;
  private readonly defaultGrantId?: string;
  private readonly grants: Record<string, string>;
  private readonly logger?: NylasClientOptions["logger"];

  constructor(options: NylasClientOptions) {
    const { config, logger } = options;

    this.sdk = new Nylas({
      apiKey: config.apiKey ?? "",
      apiUri: config.apiUri,
    });

    this.defaultGrantId = config.defaultGrantId;
    this.grants = config.grants;
    this.logger = logger;
  }

  /**
   * Resolve a grant name or ID to an actual grant ID.
   * If no grant is provided, uses the default grant ID.
   */
  resolveGrantId(grantIdOrName?: string): string {
    if (!grantIdOrName) {
      if (!this.defaultGrantId) {
        throw new NylasApiError("No grant ID provided and no defaultGrantId configured");
      }
      return this.defaultGrantId;
    }

    // Check if it's a named grant
    if (this.grants[grantIdOrName]) {
      return this.grants[grantIdOrName];
    }

    // Assume it's a raw grant ID
    return grantIdOrName;
  }

  // ==========================================================================
  // Grants (Account Discovery) - doesn't require a grant ID
  // ==========================================================================

  async listGrants(params?: {
    limit?: number;
    offset?: number;
    provider?: string;
    email?: string;
  }) {
    this.logger?.debug?.(`[nylas] listGrants`);
    try {
      const queryParams = params
        ? filterDefined({
            limit: params.limit,
            offset: params.offset,
            provider: params.provider as any,
            email: params.email,
          })
        : undefined;
      return await this.sdk.grants.list({
        queryParams: Object.keys(queryParams ?? {}).length > 0 ? queryParams : undefined,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getGrant(grantId: string) {
    this.logger?.debug?.(`[nylas] getGrant ${grantId}`);
    try {
      return await this.sdk.grants.find({ grantId });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Messages
  // ==========================================================================

  async listMessages(params?: {
    grant?: string;
    limit?: number;
    pageToken?: string;
    subject?: string;
    from?: string;
    to?: string;
    in?: string;
    unread?: boolean;
    starred?: boolean;
    hasAttachment?: boolean;
    receivedBefore?: number;
    receivedAfter?: number;
  }) {
    const grantId = this.resolveGrantId(params?.grant);
    this.logger?.debug?.(`[nylas] listMessages for ${grantId}`);
    try {
      const queryParams = params
        ? filterDefined({
            limit: params.limit,
            pageToken: params.pageToken,
            subject: params.subject,
            from: params.from,
            to: params.to,
            in: params.in,
            unread: params.unread,
            starred: params.starred,
            hasAttachment: params.hasAttachment,
            receivedBefore: params.receivedBefore,
            receivedAfter: params.receivedAfter,
          })
        : undefined;
      return await this.sdk.messages.list({
        identifier: grantId,
        queryParams: Object.keys(queryParams ?? {}).length > 0 ? queryParams : undefined,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getMessage(messageId: string, grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] getMessage ${messageId}`);
    try {
      return await this.sdk.messages.find({
        identifier: grantId,
        messageId,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async sendMessage(params: {
    grant?: string;
    to?: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    replyTo?: Array<{ email: string; name?: string }>;
    subject?: string;
    body?: string;
    replyToMessageId?: string;
  }) {
    const grantId = this.resolveGrantId(params.grant);
    this.logger?.debug?.(`[nylas] sendMessage`);
    try {
      return await this.sdk.messages.send({
        identifier: grantId,
        requestBody: {
          to: params.to,
          cc: params.cc,
          bcc: params.bcc,
          replyTo: params.replyTo,
          subject: params.subject,
          body: params.body,
          replyToMessageId: params.replyToMessageId,
        },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Threads
  // ==========================================================================

  async listThreads(params?: {
    grant?: string;
    limit?: number;
    pageToken?: string;
    subject?: string;
    from?: string;
    to?: string;
    in?: string;
    unread?: boolean;
    starred?: boolean;
  }) {
    const grantId = this.resolveGrantId(params?.grant);
    this.logger?.debug?.(`[nylas] listThreads for ${grantId}`);
    try {
      const queryParams = params
        ? filterDefined({
            limit: params.limit,
            pageToken: params.pageToken,
            subject: params.subject,
            from: params.from,
            to: params.to,
            in: params.in,
            unread: params.unread,
            starred: params.starred,
          })
        : undefined;
      return await this.sdk.threads.list({
        identifier: grantId,
        queryParams: Object.keys(queryParams ?? {}).length > 0 ? queryParams : undefined,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Folders
  // ==========================================================================

  async listFolders(grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] listFolders for ${grantId}`);
    try {
      return await this.sdk.folders.list({ identifier: grantId });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Drafts
  // ==========================================================================

  async createDraft(params: {
    grant?: string;
    to?: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    subject?: string;
    body?: string;
    replyToMessageId?: string;
  }) {
    const grantId = this.resolveGrantId(params.grant);
    this.logger?.debug?.(`[nylas] createDraft`);
    try {
      return await this.sdk.drafts.create({
        identifier: grantId,
        requestBody: {
          to: params.to,
          cc: params.cc,
          bcc: params.bcc,
          subject: params.subject,
          body: params.body,
          replyToMessageId: params.replyToMessageId,
        },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Calendars
  // ==========================================================================

  async listCalendars(grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] listCalendars for ${grantId}`);
    try {
      return await this.sdk.calendars.list({ identifier: grantId });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  async listEvents(params?: {
    grant?: string;
    calendarId?: string;
    limit?: number;
    pageToken?: string;
    start?: number;
    end?: number;
    title?: string;
    showCancelled?: boolean;
    expandRecurring?: boolean;
  }) {
    const grantId = this.resolveGrantId(params?.grant);
    this.logger?.debug?.(`[nylas] listEvents for ${grantId}`);
    try {
      const queryParams = filterDefined({
        calendarId: params?.calendarId ?? "primary",
        limit: params?.limit,
        pageToken: params?.pageToken,
        start: params?.start,
        end: params?.end,
        title: params?.title,
        showCancelled: params?.showCancelled,
        expandRecurring: params?.expandRecurring,
      });
      return await this.sdk.events.list({
        identifier: grantId,
        queryParams: queryParams as any,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getEvent(eventId: string, calendarId: string, grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] getEvent ${eventId}`);
    try {
      return await this.sdk.events.find({
        identifier: grantId,
        eventId,
        queryParams: { calendarId },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async createEvent(params: {
    grant?: string;
    calendarId: string;
    title?: string;
    description?: string;
    location?: string;
    when: any; // SDK's When type
    participants?: Array<{ email: string; name?: string }>;
    busy?: boolean;
  }) {
    const grantId = this.resolveGrantId(params.grant);
    this.logger?.debug?.(`[nylas] createEvent`);
    try {
      return await this.sdk.events.create({
        identifier: grantId,
        queryParams: { calendarId: params.calendarId },
        requestBody: {
          title: params.title,
          description: params.description,
          location: params.location,
          when: params.when,
          participants: params.participants,
          busy: params.busy,
        },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async updateEvent(
    eventId: string,
    calendarId: string,
    params: {
      grant?: string;
      title?: string;
      description?: string;
      location?: string;
      when?: any;
      participants?: Array<{ email: string; name?: string }>;
      busy?: boolean;
    },
  ) {
    const grantId = this.resolveGrantId(params.grant);
    this.logger?.debug?.(`[nylas] updateEvent ${eventId}`);
    try {
      return await this.sdk.events.update({
        identifier: grantId,
        eventId,
        queryParams: { calendarId },
        requestBody: {
          title: params.title,
          description: params.description,
          location: params.location,
          when: params.when,
          participants: params.participants,
          busy: params.busy,
        },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async deleteEvent(eventId: string, calendarId: string, grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] deleteEvent ${eventId}`);
    try {
      await this.sdk.events.destroy({
        identifier: grantId,
        eventId,
        queryParams: { calendarId },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Availability
  // ==========================================================================

  async checkAvailability(params: {
    startTime: number;
    endTime: number;
    participants: Array<{ email: string }>;
    durationMinutes: number;
    intervalMinutes?: number;
  }) {
    this.logger?.debug?.(`[nylas] checkAvailability`);
    try {
      return await this.sdk.calendars.getAvailability({
        requestBody: {
          startTime: params.startTime,
          endTime: params.endTime,
          participants: params.participants.map((p) => ({ email: p.email })),
          durationMinutes: params.durationMinutes,
          intervalMinutes: params.intervalMinutes,
        },
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Contacts
  // ==========================================================================

  async listContacts(params?: {
    grant?: string;
    limit?: number;
    pageToken?: string;
    email?: string;
    phoneNumber?: string;
    source?: string;
    group?: string;
  }) {
    const grantId = this.resolveGrantId(params?.grant);
    this.logger?.debug?.(`[nylas] listContacts for ${grantId}`);
    try {
      const queryParams = params
        ? filterDefined({
            limit: params.limit,
            pageToken: params.pageToken,
            email: params.email,
            phoneNumber: params.phoneNumber,
            source: params.source as any,
            group: params.group,
          })
        : undefined;
      return await this.sdk.contacts.list({
        identifier: grantId,
        queryParams: Object.keys(queryParams ?? {}).length > 0 ? queryParams : undefined,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getContact(contactId: string, grant?: string) {
    const grantId = this.resolveGrantId(grant);
    this.logger?.debug?.(`[nylas] getContact ${contactId}`);
    try {
      return await this.sdk.contacts.find({
        identifier: grantId,
        contactId,
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ==========================================================================
  // Error handling
  // ==========================================================================

  private wrapError(err: unknown): NylasApiError {
    if (err instanceof NylasApiError) {
      return err;
    }

    // Handle Nylas SDK errors
    const error = err as any;
    if (error?.statusCode || error?.requestId) {
      return new NylasApiError(
        error.message ?? String(err),
        error.statusCode,
        error.requestId,
        error.type,
      );
    }

    return new NylasApiError(
      err instanceof Error ? err.message : String(err),
    );
  }
}
