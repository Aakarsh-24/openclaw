import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { deliverOutboundPayloads } from "./deliver.js";
import type { MoltbotConfig } from "../../config/config.js";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../../plugins/hook-runner-global.js";
import { createPluginRegistry } from "../../plugins/registry.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import type { PluginRecord } from "../../plugins/types.js";

// Mock the channel adapter loader
vi.mock("../../channels/plugins/outbound/load.js", () => ({
  loadChannelOutboundAdapter: vi.fn().mockImplementation(async (channel) => {
    return {
      sendText: vi.fn().mockResolvedValue({ channel, messageId: "msg-123" }),
      sendMedia: vi.fn().mockResolvedValue({ channel, messageId: "msg-123" }),
    };
  }),
}));

describe("deliverOutboundPayloads hooks", () => {
  const cfg = {
    channels: {
      telegram: { enabled: true },
    },
  } as MoltbotConfig;

  // Mock plugin record for registration
  const mockPluginRecord = {
    id: "test-plugin",
    name: "Test Plugin",
    source: "test",
    origin: "workspace",
    enabled: true,
    status: "loaded",
    hookCount: 0,
  } as PluginRecord;

  const createTestRegistry = () => {
    return createPluginRegistry({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      runtime: {} as any,
    });
  };

  beforeEach(() => {
    resetGlobalHookRunner();
  });

  afterEach(() => {
    resetGlobalHookRunner();
    vi.restoreAllMocks();
  });

  it("should ignore hooks when no runner is initialized", async () => {
    // NOT initializing global hook runner

    const payloads: ReplyPayload[] = [{ text: "hello" }];
    const results = await deliverOutboundPayloads({
      cfg,
      channel: "telegram",
      to: "123",
      payloads,
    });

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe("msg-123");
  });

  it("should call message_sending hook", async () => {
    const registryHelper = createTestRegistry();
    const hookFn = vi.fn();

    registryHelper.registerTypedHook(mockPluginRecord, "message_sending", hookFn);

    initializeGlobalHookRunner(registryHelper.registry);

    const payloads: ReplyPayload[] = [{ text: "hello" }];
    await deliverOutboundPayloads({
      cfg,
      channel: "telegram",
      to: "chat-123",
      accountId: "acc-1",
      payloads,
    });

    expect(hookFn).toHaveBeenCalledTimes(1);
    expect(hookFn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "hello",
        to: "chat-123",
      }),
      expect.objectContaining({
        channelId: "telegram",
        accountId: "acc-1",
      }),
    );
  });

  it("should allow message_sending hook to modify content", async () => {
    const registryHelper = createTestRegistry();

    registryHelper.registerTypedHook(mockPluginRecord, "message_sending", async (event) => ({
      content: event.content + " world",
    }));

    initializeGlobalHookRunner(registryHelper.registry);

    // We need to spy on the actual send function to verify the content
    const { loadChannelOutboundAdapter } = await import("../../channels/plugins/outbound/load.js");
    const sendTextMock = vi.fn().mockResolvedValue({ channel: "telegram", messageId: "msg-1" });

    vi.mocked(loadChannelOutboundAdapter).mockResolvedValue({
      sendText: sendTextMock,
      sendMedia: vi.fn(),
    } as any);

    await deliverOutboundPayloads({
      cfg,
      channel: "telegram",
      to: "123",
      payloads: [{ text: "hello" }],
    });

    expect(sendTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hello world",
      }),
    );
  });

  it("should allow message_sending hook to cancel delivery", async () => {
    const registryHelper = createTestRegistry();

    registryHelper.registerTypedHook(mockPluginRecord, "message_sending", async () => ({
      cancel: true,
    }));

    initializeGlobalHookRunner(registryHelper.registry);

    const { loadChannelOutboundAdapter } = await import("../../channels/plugins/outbound/load.js");
    const sendTextMock = vi.fn().mockResolvedValue({ channel: "telegram", messageId: "msg-1" });

    vi.mocked(loadChannelOutboundAdapter).mockResolvedValue({
      sendText: sendTextMock,
      sendMedia: vi.fn(),
    } as any);

    const results = await deliverOutboundPayloads({
      cfg,
      channel: "telegram",
      to: "123",
      payloads: [{ text: "hello" }],
    });

    expect(results).toHaveLength(0);
    expect(sendTextMock).not.toHaveBeenCalled();
  });

  it("should call message_sent hook after success", async () => {
    const registryHelper = createTestRegistry();
    const sentHook = vi.fn();

    registryHelper.registerTypedHook(mockPluginRecord, "message_sent", sentHook);

    initializeGlobalHookRunner(registryHelper.registry);

    await deliverOutboundPayloads({
      cfg,
      channel: "telegram",
      to: "chat-123",
      payloads: [{ text: "hello" }],
    });

    expect(sentHook).toHaveBeenCalledTimes(1);
    expect(sentHook).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "chat-123",
        content: "hello",
        success: true,
      }),
      expect.objectContaining({
        channelId: "telegram",
      }),
    );
  });
});
