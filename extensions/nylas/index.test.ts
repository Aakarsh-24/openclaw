import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseNylasConfig, validateNylasConfig, type NylasConfig } from "./src/config.js";
import { NylasClient, NylasApiError } from "./src/client.js";
import { nylasTools, discoverGrants } from "./src/tools/index.js";
import { registerNylasCli } from "./src/cli.js";
import {
  listEmails,
  getEmail,
  sendEmail,
  createDraft,
  listThreads,
  listFolders,
} from "./src/tools/email.js";
import {
  listCalendars,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  checkAvailability,
} from "./src/tools/calendar.js";
import { listContacts, getContact } from "./src/tools/contacts.js";
import nylasPlugin from "./index.js";

// Mock the Nylas SDK with a class to work with both node and bun
vi.mock("nylas", () => {
  const MockNylas = class {
    grants = {
      list: vi.fn(),
      find: vi.fn(),
    };
    messages = {
      list: vi.fn(),
      find: vi.fn(),
      send: vi.fn(),
    };
    threads = {
      list: vi.fn(),
    };
    folders = {
      list: vi.fn(),
    };
    drafts = {
      create: vi.fn(),
    };
    calendars = {
      list: vi.fn(),
      getAvailability: vi.fn(),
    };
    events = {
      list: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    contacts = {
      list: vi.fn(),
      find: vi.fn(),
    };
  };
  return { default: MockNylas };
});

describe("Nylas Plugin", () => {
  // ===========================================================================
  // Config Tests
  // ===========================================================================
  describe("Config", () => {
    describe("parseNylasConfig", () => {
      it("parses minimal config with defaults", () => {
        const config = parseNylasConfig({});
        expect(config.enabled).toBe(true);
        expect(config.apiUri).toBe("https://api.us.nylas.com");
        expect(config.defaultTimezone).toBe("UTC");
        expect(config.grants).toEqual({});
        expect(config.apiKey).toBeUndefined();
        expect(config.defaultGrantId).toBeUndefined();
      });

      it("parses full config", () => {
        const config = parseNylasConfig({
          enabled: false,
          apiKey: "test-key",
          apiUri: "https://api.eu.nylas.com",
          defaultGrantId: "grant-123",
          defaultTimezone: "America/New_York",
          grants: { work: "work-grant", personal: "personal-grant" },
        });
        expect(config.enabled).toBe(false);
        expect(config.apiKey).toBe("test-key");
        expect(config.apiUri).toBe("https://api.eu.nylas.com");
        expect(config.defaultGrantId).toBe("grant-123");
        expect(config.defaultTimezone).toBe("America/New_York");
        expect(config.grants).toEqual({ work: "work-grant", personal: "personal-grant" });
      });

      it("handles non-object input", () => {
        const config = parseNylasConfig(null);
        expect(config.enabled).toBe(true);
        expect(config.apiUri).toBe("https://api.us.nylas.com");
      });

      it("handles array input", () => {
        const config = parseNylasConfig([]);
        expect(config.enabled).toBe(true);
      });

      it("handles string input", () => {
        const config = parseNylasConfig("invalid");
        expect(config.enabled).toBe(true);
      });

      it("preserves boolean enabled=false", () => {
        const config = parseNylasConfig({ enabled: false });
        expect(config.enabled).toBe(false);
      });

      it("uses EU API URI when specified", () => {
        const config = parseNylasConfig({ apiUri: "https://api.eu.nylas.com" });
        expect(config.apiUri).toBe("https://api.eu.nylas.com");
      });
    });

    describe("validateNylasConfig", () => {
      it("validates missing apiKey", () => {
        const config = parseNylasConfig({ defaultGrantId: "grant-123" });
        const validation = validateNylasConfig(config);
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
          expect(validation.errors).toContain("apiKey is required");
        }
      });

      it("validates missing grant", () => {
        const config = parseNylasConfig({ apiKey: "test-key" });
        const validation = validateNylasConfig(config);
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
          expect(validation.errors).toContain("defaultGrantId or at least one named grant is required");
        }
      });

      it("validates with defaultGrantId", () => {
        const config = parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-123" });
        const validation = validateNylasConfig(config);
        expect(validation.valid).toBe(true);
      });

      it("validates with named grants only", () => {
        const config = parseNylasConfig({ apiKey: "test-key", grants: { work: "grant-123" } });
        const validation = validateNylasConfig(config);
        expect(validation.valid).toBe(true);
      });

      it("returns multiple errors", () => {
        const config = parseNylasConfig({});
        const validation = validateNylasConfig(config);
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
          expect(validation.errors.length).toBe(2);
          expect(validation.errors).toContain("apiKey is required");
          expect(validation.errors).toContain("defaultGrantId or at least one named grant is required");
        }
      });
    });
  });

  // ===========================================================================
  // Client Tests
  // ===========================================================================
  describe("Client", () => {
    const testConfig: NylasConfig = {
      enabled: true,
      apiKey: "test-api-key",
      apiUri: "https://api.us.nylas.com",
      defaultGrantId: "default-grant",
      defaultTimezone: "UTC",
      grants: { work: "work-grant", personal: "personal-grant" },
    };

    it("creates client with config", () => {
      const client = new NylasClient({ config: testConfig });
      expect(client).toBeInstanceOf(NylasClient);
      expect(client.sdk).toBeDefined();
    });

    describe("resolveGrantId", () => {
      it("returns default grant when no argument", () => {
        const client = new NylasClient({ config: testConfig });
        expect(client.resolveGrantId()).toBe("default-grant");
      });

      it("resolves named grant", () => {
        const client = new NylasClient({ config: testConfig });
        expect(client.resolveGrantId("work")).toBe("work-grant");
        expect(client.resolveGrantId("personal")).toBe("personal-grant");
      });

      it("returns raw grant ID if not a named grant", () => {
        const client = new NylasClient({ config: testConfig });
        expect(client.resolveGrantId("some-random-id")).toBe("some-random-id");
      });

      it("throws when no default grant and no argument", () => {
        const config = { ...testConfig, defaultGrantId: undefined };
        const client = new NylasClient({ config });
        expect(() => client.resolveGrantId()).toThrow("No grant ID provided");
      });
    });

    describe("listGrants", () => {
      it("calls SDK grants.list", async () => {
        const client = new NylasClient({ config: testConfig });
        const mockData = {
          data: [
            { id: "grant-1", email: "test@example.com", provider: "google", grantStatus: "valid" },
          ],
        };
        (client.sdk.grants.list as any).mockResolvedValue(mockData);

        const result = await client.listGrants();
        expect(client.sdk.grants.list).toHaveBeenCalled();
        expect(result.data).toHaveLength(1);
        expect(result.data[0].email).toBe("test@example.com");
      });

      it("passes query params", async () => {
        const client = new NylasClient({ config: testConfig });
        (client.sdk.grants.list as any).mockResolvedValue({ data: [] });

        await client.listGrants({ limit: 10, provider: "google" });
        expect(client.sdk.grants.list).toHaveBeenCalledWith({
          queryParams: { limit: 10, provider: "google", offset: undefined, email: undefined },
        });
      });
    });

    describe("listMessages", () => {
      it("calls SDK messages.list with resolved grant", async () => {
        const client = new NylasClient({ config: testConfig });
        const mockData = { data: [], nextCursor: null };
        (client.sdk.messages.list as any).mockResolvedValue(mockData);

        await client.listMessages({ grant: "work", limit: 10 });
        expect(client.sdk.messages.list).toHaveBeenCalledWith({
          identifier: "work-grant",
          queryParams: expect.objectContaining({ limit: 10 }),
        });
      });
    });

    describe("error handling", () => {
      it("wraps SDK errors", async () => {
        const client = new NylasClient({ config: testConfig });
        const sdkError = { message: "Unauthorized", statusCode: 401, requestId: "req-123" };
        (client.sdk.grants.list as any).mockRejectedValue(sdkError);

        await expect(client.listGrants()).rejects.toThrow(NylasApiError);
        try {
          await client.listGrants();
        } catch (err) {
          expect(err).toBeInstanceOf(NylasApiError);
          expect((err as NylasApiError).statusCode).toBe(401);
          expect((err as NylasApiError).requestId).toBe("req-123");
        }
      });

      it("handles generic errors", async () => {
        const client = new NylasClient({ config: testConfig });
        (client.sdk.grants.list as any).mockRejectedValue(new Error("Network error"));

        await expect(client.listGrants()).rejects.toThrow(NylasApiError);
      });
    });
  });

  // ===========================================================================
  // NylasApiError Tests
  // ===========================================================================
  describe("NylasApiError", () => {
    it("creates error with all properties", () => {
      const error = new NylasApiError("Test error", 401, "req-123", "unauthorized");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(401);
      expect(error.requestId).toBe("req-123");
      expect(error.errorType).toBe("unauthorized");
      expect(error.name).toBe("NylasApiError");
    });

    it("creates error with minimal properties", () => {
      const error = new NylasApiError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBeUndefined();
      expect(error.requestId).toBeUndefined();
    });

    it("is instanceof Error", () => {
      const error = new NylasApiError("Test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ===========================================================================
  // Tools Tests
  // ===========================================================================
  describe("Tools", () => {
    it("has correct number of tools", () => {
      expect(nylasTools.length).toBe(16);
    });

    it("all tools have required properties", () => {
      for (const tool of nylasTools) {
        expect(tool.name).toBeDefined();
        expect(tool.name.startsWith("nylas_")).toBe(true);
        expect(tool.label).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(typeof tool.execute).toBe("function");
      }
    });

    it("all tool names are unique", () => {
      const names = nylasTools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    describe("discover grants tool", () => {
      it("exists and has correct metadata", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_discover_grants");
        expect(tool).toBeDefined();
        expect(tool?.description).toContain("authenticated");
        expect(tool?.label).toBe("Discover Grants");
      });
    });

    describe("email tools", () => {
      const emailTools = ["nylas_list_emails", "nylas_get_email", "nylas_send_email", "nylas_create_draft", "nylas_list_threads", "nylas_list_folders"];

      it("includes all email tools", () => {
        for (const name of emailTools) {
          const tool = nylasTools.find((t) => t.name === name);
          expect(tool).toBeDefined();
        }
      });

      it("list_emails has correct parameters", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_list_emails");
        expect(tool?.parameters).toBeDefined();
        const props = (tool?.parameters as any).properties;
        expect(props.grant).toBeDefined();
        expect(props.folder).toBeDefined();
        expect(props.subject).toBeDefined();
        expect(props.from).toBeDefined();
        expect(props.unread).toBeDefined();
        expect(props.limit).toBeDefined();
      });

      it("send_email has required parameters", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_send_email");
        const required = (tool?.parameters as any).required ?? [];
        expect(required).toContain("to");
        expect(required).toContain("subject");
        expect(required).toContain("body");
      });
    });

    describe("calendar tools", () => {
      const calendarTools = ["nylas_list_calendars", "nylas_list_events", "nylas_get_event", "nylas_create_event", "nylas_update_event", "nylas_delete_event", "nylas_check_availability"];

      it("includes all calendar tools", () => {
        for (const name of calendarTools) {
          const tool = nylasTools.find((t) => t.name === name);
          expect(tool).toBeDefined();
        }
      });

      it("create_event has required parameters", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_create_event");
        const required = (tool?.parameters as any).required ?? [];
        expect(required).toContain("calendar_id");
        expect(required).toContain("title");
        expect(required).toContain("start");
      });

      it("check_availability has correct parameters", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_check_availability");
        const props = (tool?.parameters as any).properties;
        expect(props.emails).toBeDefined();
        expect(props.start).toBeDefined();
        expect(props.end).toBeDefined();
        expect(props.duration_minutes).toBeDefined();
      });
    });

    describe("contact tools", () => {
      it("includes list_contacts tool", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_list_contacts");
        expect(tool).toBeDefined();
        expect(tool?.description).toContain("contact");
      });

      it("includes get_contact tool", () => {
        const tool = nylasTools.find((t) => t.name === "nylas_get_contact");
        expect(tool).toBeDefined();
        const required = (tool?.parameters as any).required ?? [];
        expect(required).toContain("contact_id");
      });
    });
  });

  // ===========================================================================
  // Plugin Definition Tests
  // ===========================================================================
  describe("Plugin Definition", () => {
    it("has correct metadata", () => {
      expect(nylasPlugin.id).toBe("nylas");
      expect(nylasPlugin.name).toBe("Nylas");
      expect(nylasPlugin.description.toLowerCase()).toContain("email");
      expect(nylasPlugin.description.toLowerCase()).toContain("calendar");
    });

    it("has config schema with parse function", () => {
      expect(nylasPlugin.configSchema).toBeDefined();
      expect(typeof nylasPlugin.configSchema.parse).toBe("function");
    });

    it("has config schema with uiHints", () => {
      expect(nylasPlugin.configSchema.uiHints).toBeDefined();
      expect(nylasPlugin.configSchema.uiHints.apiKey).toBeDefined();
      expect(nylasPlugin.configSchema.uiHints.apiKey.sensitive).toBe(true);
    });

    it("has register function", () => {
      expect(typeof nylasPlugin.register).toBe("function");
    });

    describe("register", () => {
      it("registers all tools", () => {
        const registeredTools: string[] = [];
        const mockApi = {
          id: "nylas",
          name: "Nylas",
          source: "test",
          config: {},
          pluginConfig: { apiKey: "test", defaultGrantId: "grant" },
          runtime: {},
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
          registerTool: (tool: any) => registeredTools.push(tool.name),
          registerCli: vi.fn(),
          registerGatewayMethod: vi.fn(),
        };

        nylasPlugin.register(mockApi as any);
        expect(registeredTools).toHaveLength(16);
        expect(registeredTools).toContain("nylas_discover_grants");
        expect(registeredTools).toContain("nylas_list_emails");
        expect(registeredTools).toContain("nylas_send_email");
      });

      it("registers CLI commands", () => {
        const mockRegisterCli = vi.fn();
        const mockApi = {
          id: "nylas",
          name: "Nylas",
          source: "test",
          config: {},
          pluginConfig: { apiKey: "test", defaultGrantId: "grant" },
          runtime: {},
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
          registerTool: vi.fn(),
          registerCli: mockRegisterCli,
          registerGatewayMethod: vi.fn(),
        };

        nylasPlugin.register(mockApi as any);
        expect(mockRegisterCli).toHaveBeenCalledWith(
          expect.any(Function),
          { commands: ["nylas"] },
        );
      });

      it("registers gateway methods", () => {
        const registeredMethods: string[] = [];
        const mockApi = {
          id: "nylas",
          name: "Nylas",
          source: "test",
          config: {},
          pluginConfig: { apiKey: "test", defaultGrantId: "grant" },
          runtime: {},
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
          registerTool: vi.fn(),
          registerCli: vi.fn(),
          registerGatewayMethod: (method: string) => registeredMethods.push(method),
        };

        nylasPlugin.register(mockApi as any);
        expect(registeredMethods).toContain("nylas.discoverGrants");
        expect(registeredMethods).toContain("nylas.listEmails");
        expect(registeredMethods).toContain("nylas.getMessage");
        expect(registeredMethods).toContain("nylas.sendMessage");
        expect(registeredMethods).toContain("nylas.listCalendars");
        expect(registeredMethods).toContain("nylas.listEvents");
        expect(registeredMethods).toContain("nylas.createEvent");
        expect(registeredMethods).toContain("nylas.listContacts");
      });
    });
  });
});

