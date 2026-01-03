/**
 * Deep Research E2E Tests (dry-run mode)
 * Run with: pnpm test src/deep-research/e2e.test.ts
 */

import { accessSync, constants } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  detectDeepResearchIntent,
  extractTopicFromMessage,
  executeDeepResearch,
  parseResultJson,
  messages,
} from "./index.js";
import { getDefaultDeepResearchCliPath } from "../config/config.js";

const cliPath =
  process.env.DEEP_RESEARCH_CLI_PATH?.trim() ||
  getDefaultDeepResearchCliPath();
let hasCli = false;
try {
  accessSync(cliPath, constants.X_OK);
  hasCli = true;
} catch {
  hasCli = false;
}
const describeE2E = hasCli ? describe : describe.skip;

describeE2E("Deep Research E2E (dry-run)", () => {
  // Ensure dry-run is enabled
  beforeAll(() => {
    process.env.DEEP_RESEARCH_DRY_RUN = "true";
  });

  describe("Detection → Execution → Delivery flow", () => {
    const testMessage = "Сделай депресерч про квантовые компьютеры";

    it("Step 1: detects deep research intent", () => {
      const detected = detectDeepResearchIntent(testMessage);
      expect(detected).toBe(true);
    });

    it("Step 2: extracts topic from message", () => {
      const topic = extractTopicFromMessage(testMessage);
      expect(topic).toBe("квантовые компьютеры");
    });

    it("Step 3: generates acknowledgment message", () => {
      const topic = extractTopicFromMessage(testMessage);
      const ack = messages.acknowledgment(topic);
      expect(ack).toContain("🔍");
      expect(ack).toContain("deep research");
      expect(ack).toContain(topic);
    });

    it(
      "Step 4: executes dry-run successfully",
      async () => {
        const topic = extractTopicFromMessage(testMessage);
        const result = await executeDeepResearch({
          topic,
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.runId).toBeDefined();
        expect(result.error).toBeUndefined();
      },
      60000,
    );

    it(
      "Step 5: parses result.json",
      async () => {
        const topic = extractTopicFromMessage(testMessage);
        const execResult = await executeDeepResearch({
          topic,
          dryRun: true,
        });

        expect(execResult.success).toBe(true);
        expect(execResult.resultJsonPath).toBeDefined();

        const parsed = await parseResultJson(execResult.resultJsonPath!);

        expect(parsed).not.toBeNull();
        expect(parsed!.summaryBullets).toBeDefined();
        expect(parsed!.summaryBullets.length).toBeGreaterThan(0);
        expect(parsed!.shortAnswer).toBeDefined();
        expect(parsed!.publishUrl).toMatch(/^https:\/\//);
      },
      60000,
    );

    it(
      "Step 6: generates result delivery message",
      async () => {
        const topic = extractTopicFromMessage(testMessage);
        const execResult = await executeDeepResearch({
          topic,
          dryRun: true,
        });
        const parsed = await parseResultJson(execResult.resultJsonPath!);

        const delivery = messages.resultDelivery(parsed!);

        expect(delivery).toContain("✅ Deep Research завершен");
        expect(delivery).toContain("📝 Краткий ответ");
        expect(delivery).toContain("📋 Основные пункты");
        expect(delivery).toContain("💭 Мнение");
        expect(delivery).toContain("🔗 Полный отчет");
        expect(delivery).toContain("https://");
      },
      60000,
    );
  });

  describe("Error handling", () => {
    it("generates error message with run_id", () => {
      const error = messages.error("Test error", "test-run-id-123");
      expect(error).toContain("❌");
      expect(error).toContain("Test error");
      expect(error).toContain("test-run-id-123");
    });
  });

  describe("All 20 patterns detected", () => {
    const patterns = [
      "сделай депресерч",
      "сделать депресерч",
      "сделайте депресерч",
      "запусти депресерч",
      "нужен депресерч",
      "депресерч по",
      "депресерч на тему",
      "депресерч про",
      "сделай дип рисерч",
      "сделать дип рисерч",
      "do deep research",
      "run deep research",
      "start deep research",
      "conduct deep research",
      "perform deep research",
      "сделай deep research",
      "сделать deep research",
      "запусти deep research",
      "сделай дипресерч",
      "сделать дипресерч",
    ];

    patterns.forEach((pattern) => {
      it(`detects "${pattern}"`, () => {
        expect(detectDeepResearchIntent(`Test ${pattern} test`)).toBe(true);
      });
    });
  });
});
