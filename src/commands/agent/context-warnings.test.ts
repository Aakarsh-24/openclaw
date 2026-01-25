import { describe, expect, it } from "vitest";

import {
  checkContextWarning,
  DEFAULT_CONTEXT_WARNING_THRESHOLD_SOFT,
  DEFAULT_CONTEXT_WARNING_THRESHOLD_URGENT,
  formatContextWarning,
} from "./context-warnings.js";

describe("context-warnings", () => {
  describe("checkContextWarning", () => {
    it("returns none when below soft threshold", () => {
      const result = checkContextWarning({
        totalTokens: 7000,
        contextTokens: 10000,
      });
      expect(result.level).toBe("none");
      expect(result.percentUsed).toBe(70);
      expect(result.message).toBeNull();
    });

    it("returns soft warning at 75%", () => {
      const result = checkContextWarning({
        totalTokens: 7500,
        contextTokens: 10000,
      });
      expect(result.level).toBe("soft");
      expect(result.percentUsed).toBe(75);
      expect(result.message).toContain("75%");
      expect(result.message).toContain("/compact");
    });

    it("returns urgent warning at 90%", () => {
      const result = checkContextWarning({
        totalTokens: 9000,
        contextTokens: 10000,
      });
      expect(result.level).toBe("urgent");
      expect(result.percentUsed).toBe(90);
      expect(result.message).toContain("90%");
      expect(result.message).toContain("auto-compact");
    });

    it("does not repeat warning at same level", () => {
      const result = checkContextWarning({
        totalTokens: 7800,
        contextTokens: 10000,
        previousWarningLevel: "soft",
      });
      expect(result.level).toBe("soft");
      expect(result.message).toBeNull(); // No message because already warned
    });

    it("shows warning when escalating from soft to urgent", () => {
      const result = checkContextWarning({
        totalTokens: 9500,
        contextTokens: 10000,
        previousWarningLevel: "soft",
      });
      expect(result.level).toBe("urgent");
      expect(result.message).not.toBeNull();
    });

    it("returns none when totalTokens is undefined", () => {
      const result = checkContextWarning({
        totalTokens: undefined,
        contextTokens: 10000,
      });
      expect(result.level).toBe("none");
      expect(result.percentUsed).toBe(0);
    });

    it("returns none when contextTokens is undefined", () => {
      const result = checkContextWarning({
        totalTokens: 5000,
        contextTokens: undefined,
      });
      expect(result.level).toBe("none");
    });

    it("returns none when contextTokens is zero", () => {
      const result = checkContextWarning({
        totalTokens: 5000,
        contextTokens: 0,
      });
      expect(result.level).toBe("none");
    });

    it("respects custom thresholds", () => {
      const result = checkContextWarning({
        totalTokens: 6000,
        contextTokens: 10000,
        thresholds: { soft: 60, urgent: 80 },
      });
      expect(result.level).toBe("soft");
      expect(result.percentUsed).toBe(60);
    });

    it("shows warning again after level resets to none", () => {
      // User was at 95%, got urgent warning
      // Then compacted to 40%, level reset to none
      // Now at 76%, should show soft warning again
      const result = checkContextWarning({
        totalTokens: 7600,
        contextTokens: 10000,
        previousWarningLevel: "none",
      });
      expect(result.level).toBe("soft");
      expect(result.message).not.toBeNull();
    });

    it("treats zero totalTokens as valid (not undefined)", () => {
      const result = checkContextWarning({
        totalTokens: 0,
        contextTokens: 10000,
      });
      expect(result.level).toBe("none");
      expect(result.percentUsed).toBe(0);
      // Key: this should work, not bail out early
    });

    it("caps percentUsed at 100% when tokens exceed context", () => {
      const result = checkContextWarning({
        totalTokens: 15000, // 150% of context
        contextTokens: 10000,
      });
      expect(result.level).toBe("urgent");
      expect(result.percentUsed).toBe(100); // Capped, not 150
    });

    it("handles inverted thresholds gracefully", () => {
      // User mistakenly passes soft > urgent
      const result = checkContextWarning({
        totalTokens: 8500,
        contextTokens: 10000,
        thresholds: { soft: 90, urgent: 75 }, // Inverted!
      });
      // Should auto-correct: soft=75, urgent=90
      expect(result.level).toBe("soft"); // 85% is between corrected 75-90
    });
  });

  describe("formatContextWarning", () => {
    it("formats soft warning correctly", () => {
      const msg = formatContextWarning("soft", 77);
      expect(msg).toContain("77%");
      expect(msg).toContain("📊");
      expect(msg).toContain("/compact");
      expect(msg).toContain("/new");
    });

    it("formats urgent warning correctly", () => {
      const msg = formatContextWarning("urgent", 92);
      expect(msg).toContain("92%");
      expect(msg).toContain("⚠️");
      expect(msg).toContain("auto-compact");
    });

    it("returns empty string for none", () => {
      const msg = formatContextWarning("none", 50);
      expect(msg).toBe("");
    });
  });

  describe("default thresholds", () => {
    it("has correct default values", () => {
      expect(DEFAULT_CONTEXT_WARNING_THRESHOLD_SOFT).toBe(75);
      expect(DEFAULT_CONTEXT_WARNING_THRESHOLD_URGENT).toBe(90);
    });
  });
});