// ===========================================================================
// Email Tools Implementation Tests
// ===========================================================================
describe("Email Tools", () => {
  const createMockClient = () => {
    return {
      listMessages: vi.fn(),
      getMessage: vi.fn(),
      sendMessage: vi.fn(),
      createDraft: vi.fn(),
      listThreads: vi.fn(),
      listFolders: vi.fn(),
    } as any;
  };

  describe("listEmails", () => {
    it("returns formatted email list", async () => {
      const client = createMockClient();
      client.listMessages.mockResolvedValue({
        data: [
          {
            id: "msg-1",
            threadId: "thread-1",
            subject: "Test Subject",
            from: [{ email: "sender@example.com", name: "Sender" }],
            to: [{ email: "recipient@example.com" }],
            date: 1700000000,
            unread: true,
            starred: false,
            snippet: "Preview text...",
            attachments: [],
            folders: ["INBOX"],
          },
        ],
        nextCursor: "next-token",
      });

      const result = await listEmails(client, { limit: 10 });

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].id).toBe("msg-1");
      expect(result.emails[0].subject).toBe("Test Subject");
      expect(result.emails[0].from).toBe("Sender <sender@example.com>");
      expect(result.emails[0].unread).toBe(true);
      expect(result.has_more).toBe(true);
      expect(result.next_page_token).toBe("next-token");
    });

    it("limits results to max 50", async () => {
      const client = createMockClient();
      client.listMessages.mockResolvedValue({ data: [], nextCursor: null });

      await listEmails(client, { limit: 100 });

      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("converts date filters to timestamps", async () => {
      const client = createMockClient();
      client.listMessages.mockResolvedValue({ data: [], nextCursor: null });

      await listEmails(client, {
        received_after: "2024-01-01T00:00:00Z",
        received_before: "2024-12-31T23:59:59Z",
      });

      expect(client.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          receivedAfter: expect.any(Number),
          receivedBefore: expect.any(Number),
        }),
      );
    });
  });

  describe("getEmail", () => {
    it("returns formatted email with full body", async () => {
      const client = createMockClient();
      client.getMessage.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          subject: "Test",
          from: [{ email: "sender@example.com" }],
          to: [{ email: "recipient@example.com" }],
          cc: [{ email: "cc@example.com" }],
          bcc: [],
          replyTo: [],
          date: 1700000000,
          body: "<p>Email body</p>",
          unread: false,
          starred: true,
          folders: ["INBOX"],
          attachments: [
            { id: "att-1", filename: "file.pdf", contentType: "application/pdf", size: 1024 },
          ],
        },
      });

      const result = await getEmail(client, { message_id: "msg-1" });

      expect(result.id).toBe("msg-1");
      expect(result.body).toBe("<p>Email body</p>");
      expect(result.starred).toBe(true);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments![0].filename).toBe("file.pdf");
    });
  });

  describe("sendEmail", () => {
    it("sends email and returns message id", async () => {
      const client = createMockClient();
      client.sendMessage.mockResolvedValue({
        data: { id: "sent-msg-1", threadId: "thread-1" },
      });

      const result = await sendEmail(client, {
        to: "recipient@example.com",
        subject: "Test",
        body: "Hello",
      });

      expect(result.success).toBe(true);
      expect(result.message_id).toBe("sent-msg-1");
      expect(client.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [{ email: "recipient@example.com" }],
          subject: "Test",
          body: "Hello",
        }),
      );
    });

    it("parses multiple recipients", async () => {
      const client = createMockClient();
      client.sendMessage.mockResolvedValue({
        data: { id: "msg-1", threadId: "thread-1" },
      });

      await sendEmail(client, {
        to: "a@example.com, John <b@example.com>",
        cc: "c@example.com",
        subject: "Test",
        body: "Hello",
      });

      expect(client.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [
            { email: "a@example.com" },
            { email: "b@example.com", name: "John" },
          ],
          cc: [{ email: "c@example.com" }],
        }),
      );
    });
  });

  describe("createDraft", () => {
    it("creates draft and returns draft id", async () => {
      const client = createMockClient();
      client.createDraft.mockResolvedValue({
        data: { id: "draft-1", threadId: "thread-1" },
      });

      const result = await createDraft(client, {
        to: "recipient@example.com",
        subject: "Draft subject",
        body: "Draft body",
      });

      expect(result.success).toBe(true);
      expect(result.draft_id).toBe("draft-1");
    });
  });

  describe("listThreads", () => {
    it("returns formatted thread list", async () => {
      const client = createMockClient();
      client.listThreads.mockResolvedValue({
        data: [
          {
            id: "thread-1",
            subject: "Thread Subject",
            participants: [
              { email: "a@example.com", name: "Alice" },
              { email: "b@example.com" },
            ],
            messageIds: ["msg-1", "msg-2", "msg-3"],
            snippet: "Latest message...",
            unread: true,
            starred: false,
            latestMessageReceivedDate: 1700000000,
            folders: ["INBOX"],
          },
        ],
        nextCursor: null,
      });

      const result = await listThreads(client, {});

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].subject).toBe("Thread Subject");
      expect(result.threads[0].message_count).toBe(3);
      expect(result.threads[0].participants).toContain("Alice <a@example.com>");
      expect(result.has_more).toBe(false);
    });
  });

  describe("listFolders", () => {
    it("returns formatted folder list", async () => {
      const client = createMockClient();
      client.listFolders.mockResolvedValue({
        data: [
          { id: "folder-1", name: "INBOX", systemFolder: true, unreadCount: 5, totalCount: 100 },
          { id: "folder-2", name: "Custom", systemFolder: false, totalCount: 10 },
        ],
      });

      const result = await listFolders(client, {});

      expect(result.folders).toHaveLength(2);
      expect(result.folders[0].name).toBe("INBOX");
      expect(result.folders[0].system_folder).toBe(true);
      expect(result.folders[0].unread_count).toBe(5);
    });
  });
});

