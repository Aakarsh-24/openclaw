import { describe, expect, it } from "vitest";

import { formatEnvelopeTimestamp } from "./date-time.js";

describe("formatEnvelopeTimestamp", () => {
  // Tests verify the format structure - actual timezone depends on host
  const timestampPattern =
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM) \w+$/;

  it("formats a date as human-readable string with timezone", () => {
    const date = new Date(Date.UTC(2026, 0, 16, 4, 52));
    const result = formatEnvelopeTimestamp(date);
    expect(result).toMatch(timestampPattern);
    // Should contain year 2026
    expect(result).toContain("2026");
  });

  it("formats PM times correctly", () => {
    // Use a time that will be PM in most timezones
    const date = new Date(Date.UTC(2026, 0, 16, 20, 30));
    const result = formatEnvelopeTimestamp(date);
    expect(result).toMatch(timestampPattern);
  });

  it("includes timezone abbreviation", () => {
    const date = new Date();
    const result = formatEnvelopeTimestamp(date);
    // Should end with a timezone abbreviation (PST, EST, UTC, etc.)
    expect(result).toMatch(/\s[A-Z]{2,5}$/);
  });

  it("formats minutes with leading zero", () => {
    const date = new Date(Date.UTC(2026, 0, 16, 9, 5));
    const result = formatEnvelopeTimestamp(date);
    // Should have :05 not :5
    expect(result).toMatch(/:\d{2}\s/);
  });
});
