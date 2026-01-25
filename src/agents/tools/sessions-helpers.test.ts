import { describe, expect, it } from "vitest";

import {
  extractAssistantText,
  sanitizeTextContent,
  stripToolMessages,
} from "./sessions-helpers.js";

describe("sanitizeTextContent", () => {
  it("strips minimax tool call XML and downgraded markers", () => {
    const input =
      'Hello <invoke name="tool">payload</invoke></minimax:tool_call> ' +
      "[Tool Call: foo (ID: 1)] world";
    const result = sanitizeTextContent(input).trim();
    expect(result).toBe("Hello  world");
    expect(result).not.toContain("invoke");
    expect(result).not.toContain("Tool Call");
  });

  it("strips thinking tags", () => {
    const input = "Before <think>secret</think> after";
    const result = sanitizeTextContent(input).trim();
    expect(result).toBe("Before  after");
  });
});

describe("extractAssistantText", () => {
  it("sanitizes blocks without injecting newlines", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "text", text: "Hi " },
        { type: "text", text: "<think>secret</think>there" },
      ],
    };
    expect(extractAssistantText(message)).toBe("Hi there");
  });
});

describe("stripToolMessages", () => {
  it("removes toolResult entries and known tool summary prefixes", () => {
    const messages = [
      { role: "assistant", content: [{ type: "text", text: "Tool: use cache" }] },
      { role: "assistant", content: [{ type: "text", text: "🛠️ Exec: ls -la" }] },
      { role: "assistant", content: [{ type: "text", text: "🧩 Tool: fallback" }] },
      { role: "toolResult", content: [] },
      { role: "assistant", content: [{ type: "text", text: "Kept" }] },
    ];

    const filtered = stripToolMessages(messages);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ role: "assistant" });
    expect(extractAssistantText(filtered[0])).toBe("Kept");
  });

  it("keeps emoji-prefixed assistant headings that are not tool summaries", () => {
    const messages = [
      { role: "assistant", content: [{ type: "text", text: "📌 Note: keep this" }] },
      { role: "assistant", content: [{ type: "text", text: "✅ Done: keep this too" }] },
      { role: "assistant", content: [{ type: "text", text: "📎 Media: 2 ok" }] },
    ];

    const filtered = stripToolMessages(messages);
    expect(filtered).toHaveLength(3);
    expect(filtered.map((msg) => extractAssistantText(msg))).toEqual([
      "📌 Note: keep this",
      "✅ Done: keep this too",
      "📎 Media: 2 ok",
    ]);
  });
});
