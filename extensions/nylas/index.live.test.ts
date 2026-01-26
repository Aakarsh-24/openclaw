/**
 * Nylas Plugin Integration Tests
 *
 * These tests run against the real Nylas API.
 * Set NYLAS_API_KEY env variable and run with:
 *   LIVE=1 bun test extensions/nylas/index.live.test.ts
 *
 * Or run all live tests:
 *   pnpm test:live
 */

import { describe, expect, it, beforeAll } from "vitest";
import { parseNylasConfig, type NylasConfig } from "./src/config.js";
import { NylasClient, NylasApiError } from "./src/client.js";
import { discoverGrants } from "./src/tools/index.js";
import { listEmails, getEmail, listFolders, listThreads } from "./src/tools/email.js";
import { listCalendars, listEvents } from "./src/tools/calendar.js";
import { listContacts } from "./src/tools/contacts.js";

// Check environment
const NYLAS_API_KEY = process.env.NYLAS_API_KEY ?? "";
const LIVE = process.env.LIVE === "1" || process.env.NYLAS_LIVE_TEST === "1";

const describeLive = LIVE && NYLAS_API_KEY ? describe : describe.skip;

// Store discovered grant for subsequent tests
let testGrantId: string | undefined;
let testCalendarId: string | undefined;

describeLive("Nylas Plugin Integration Tests", () => {
  let client: NylasClient;
  let config: NylasConfig;

  beforeAll(() => {
    config = parseNylasConfig({
      apiKey: NYLAS_API_KEY,
      apiUri: "https://api.us.nylas.com",
      defaultTimezone: "UTC",
    });

    client = new NylasClient({
      config,
      logger: {
        info: () => {},
        warn: console.warn,
        error: console.error,
      },
    });
  });

  // ===========================================================================
  // Grant Discovery Tests
  // ===========================================================================
  describe("Grant Discovery", () => {
    it("lists grants from the API", async () => {
      const response = await client.listGrants();

      expect(response).toBeDefined();
      expect(response.data).toBeInstanceOf(Array);

      if (response.data.length > 0) {
        const grant = response.data[0];
        expect(grant.id).toBeDefined();
        expect(grant.email).toBeDefined();
        expect(grant.provider).toBeDefined();

        // Store for subsequent tests
        testGrantId = grant.id;
        console.log(`  Found grant: ${grant.email} (${grant.provider})`);
      } else {
        console.log("  No grants found - some tests will be skipped");
      }
    }, 15000);

    it("discovers grants via tool", async () => {
      const result = await discoverGrants(client, {});

      expect(result).toBeDefined();
      expect(result.grants).toBeInstanceOf(Array);
      expect(result.count).toBe(result.grants.length);

      if (result.grants.length > 0) {
        expect(result.hint).toContain("grant");
        expect(result.grants[0].id).toBeDefined();
        expect(result.grants[0].email).toBeDefined();
      }
    }, 15000);

    it("filters grants by provider", async () => {
      const result = await discoverGrants(client, { provider: "google" });

      expect(result).toBeDefined();
      expect(result.grants).toBeInstanceOf(Array);

      // All returned grants should be Google
      for (const grant of result.grants) {
        expect(grant.provider).toBe("google");
      }
    }, 15000);

    it("gets specific grant details", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const response = await client.getGrant(testGrantId);

      expect(response.data).toBeDefined();
      expect(response.data.id).toBe(testGrantId);
      expect(response.data.email).toBeDefined();
      expect(response.data.grantStatus).toBeDefined();
    }, 15000);
  });

  // ===========================================================================
  // Email Tools Tests
  // ===========================================================================
  describe("Email Tools", () => {
    it("lists email folders", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listFolders(client, { grant: testGrantId });

      expect(result).toBeDefined();
      expect(result.folders).toBeInstanceOf(Array);

      if (result.folders.length > 0) {
        const folder = result.folders[0];
        expect(folder.id).toBeDefined();
        expect(folder.name).toBeDefined();
        console.log(`  Found ${result.folders.length} folders`);
      }
    }, 15000);

    it("lists emails with limit", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listEmails(client, {
        grant: testGrantId,
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.emails).toBeInstanceOf(Array);
      expect(result.emails.length).toBeLessThanOrEqual(5);

      if (result.emails.length > 0) {
        const email = result.emails[0];
        expect(email.id).toBeDefined();
        expect(email.subject).toBeDefined();
        console.log(`  Found ${result.emails.length} emails`);
      }
    }, 15000);

    it("lists unread emails", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listEmails(client, {
        grant: testGrantId,
        unread: true,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.emails).toBeInstanceOf(Array);

      // All returned emails should be unread
      for (const email of result.emails) {
        expect(email.unread).toBe(true);
      }
      console.log(`  Found ${result.emails.length} unread emails`);
    }, 15000);

    it("gets a specific email", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      // First get an email ID
      const listResult = await listEmails(client, {
        grant: testGrantId,
        limit: 1,
      });

      if (listResult.emails.length === 0) {
        console.log("  Skipping - no emails available");
        return;
      }

      const emailId = listResult.emails[0].id;
      const result = await getEmail(client, {
        grant: testGrantId,
        message_id: emailId,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(emailId);
      expect(result.subject).toBeDefined();
      expect(result.body).toBeDefined();
      console.log(`  Got email: ${result.subject?.slice(0, 50)}...`);
    }, 15000);

    it("lists email threads", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listThreads(client, {
        grant: testGrantId,
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.threads).toBeInstanceOf(Array);

      if (result.threads.length > 0) {
        const thread = result.threads[0];
        expect(thread.id).toBeDefined();
        expect(thread.subject).toBeDefined();
        console.log(`  Found ${result.threads.length} threads`);
      }
    }, 15000);
  });

  // ===========================================================================
  // Calendar Tools Tests
  // ===========================================================================
  describe("Calendar Tools", () => {
    it("lists calendars", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listCalendars(client, { grant: testGrantId });

      expect(result).toBeDefined();
      expect(result.calendars).toBeInstanceOf(Array);

      if (result.calendars.length > 0) {
        const calendar = result.calendars[0];
        expect(calendar.id).toBeDefined();
        expect(calendar.name).toBeDefined();

        // Find primary calendar for subsequent tests
        const primary = result.calendars.find((c) => c.is_primary);
        testCalendarId = primary?.id ?? result.calendars[0].id;
        console.log(`  Found ${result.calendars.length} calendars`);
      }
    }, 15000);

    it("lists events with date range", async () => {
      if (!testGrantId || !testCalendarId) {
        console.log("  Skipping - no grant or calendar available");
        return;
      }

      // Get events from the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await listEvents(client, {
        grant: testGrantId,
        calendar_id: testCalendarId,
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.events).toBeInstanceOf(Array);
      console.log(`  Found ${result.events.length} events in last 30 days`);

      if (result.events.length > 0) {
        const event = result.events[0];
        expect(event.id).toBeDefined();
        expect(event.title).toBeDefined();
      }
    }, 15000);

    it("lists upcoming events", async () => {
      if (!testGrantId || !testCalendarId) {
        console.log("  Skipping - no grant or calendar available");
        return;
      }

      // Get events for the next 7 days
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const result = await listEvents(client, {
        grant: testGrantId,
        calendar_id: testCalendarId,
        start: now.toISOString(),
        end: sevenDaysLater.toISOString(),
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.events).toBeInstanceOf(Array);
      console.log(`  Found ${result.events.length} upcoming events`);
    }, 15000);
  });

  // ===========================================================================
  // Contact Tools Tests
  // ===========================================================================
  describe("Contact Tools", () => {
    it("lists contacts", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      const result = await listContacts(client, {
        grant: testGrantId,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.contacts).toBeInstanceOf(Array);
      console.log(`  Found ${result.contacts.length} contacts`);

      if (result.contacts.length > 0) {
        const contact = result.contacts[0];
        expect(contact.id).toBeDefined();
      }
    }, 15000);

    it("lists contacts with email filter", async () => {
      if (!testGrantId) {
        console.log("  Skipping - no grant available");
        return;
      }

      // First get a contact to filter by
      const allContacts = await listContacts(client, {
        grant: testGrantId,
        limit: 1,
      });

      if (allContacts.contacts.length === 0 || !allContacts.contacts[0].emails?.[0]) {
        console.log("  Skipping - no contacts with email available");
        return;
      }

      const emailToFind = allContacts.contacts[0].emails[0].email;
      const result = await listContacts(client, {
        grant: testGrantId,
        email: emailToFind,
      });

      expect(result).toBeDefined();
      expect(result.contacts).toBeInstanceOf(Array);
      console.log(`  Found ${result.contacts.length} contacts matching ${emailToFind}`);
    }, 15000);
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe("Error Handling", () => {
    it("handles invalid grant ID gracefully", async () => {
      try {
        await client.getGrant("invalid-grant-id-12345");
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(NylasApiError);
        const apiError = err as NylasApiError;
        expect(apiError.statusCode).toBe(404);
      }
    }, 15000);

    it("handles invalid API key gracefully", async () => {
      const badConfig = parseNylasConfig({
        apiKey: "invalid-api-key",
        apiUri: "https://api.us.nylas.com",
      });

      const badClient = new NylasClient({
        config: badConfig,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      });

      try {
        await badClient.listGrants();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(NylasApiError);
        const apiError = err as NylasApiError;
        expect(apiError.statusCode).toBe(401);
      }
    }, 15000);
  });

  // ===========================================================================
  // Client Configuration Tests
  // ===========================================================================
  describe("Client Configuration", () => {
    it("resolves named grants correctly", () => {
      const configWithGrants = parseNylasConfig({
        apiKey: NYLAS_API_KEY,
        defaultGrantId: "default-grant-123",
        grants: {
          work: "work-grant-456",
          personal: "personal-grant-789",
        },
      });

      const clientWithGrants = new NylasClient({
        config: configWithGrants,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      });

      // Test resolving named grants
      expect(clientWithGrants.resolveGrantId("work")).toBe("work-grant-456");
      expect(clientWithGrants.resolveGrantId("personal")).toBe("personal-grant-789");

      // Test default grant
      expect(clientWithGrants.resolveGrantId()).toBe("default-grant-123");

      // Test raw grant ID passthrough
      expect(clientWithGrants.resolveGrantId("some-raw-id")).toBe("some-raw-id");
    });

    it("throws when no grant ID available", () => {
      const configNoDefault = parseNylasConfig({
        apiKey: NYLAS_API_KEY,
      });

      const clientNoDefault = new NylasClient({
        config: configNoDefault,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      });

      expect(() => clientNoDefault.resolveGrantId()).toThrow("No grant ID provided");
    });
  });
});

// ===========================================================================
// Summary when tests complete
// ===========================================================================
describeLive("Integration Test Summary", () => {
  it("displays test environment info", () => {
    console.log("\n  Nylas Integration Tests Summary:");
    console.log(`    API URI: https://api.us.nylas.com`);
    console.log(`    API Key: ${NYLAS_API_KEY.slice(0, 10)}...`);
    console.log(`    Test Grant ID: ${testGrantId ?? "(none found)"}`);
    console.log(`    Test Calendar ID: ${testCalendarId ?? "(none found)"}`);
    expect(true).toBe(true);
  });
});
