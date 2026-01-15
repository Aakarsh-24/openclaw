import { describe, expect, it, vi } from "vitest";
import { subscribeEmbeddedPiSession } from "./pi-embedded-subscribe.js";

type StubSession = {
  subscribe: (fn: (evt: unknown) => void) => () => void;
};

describe("subscribeEmbeddedPiSession thinking tag code span awareness", () => {
  it("does not strip thinking tags inside inline code backticks", () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const onPartialReply = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      onPartialReply,
    });

    // Simulate streaming text that mentions <thinking> in backticks
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "The fix strips leaked `<thinking>` tags from messages.",
      },
    });

    // The partial reply should include the full text with <thinking> preserved in backticks
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).toContain("`<thinking>`");
  });

  it("does not strip thinking tags inside fenced code blocks", () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const onPartialReply = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      onPartialReply,
    });

    // Simulate streaming text with <thinking> inside a code block
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Example:\n```\n<thinking>code example</thinking>\n```\nDone.",
      },
    });

    // The partial reply should include the code block with <thinking> preserved
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).toContain("<thinking>code example</thinking>");
  });

  it("still strips actual thinking tags outside code spans", () => {
    let handler: ((evt: unknown) => void) | undefined;
    const session: StubSession = {
      subscribe: (fn) => {
        handler = fn;
        return () => {};
      },
    };

    const onPartialReply = vi.fn();

    subscribeEmbeddedPiSession({
      session: session as unknown as Parameters<typeof subscribeEmbeddedPiSession>[0]["session"],
      runId: "run",
      onPartialReply,
    });

    // Simulate text with actual thinking tags (not in code)
    handler?.({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Hello <thinking>internal thought</thinking> world",
      },
    });

    // The thinking content should be stripped
    expect(onPartialReply).toHaveBeenCalled();
    const lastCall = onPartialReply.mock.calls[onPartialReply.mock.calls.length - 1];
    expect(lastCall[0].text).not.toContain("internal thought");
    expect(lastCall[0].text).toContain("Hello");
    expect(lastCall[0].text).toContain("world");
  });
});