// ===========================================================================
// Calendar Tools Implementation Tests
// ===========================================================================
describe("Calendar Tools", () => {
  const createMockClient = () => {
    return {
      listCalendars: vi.fn(),
      listEvents: vi.fn(),
      getEvent: vi.fn(),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
      checkAvailability: vi.fn(),
    } as any;
  };

  describe("listCalendars", () => {
    it("returns formatted calendar list", async () => {
      const client = createMockClient();
      client.listCalendars.mockResolvedValue({
        data: [
          { id: "cal-1", name: "Primary", isPrimary: true, timezone: "America/New_York", readOnly: false },
          { id: "cal-2", name: "Work", isPrimary: false, description: "Work calendar" },
        ],
      });

      const result = await listCalendars(client, {});

      expect(result.calendars).toHaveLength(2);
      expect(result.calendars[0].name).toBe("Primary");
      expect(result.calendars[0].is_primary).toBe(true);
    });
  });

  describe("listEvents", () => {
    it("returns formatted event list with timespan", async () => {
      const client = createMockClient();
      client.listEvents.mockResolvedValue({
        data: [
          {
            id: "event-1",
            calendarId: "cal-1",
            title: "Meeting",
            description: "Team sync",
            location: "Room A",
            when: { startTime: 1700000000, endTime: 1700003600 },
            participants: [{ email: "attendee@example.com", status: "yes" }],
            status: "confirmed",
            busy: true,
            conferencing: { details: { url: "https://meet.example.com/123" } },
          },
        ],
        nextCursor: null,
      });

      const result = await listEvents(client, {});

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe("Meeting");
      expect(result.events[0].start).toBeDefined();
      expect(result.events[0].end).toBeDefined();
      expect(result.events[0].conferencing_url).toBe("https://meet.example.com/123");
    });

    it("handles all-day events", async () => {
      const client = createMockClient();
      client.listEvents.mockResolvedValue({
        data: [
          {
            id: "event-1",
            calendarId: "cal-1",
            title: "Holiday",
            when: { date: "2024-12-25" },
          },
        ],
        nextCursor: null,
      });

      const result = await listEvents(client, {});

      expect(result.events[0].all_day).toBe(true);
      expect(result.events[0].start).toBe("2024-12-25");
    });
  });

  describe("createEvent", () => {
    it("creates timespan event", async () => {
      const client = createMockClient();
      client.createEvent.mockResolvedValue({
        data: {
          id: "new-event",
          calendarId: "cal-1",
          title: "New Meeting",
          when: { startTime: 1700000000, endTime: 1700003600 },
        },
      });

      const result = await createEvent(client, {
        calendar_id: "cal-1",
        title: "New Meeting",
        start: "2024-03-20T10:00:00Z",
        end: "2024-03-20T11:00:00Z",
      });

      expect(result.success).toBe(true);
      expect(result.event_id).toBe("new-event");
      expect(client.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: "cal-1",
          title: "New Meeting",
          when: expect.objectContaining({
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          }),
        }),
      );
    });

    it("creates all-day event", async () => {
      const client = createMockClient();
      client.createEvent.mockResolvedValue({
        data: {
          id: "new-event",
          calendarId: "cal-1",
          title: "Holiday",
          when: { date: "2024-12-25" },
        },
      });

      const result = await createEvent(client, {
        calendar_id: "cal-1",
        title: "Holiday",
        start: "2024-12-25",
        all_day: true,
      });

      expect(result.success).toBe(true);
      expect(client.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          when: { date: "2024-12-25" },
        }),
      );
    });

    it("parses participants", async () => {
      const client = createMockClient();
      client.createEvent.mockResolvedValue({
        data: { id: "event-1", calendarId: "cal-1", when: {} },
      });

      await createEvent(client, {
        calendar_id: "cal-1",
        title: "Meeting",
        start: "2024-03-20T10:00:00Z",
        participants: "alice@example.com, bob@example.com",
      });

      expect(client.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [
            { email: "alice@example.com" },
            { email: "bob@example.com" },
          ],
        }),
      );
    });
  });

  describe("updateEvent", () => {
    it("updates event fields", async () => {
      const client = createMockClient();
      client.updateEvent.mockResolvedValue({
        data: { id: "event-1", title: "Updated Title", when: {} },
      });

      const result = await updateEvent(client, {
        event_id: "event-1",
        calendar_id: "cal-1",
        title: "Updated Title",
        location: "New Room",
      });

      expect(result.success).toBe(true);
      expect(client.updateEvent).toHaveBeenCalledWith(
        "event-1",
        "cal-1",
        expect.objectContaining({
          title: "Updated Title",
          location: "New Room",
        }),
      );
    });
  });

  describe("deleteEvent", () => {
    it("deletes event", async () => {
      const client = createMockClient();
      client.deleteEvent.mockResolvedValue(undefined);

      const result = await deleteEvent(client, {
        event_id: "event-1",
        calendar_id: "cal-1",
      });

      expect(result.success).toBe(true);
      expect(result.event_id).toBe("event-1");
      expect(client.deleteEvent).toHaveBeenCalledWith("event-1", "cal-1", undefined);
    });
  });

  describe("checkAvailability", () => {
    it("returns available time slots", async () => {
      const client = createMockClient();
      client.checkAvailability.mockResolvedValue({
        data: {
          timeSlots: [
            { startTime: 1700000000, endTime: 1700001800, emails: ["alice@example.com"] },
            { startTime: 1700003600, endTime: 1700005400, emails: ["alice@example.com", "bob@example.com"] },
          ],
          order: ["alice@example.com", "bob@example.com"],
        },
      });

      const result = await checkAvailability(client, {
        emails: "alice@example.com, bob@example.com",
        start: "2024-03-20T09:00:00Z",
        end: "2024-03-20T17:00:00Z",
        duration_minutes: 30,
      });

      expect(result.available_slots).toHaveLength(2);
      expect(result.slot_count).toBe(2);
      expect(result.checked_emails).toContain("alice@example.com");
    });
  });
});

