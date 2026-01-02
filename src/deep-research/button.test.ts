import { describe, expect, it } from "vitest";

import {
  CallbackActions,
  CALLBACK_PREFIX,
  createExecuteButton,
  createRetryButton,
  parseCallbackData,
} from "./button.js";

type InlineKeyboardLike = {
  inline_keyboard: Array<Array<{ callback_data?: string }>>;
};

function getCallbackData(button: InlineKeyboardLike): string {
  return button.inline_keyboard[0]?.[0]?.callback_data ?? "";
}

describe("deep-research button callbacks", () => {
  it("round-trips short topic for execute", () => {
    const topic = "квантовые компьютеры";
    const ownerId = 14835038;
    const keyboard = createExecuteButton(topic, ownerId);
    const data = getCallbackData(keyboard);

    expect(data.startsWith(`${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:`)).toBe(
      true,
    );

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("round-trips short topic for retry", () => {
    const topic = "AI safety";
    const ownerId = 42;
    const keyboard = createRetryButton(topic, ownerId);
    const data = getCallbackData(keyboard);

    expect(data.startsWith(`${CALLBACK_PREFIX}${CallbackActions.RETRY}:`)).toBe(
      true,
    );

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.RETRY);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("stores long topics and round-trips via callback", () => {
    const topic = "Использование носков рок-звездами в истории".repeat(4);
    const keyboard = createExecuteButton(topic, 1);
    const data = getCallbackData(keyboard);

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
  });

  it("parses callbacks without owner id", () => {
    const topic = "plain topic";
    const data = `${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:${topic}`;

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBeUndefined();
  });

  it("parses legacy owner format", () => {
    const topic = "legacy topic";
    const ownerId = 777;
    const data = `${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:${ownerId}:${topic}`;

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("parses u-prefixed owner format", () => {
    const topic = "prefixed topic";
    const ownerId = 888;
    const data = `${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:u${ownerId}:${topic}`;

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.topic).toBe(topic);
    expect(parsed?.ownerId).toBe(ownerId);
  });

  it("treats malformed owner prefix as topic", () => {
    const topic = "topic";
    const data = `${CALLBACK_PREFIX}${CallbackActions.EXECUTE}:uabc:${topic}`;

    const parsed = parseCallbackData(data);
    expect(parsed?.action).toBe(CallbackActions.EXECUTE);
    expect(parsed?.ownerId).toBeUndefined();
    expect(parsed?.topic).toBe(`uabc:${topic}`);
  });

  it("returns null for unrelated callback data", () => {
    expect(parseCallbackData("other:payload")).toBeNull();
  });
});