// ===========================================================================
// Contact Tools Implementation Tests
// ===========================================================================
describe("Contact Tools", () => {
  const createMockClient = () => {
    return {
      listContacts: vi.fn(),
      getContact: vi.fn(),
    } as any;
  };

  describe("listContacts", () => {
    it("returns formatted contact list", async () => {
      const client = createMockClient();
      client.listContacts.mockResolvedValue({
        data: [
          {
            id: "contact-1",
            givenName: "John",
            surname: "Doe",
            companyName: "Acme Inc",
            jobTitle: "Engineer",
            emails: [{ email: "john@example.com", type: "work" }],
            phoneNumbers: [{ number: "+1234567890", type: "mobile" }],
            source: "address_book",
          },
        ],
        nextCursor: "next-token",
      });

      const result = await listContacts(client, {});

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].name).toBe("John Doe");
      expect(result.contacts[0].company).toBe("Acme Inc");
      expect(result.contacts[0].emails).toHaveLength(1);
      expect(result.has_more).toBe(true);
    });

    it("handles contact with nickname only", async () => {
      const client = createMockClient();
      client.listContacts.mockResolvedValue({
        data: [
          { id: "contact-1", nickname: "Johnny" },
        ],
        nextCursor: null,
      });

      const result = await listContacts(client, {});

      expect(result.contacts[0].name).toBe("Johnny");
    });

    it("handles contact with no name", async () => {
      const client = createMockClient();
      client.listContacts.mockResolvedValue({
        data: [
          { id: "contact-1", emails: [{ email: "unknown@example.com" }] },
        ],
        nextCursor: null,
      });

      const result = await listContacts(client, {});

      expect(result.contacts[0].name).toBe("(no name)");
    });
  });

  describe("getContact", () => {
    it("returns full contact details", async () => {
      const client = createMockClient();
      client.getContact.mockResolvedValue({
        data: {
          id: "contact-1",
          givenName: "Jane",
          middleName: "Marie",
          surname: "Smith",
          nickname: "Janie",
          companyName: "Tech Corp",
          jobTitle: "Manager",
          emails: [
            { email: "jane.work@example.com", type: "work" },
            { email: "jane.personal@example.com", type: "home" },
          ],
          phoneNumbers: [{ number: "+1234567890", type: "work" }],
          physicalAddresses: [
            {
              streetAddress: "123 Main St",
              city: "New York",
              state: "NY",
              postalCode: "10001",
              country: "USA",
              type: "work",
            },
          ],
          notes: "Important contact",
          birthday: "1990-01-15",
          pictureUrl: "https://example.com/photo.jpg",
          source: "address_book",
          groups: [{ id: "group-1" }],
        },
      });

      const result = await getContact(client, { contact_id: "contact-1" });

      expect(result.name).toBe("Jane Marie Smith");
      expect(result.given_name).toBe("Jane");
      expect(result.middle_name).toBe("Marie");
      expect(result.surname).toBe("Smith");
      expect(result.emails).toHaveLength(2);
      expect(result.addresses).toHaveLength(1);
      expect(result.addresses![0].city).toBe("New York");
      expect(result.notes).toBe("Important contact");
      expect(result.birthday).toBe("1990-01-15");
    });
  });
});

// ===========================================================================
// Discover Grants Tool Tests
// ===========================================================================
describe("Discover Grants Tool", () => {
  it("returns formatted grants list", async () => {
    const mockClient = {
      listGrants: vi.fn().mockResolvedValue({
        data: [
          { id: "grant-1", email: "user@gmail.com", provider: "google", grantStatus: "valid", scope: ["email", "calendar"] },
          { id: "grant-2", email: "user@outlook.com", provider: "microsoft", grantStatus: "valid" },
        ],
      }),
    };

    const result = await discoverGrants(mockClient as any, {});

    expect(result.grants).toHaveLength(2);
    expect(result.grants[0].email).toBe("user@gmail.com");
    expect(result.grants[0].provider).toBe("google");
    expect(result.grants[0].status).toBe("valid");
    expect(result.count).toBe(2);
    expect(result.hint).toContain("grant");
  });

  it("returns hint when no grants found", async () => {
    const mockClient = {
      listGrants: vi.fn().mockResolvedValue({ data: [] }),
    };

    const result = await discoverGrants(mockClient as any, {});

    expect(result.grants).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.hint).toContain("dashboard.nylas.com");
  });

  it("filters by provider", async () => {
    const mockClient = {
      listGrants: vi.fn().mockResolvedValue({ data: [] }),
    };

    await discoverGrants(mockClient as any, { provider: "google" });

    expect(mockClient.listGrants).toHaveBeenCalledWith({ provider: "google", email: undefined });
  });
});

// ===========================================================================
// Additional Client Method Tests
// ===========================================================================
describe("Client Methods", () => {
  const createMockSdk = () => ({
    grants: { list: vi.fn(), find: vi.fn() },
    messages: { list: vi.fn(), find: vi.fn(), send: vi.fn() },
    threads: { list: vi.fn() },
    folders: { list: vi.fn() },
    drafts: { create: vi.fn() },
    calendars: { list: vi.fn(), getAvailability: vi.fn() },
    events: { list: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
    contacts: { list: vi.fn(), find: vi.fn() },
  });

  describe("getMessage", () => {
    it("fetches a specific message by ID", async () => {
      const mockSdk = createMockSdk();
      mockSdk.messages.find.mockResolvedValue({
        data: {
          id: "msg-123",
          subject: "Test Email",
          body: "<p>Hello</p>",
        },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.getMessage("msg-123");

      expect(mockSdk.messages.find).toHaveBeenCalledWith({
        identifier: "grant-1",
        messageId: "msg-123",
      });
      expect(result.data.id).toBe("msg-123");
    });
  });

  describe("sendMessage", () => {
    it("sends an email with all fields", async () => {
      const mockSdk = createMockSdk();
      mockSdk.messages.send.mockResolvedValue({
        data: { id: "sent-msg-123" },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.sendMessage({
        to: [{ email: "to@example.com", name: "To" }],
        cc: [{ email: "cc@example.com" }],
        bcc: [{ email: "bcc@example.com" }],
        subject: "Test Subject",
        body: "<p>Test body</p>",
        replyToMessageId: "reply-to-123",
      });

      expect(mockSdk.messages.send).toHaveBeenCalledWith({
        identifier: "grant-1",
        requestBody: {
          to: [{ email: "to@example.com", name: "To" }],
          cc: [{ email: "cc@example.com" }],
          bcc: [{ email: "bcc@example.com" }],
          replyTo: undefined,
          subject: "Test Subject",
          body: "<p>Test body</p>",
          replyToMessageId: "reply-to-123",
        },
      });
      expect(result.data.id).toBe("sent-msg-123");
    });
  });

  describe("createDraft", () => {
    it("creates a draft email", async () => {
      const mockSdk = createMockSdk();
      mockSdk.drafts.create.mockResolvedValue({
        data: { id: "draft-123" },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.createDraft({
        to: [{ email: "to@example.com" }],
        subject: "Draft Subject",
        body: "<p>Draft body</p>",
      });

      expect(mockSdk.drafts.create).toHaveBeenCalledWith({
        identifier: "grant-1",
        requestBody: {
          to: [{ email: "to@example.com" }],
          cc: undefined,
          bcc: undefined,
          subject: "Draft Subject",
          body: "<p>Draft body</p>",
          replyToMessageId: undefined,
        },
      });
      expect(result.data.id).toBe("draft-123");
    });
  });

  describe("listCalendars", () => {
    it("lists calendars for a grant", async () => {
      const mockSdk = createMockSdk();
      mockSdk.calendars.list.mockResolvedValue({
        data: [
          { id: "cal-1", name: "Primary", isPrimary: true },
          { id: "cal-2", name: "Work" },
        ],
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.listCalendars();

      expect(mockSdk.calendars.list).toHaveBeenCalledWith({ identifier: "grant-1" });
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getEvent", () => {
    it("fetches a specific event by ID", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.find.mockResolvedValue({
        data: {
          id: "event-123",
          title: "Meeting",
          when: { startTime: 1700000000, endTime: 1700003600 },
        },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.getEvent("event-123", "cal-1");

      expect(mockSdk.events.find).toHaveBeenCalledWith({
        identifier: "grant-1",
        eventId: "event-123",
        queryParams: { calendarId: "cal-1" },
      });
      expect(result.data.title).toBe("Meeting");
    });
  });

  describe("createEvent", () => {
    it("creates a new event", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.create.mockResolvedValue({
        data: { id: "new-event-123" },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.createEvent({
        calendarId: "cal-1",
        title: "New Meeting",
        description: "A test meeting",
        location: "Room A",
        when: { startTime: 1700000000, endTime: 1700003600 },
        participants: [{ email: "attendee@example.com" }],
        busy: true,
      });

      expect(mockSdk.events.create).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: { calendarId: "cal-1" },
        requestBody: {
          title: "New Meeting",
          description: "A test meeting",
          location: "Room A",
          when: { startTime: 1700000000, endTime: 1700003600 },
          participants: [{ email: "attendee@example.com" }],
          busy: true,
        },
      });
      expect(result.data.id).toBe("new-event-123");
    });
  });

  describe("updateEvent", () => {
    it("updates an existing event", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.update.mockResolvedValue({
        data: { id: "event-123", title: "Updated Meeting" },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.updateEvent("event-123", "cal-1", {
        title: "Updated Meeting",
        location: "Room B",
      });

      expect(mockSdk.events.update).toHaveBeenCalledWith({
        identifier: "grant-1",
        eventId: "event-123",
        queryParams: { calendarId: "cal-1" },
        requestBody: {
          title: "Updated Meeting",
          description: undefined,
          location: "Room B",
          when: undefined,
          participants: undefined,
          busy: undefined,
        },
      });
      expect(result.data.title).toBe("Updated Meeting");
    });
  });

  describe("deleteEvent", () => {
    it("deletes an event", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.destroy.mockResolvedValue(undefined);

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await client.deleteEvent("event-123", "cal-1");

      expect(mockSdk.events.destroy).toHaveBeenCalledWith({
        identifier: "grant-1",
        eventId: "event-123",
        queryParams: { calendarId: "cal-1" },
      });
    });
  });

  describe("checkAvailability", () => {
    it("checks availability for participants", async () => {
      const mockSdk = createMockSdk();
      mockSdk.calendars.getAvailability.mockResolvedValue({
        data: {
          timeSlots: [
            { startTime: 1700000000, endTime: 1700001800 },
          ],
        },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.checkAvailability({
        startTime: 1700000000,
        endTime: 1700010000,
        participants: [{ email: "person@example.com" }],
        durationMinutes: 30,
        intervalMinutes: 15,
      });

      expect(mockSdk.calendars.getAvailability).toHaveBeenCalledWith({
        requestBody: {
          startTime: 1700000000,
          endTime: 1700010000,
          participants: [{ email: "person@example.com" }],
          durationMinutes: 30,
          intervalMinutes: 15,
        },
      });
      expect(result.data.timeSlots).toHaveLength(1);
    });
  });

  describe("getContact", () => {
    it("fetches a specific contact by ID", async () => {
      const mockSdk = createMockSdk();
      mockSdk.contacts.find.mockResolvedValue({
        data: {
          id: "contact-123",
          givenName: "John",
          surname: "Doe",
        },
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.getContact("contact-123");

      expect(mockSdk.contacts.find).toHaveBeenCalledWith({
        identifier: "grant-1",
        contactId: "contact-123",
      });
      expect(result.data.givenName).toBe("John");
    });
  });

  describe("listFolders", () => {
    it("lists email folders", async () => {
      const mockSdk = createMockSdk();
      mockSdk.folders.list.mockResolvedValue({
        data: [
          { id: "folder-1", name: "INBOX" },
          { id: "folder-2", name: "SENT" },
        ],
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.listFolders();

      expect(mockSdk.folders.list).toHaveBeenCalledWith({ identifier: "grant-1" });
      expect(result.data).toHaveLength(2);
    });
  });

  describe("listThreads", () => {
    it("lists email threads with filters", async () => {
      const mockSdk = createMockSdk();
      mockSdk.threads.list.mockResolvedValue({
        data: [
          { id: "thread-1", subject: "Thread 1" },
          { id: "thread-2", subject: "Thread 2" },
        ],
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.listThreads({ limit: 10, unread: true });

      expect(mockSdk.threads.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: { limit: 10, unread: true },
      });
      expect(result.data).toHaveLength(2);
    });

    it("lists threads without params", async () => {
      const mockSdk = createMockSdk();
      mockSdk.threads.list.mockResolvedValue({ data: [] });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await client.listThreads();

      expect(mockSdk.threads.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: undefined,
      });
    });
  });

  describe("listEvents", () => {
    it("lists events with calendar and date range", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.list.mockResolvedValue({
        data: [
          { id: "event-1", title: "Meeting" },
        ],
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.listEvents({
        calendarId: "cal-1",
        start: 1700000000,
        end: 1700010000,
        limit: 10,
      });

      expect(mockSdk.events.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: { calendarId: "cal-1", start: 1700000000, end: 1700010000, limit: 10 },
      });
      expect(result.data).toHaveLength(1);
    });

    it("uses primary calendar by default", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.list.mockResolvedValue({ data: [] });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await client.listEvents();

      expect(mockSdk.events.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: { calendarId: "primary" },
      });
    });
  });

  describe("listContacts", () => {
    it("lists contacts with filters", async () => {
      const mockSdk = createMockSdk();
      mockSdk.contacts.list.mockResolvedValue({
        data: [
          { id: "contact-1", givenName: "John" },
        ],
      });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      const result = await client.listContacts({ limit: 10, email: "john@example.com" });

      expect(mockSdk.contacts.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: { limit: 10, email: "john@example.com" },
      });
      expect(result.data).toHaveLength(1);
    });

    it("lists contacts without params", async () => {
      const mockSdk = createMockSdk();
      mockSdk.contacts.list.mockResolvedValue({ data: [] });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await client.listContacts();

      expect(mockSdk.contacts.list).toHaveBeenCalledWith({
        identifier: "grant-1",
        queryParams: undefined,
      });
    });
  });

  describe("error handling in methods", () => {
    it("wraps errors from listThreads", async () => {
      const mockSdk = createMockSdk();
      mockSdk.threads.list.mockRejectedValue(new Error("Network error"));

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await expect(client.listThreads()).rejects.toThrow(NylasApiError);
    });

    it("wraps errors from listEvents", async () => {
      const mockSdk = createMockSdk();
      mockSdk.events.list.mockRejectedValue({ statusCode: 404, message: "Not found" });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await expect(client.listEvents()).rejects.toThrow(NylasApiError);
    });

    it("wraps errors from listContacts", async () => {
      const mockSdk = createMockSdk();
      mockSdk.contacts.list.mockRejectedValue({ statusCode: 400, message: "Bad request" });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await expect(client.listContacts()).rejects.toThrow(NylasApiError);
    });

    it("wraps errors from listGrants", async () => {
      const mockSdk = createMockSdk();
      mockSdk.grants.list.mockRejectedValue({ statusCode: 401, message: "Unauthorized" });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await expect(client.listGrants()).rejects.toThrow(NylasApiError);
    });

    it("wraps errors from getGrant", async () => {
      const mockSdk = createMockSdk();
      mockSdk.grants.find.mockRejectedValue({ statusCode: 404, message: "Not found" });

      const client = new NylasClient({
        config: parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" }),
      });
      (client as any).sdk = mockSdk;

      await expect(client.getGrant("invalid-id")).rejects.toThrow(NylasApiError);
    });
  });
});

// ===========================================================================
// Calendar Tools - Additional Tests
// ===========================================================================
describe("Calendar Tools - Additional", () => {
  describe("listCalendars", () => {
    it("handles calendars without isPrimary field", async () => {
      const mockClient = {
        listCalendars: vi.fn().mockResolvedValue({
          data: [
            { id: "cal-1", name: "Calendar 1" },
            { id: "cal-2", name: "Calendar 2", isPrimary: true },
          ],
        }),
      };

      const result = await listCalendars(mockClient as any, {});

      expect(result.calendars).toHaveLength(2);
      expect(result.calendars[0].is_primary).toBeUndefined();
      expect(result.calendars[1].is_primary).toBe(true);
    });
  });

  describe("listEvents with edge cases", () => {
    it("handles events with different when types", async () => {
      const mockClient = {
        listEvents: vi.fn().mockResolvedValue({
          data: [
            // Date range (all-day multi-day event)
            { id: "event-1", title: "Vacation", when: { startDate: "2024-03-20", endDate: "2024-03-25" } },
            // Single date (all-day)
            { id: "event-2", title: "Holiday", when: { date: "2024-03-20" } },
            // Single time (point-in-time)
            { id: "event-3", title: "Reminder", when: { time: 1700000000 } },
            // Time range (normal event)
            { id: "event-4", title: "Meeting", when: { startTime: 1700000000, endTime: 1700003600 } },
            // Unknown format
            { id: "event-5", title: "Unknown", when: { custom: "value" } },
            // Missing when
            { id: "event-6", title: "No Time" },
          ],
          nextCursor: null,
        }),
      };

      const result = await listEvents(mockClient as any, { calendar_id: "cal-1" });

      expect(result.events).toHaveLength(6);
      // Date range (all-day)
      expect(result.events[0].start).toBe("2024-03-20");
      expect(result.events[0].end).toBe("2024-03-25");
      expect(result.events[0].all_day).toBe(true);
      // Single date (all-day)
      expect(result.events[1].start).toBe("2024-03-20");
      expect(result.events[1].all_day).toBe(true);
      // Single time
      expect(result.events[2].start).toContain("2023-11");
      // Time range
      expect(result.events[3].start).toContain("2023-11");
      expect(result.events[3].end).toContain("2023-11");
      // Unknown format - should stringify
      expect(result.events[4].start).toContain("custom");
      // Missing when
      expect(result.events[5].start).toBe("unknown");
    });
  });

  describe("checkAvailability", () => {
    it("checks availability for multiple participants", async () => {
      const mockClient = {
        checkAvailability: vi.fn().mockResolvedValue({
          data: {
            timeSlots: [
              { startTime: 1700000000, endTime: 1700001800 },
              { startTime: 1700003600, endTime: 1700005400 },
            ],
            order: ["alice@example.com", "bob@example.com"],
          },
        }),
      };

      const result = await checkAvailability(mockClient as any, {
        emails: "alice@example.com, bob@example.com",
        start: "2024-03-20T09:00:00Z",
        end: "2024-03-20T17:00:00Z",
        duration_minutes: 30,
      });

      expect(result.available_slots).toHaveLength(2);
      expect(result.slot_count).toBe(2);
      expect(result.checked_emails).toContain("alice@example.com");
      expect(result.checked_emails).toContain("bob@example.com");
      expect(mockClient.checkAvailability).toHaveBeenCalledWith({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        participants: [{ email: "alice@example.com" }, { email: "bob@example.com" }],
        durationMinutes: 30,
        intervalMinutes: 15,
      });
    });
  });

  describe("getEvent", () => {
    it("fetches and formats event details", async () => {
      const mockClient = {
        getEvent: vi.fn().mockResolvedValue({
          data: {
            id: "event-123",
            calendarId: "cal-1",
            title: "Team Standup",
            description: "Daily standup meeting",
            location: "Zoom",
            when: { startTime: 1700000000, endTime: 1700001800 },
            participants: [
              { email: "alice@example.com", name: "Alice", status: "yes" },
              { email: "bob@example.com", status: "noreply" },
            ],
            busy: true,
            status: "confirmed",
            htmlLink: "https://calendar.google.com/event/123",
          },
        }),
      };

      const result = await getEvent(mockClient as any, {
        event_id: "event-123",
        calendar_id: "cal-1",
      });

      expect(result.id).toBe("event-123");
      expect(result.title).toBe("Team Standup");
      expect(result.description).toBe("Daily standup meeting");
      expect(result.location).toBe("Zoom");
      expect(result.participants).toContain("Alice alice@example.com (yes)");
      expect(result.participants).toContain("bob@example.com");
      expect(result.busy).toBe(true);
    });
  });

  describe("createEvent", () => {
    it("creates event with participants", async () => {
      const mockClient = {
        createEvent: vi.fn().mockResolvedValue({
          data: { id: "new-event-123", calendarId: "cal-1", title: "New Meeting", when: { startTime: 1700000000, endTime: 1700003600 } },
        }),
      };

      const result = await createEvent(mockClient as any, {
        calendar_id: "cal-1",
        title: "New Meeting",
        start: "2024-03-20T14:00:00Z",
        end: "2024-03-20T15:00:00Z",
        participants: "alice@example.com, bob@example.com",
        location: "Room A",
        description: "Important meeting",
      });

      expect(result.event_id).toBe("new-event-123");
      expect(result.success).toBe(true);
      expect(mockClient.createEvent).toHaveBeenCalledWith(expect.objectContaining({
        calendarId: "cal-1",
        title: "New Meeting",
        location: "Room A",
        description: "Important meeting",
      }));
    });

    it("creates all-day event", async () => {
      const mockClient = {
        createEvent: vi.fn().mockResolvedValue({
          data: { id: "allday-123", calendarId: "cal-1", title: "All Day Event", when: { date: "2024-03-20" } },
        }),
      };

      const result = await createEvent(mockClient as any, {
        calendar_id: "cal-1",
        title: "All Day Event",
        start: "2024-03-20",
        all_day: true,
      });

      expect(result.event_id).toBe("allday-123");
      expect(result.success).toBe(true);
      expect(mockClient.createEvent).toHaveBeenCalled();
    });
  });

  describe("updateEvent", () => {
    it("updates event fields", async () => {
      const mockClient = {
        updateEvent: vi.fn().mockResolvedValue({
          data: { id: "event-123", title: "Updated Title", when: { startTime: 1700000000, endTime: 1700003600 } },
        }),
      };

      const result = await updateEvent(mockClient as any, {
        event_id: "event-123",
        calendar_id: "cal-1",
        title: "Updated Title",
        location: "New Room",
      });

      expect(result.event_id).toBe("event-123");
      expect(result.success).toBe(true);
      expect(mockClient.updateEvent).toHaveBeenCalledWith("event-123", "cal-1", expect.objectContaining({
        title: "Updated Title",
        location: "New Room",
      }));
    });
  });

  describe("deleteEvent", () => {
    it("deletes an event", async () => {
      const mockClient = {
        deleteEvent: vi.fn().mockResolvedValue(undefined),
      };

      const result = await deleteEvent(mockClient as any, {
        event_id: "event-123",
        calendar_id: "cal-1",
      });

      expect(result.success).toBe(true);
      expect(result.event_id).toBe("event-123");
      expect(mockClient.deleteEvent).toHaveBeenCalledWith("event-123", "cal-1", undefined);
    });
  });
});

// ===========================================================================
// Email Tools - Additional Tests
// ===========================================================================
describe("Email Tools - Additional", () => {
  describe("sendEmail", () => {
    it("sends email with CC and BCC", async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({
          data: {
            id: "sent-123",
            threadId: "thread-456",
          },
        }),
      };

      const result = await sendEmail(mockClient as any, {
        to: "recipient@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
        subject: "Test Subject",
        body: "<p>Test body</p>",
      });

      expect(result.message_id).toBe("sent-123");
      expect(result.success).toBe(true);
      expect(result.thread_id).toBe("thread-456");
      expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        to: [{ email: "recipient@example.com" }],
        cc: [{ email: "cc@example.com" }],
        bcc: [{ email: "bcc@example.com" }],
        subject: "Test Subject",
        body: "<p>Test body</p>",
      }));
    });

    it("parses named email addresses", async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({
          data: { id: "sent-123" },
        }),
      };

      await sendEmail(mockClient as any, {
        to: "John Doe <john@example.com>, jane@example.com",
        subject: "Test",
        body: "Body",
      });

      expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        to: [
          { name: "John Doe", email: "john@example.com" },
          { email: "jane@example.com" },
        ],
      }));
    });
  });

  describe("createDraft", () => {
    it("creates a draft email", async () => {
      const mockClient = {
        createDraft: vi.fn().mockResolvedValue({
          data: { id: "draft-123", threadId: "thread-789" },
        }),
      };

      const result = await createDraft(mockClient as any, {
        to: "recipient@example.com",
        subject: "Draft Subject",
        body: "<p>Draft body</p>",
      });

      expect(result.draft_id).toBe("draft-123");
      expect(result.success).toBe(true);
      expect(result.thread_id).toBe("thread-789");
    });
  });
});

// ===========================================================================
// CLI Tests
// ===========================================================================
describe("CLI Commands", () => {
  it("registers all CLI commands", () => {
    const registeredCommands: string[] = [];
    const registeredOptions: string[] = [];

    const mockSubCommand = {
      description: vi.fn().mockReturnThis(),
      option: vi.fn().mockImplementation((opt) => {
        registeredOptions.push(opt);
        return mockSubCommand;
      }),
      action: vi.fn().mockReturnThis(),
    };

    const mockNylasCommand = {
      description: vi.fn().mockReturnThis(),
      command: vi.fn().mockImplementation((name) => {
        registeredCommands.push(name);
        return mockSubCommand;
      }),
    };

    const mockProgram = {
      command: vi.fn().mockReturnValue(mockNylasCommand),
    };

    const config = parseNylasConfig({ apiKey: "test-key", defaultGrantId: "grant-1" });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    registerNylasCli({ program: mockProgram as any, config, logger });

    // Main nylas command should be registered
    expect(mockProgram.command).toHaveBeenCalledWith("nylas");
    expect(mockNylasCommand.description).toHaveBeenCalledWith(expect.stringContaining("Nylas"));

    // Sub-commands should be registered
    expect(registeredCommands).toContain("status");
    expect(registeredCommands).toContain("discover");
    expect(registeredCommands).toContain("test");
    expect(registeredCommands).toContain("grants");

    // Options should be registered
    expect(registeredOptions.some((o) => o.includes("--json"))).toBe(true);
    expect(registeredOptions.some((o) => o.includes("--grant"))).toBe(true);
    expect(registeredOptions.some((o) => o.includes("--configured"))).toBe(true);
  });

  it("registerNylasCli is exported and callable", () => {
    expect(typeof registerNylasCli).toBe("function");
  });
});
