import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as tauRpc from "../process/tau-rpc.js";
import * as commandReply from "./command-reply.js";
import { getReplyFromConfig } from "./reply.js";

const webMocks = vi.hoisted(() => ({
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(120_000),
  readWebSelfId: vi.fn().mockReturnValue({ e164: "+1999" }),
}));

vi.mock("../web/session.js", () => webMocks);

const baseCfg = {
  inbound: {
    allowFrom: ["*"],
    reply: {
      mode: "command" as const,
      command: ["echo", "{{Body}}"],
      session: undefined,
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trigger handling", () => {
  it("aborts even with timestamp prefix", async () => {
    const commandSpy = vi.spyOn(commandReply, "runCommandReply");
    const res = await getReplyFromConfig(
      {
        Body: "[Dec 5 10:00] stop",
        From: "+1000",
        To: "+2000",
      },
      {},
      baseCfg,
    );
    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text).toBe("⚙️ Agent was aborted.");
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it("restarts even with prefix/whitespace", async () => {
    const commandSpy = vi.spyOn(commandReply, "runCommandReply");
    const res = await getReplyFromConfig(
      {
        Body: "  [Dec 5] /restart",
        From: "+1001",
        To: "+2000",
      },
      {},
      baseCfg,
    );
    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text?.startsWith("⚙️ Restarting" ?? "")).toBe(true);
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it("reports status without invoking the agent", async () => {
    const commandSpy = vi.spyOn(commandReply, "runCommandReply");
    const res = await getReplyFromConfig(
      {
        Body: "/status",
        From: "+1002",
        To: "+2000",
      },
      {},
      baseCfg,
    );
    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text).toContain("Status");
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it("acknowledges a bare /new without treating it as empty", async () => {
    const commandSpy = vi.spyOn(commandReply, "runCommandReply");
    const res = await getReplyFromConfig(
      {
        Body: "/new",
        From: "+1003",
        To: "+2000",
      },
      {},
      {
        inbound: {
          allowFrom: ["*"],
          reply: {
            mode: "command",
            command: ["echo", "{{Body}}"],
            session: {
              store: join(tmpdir(), `clawdis-session-test-${Date.now()}.json`),
            },
          },
        },
      },
    );
    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text).toMatch(/fresh session/i);
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it("ignores think directives that only appear in the context wrapper", async () => {
    const rpcMock = vi.spyOn(tauRpc, "runPiRpc").mockResolvedValue({
      stdout:
        '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}',
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });

    const res = await getReplyFromConfig(
      {
        Body: [
          "[Chat messages since your last reply - for context]",
          "Peter: /thinking high [2025-12-05T21:45:00.000Z]",
          "",
          "[Current message - respond to this]",
          "Give me the status",
        ].join("\n"),
        From: "+1002",
        To: "+2000",
      },
      {},
      baseCfg,
    );

    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text).toBe("ok");
    expect(rpcMock).toHaveBeenCalledOnce();
    const prompt = rpcMock.mock.calls[0]?.[0]?.prompt ?? "";
    expect(prompt).toContain("Give me the status");
    expect(prompt).not.toContain("/thinking high");
  });

  it("does not emit directive acks for heartbeats with /think", async () => {
    const rpcMock = vi.spyOn(tauRpc, "runPiRpc").mockResolvedValue({
      stdout:
        '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}',
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });

    const res = await getReplyFromConfig(
      {
        Body: "HEARTBEAT /think:high",
        From: "+1003",
        To: "+1003",
      },
      { isHeartbeat: true },
      {
        inbound: {
          reply: {
            mode: "command",
            command: ["pi", "{{Body}}"],
            agent: { kind: "pi" },
            session: {},
          },
        },
      },
    );

    const text = Array.isArray(res) ? res[0]?.text : res?.text;
    expect(text).toBe("ok");
    expect(text).not.toMatch(/Thinking level set/i);
    expect(rpcMock).toHaveBeenCalledOnce();
  });
});

describe("group intro prompts", () => {
  it("labels Discord groups using the surface metadata", async () => {
    const commandSpy = vi
      .spyOn(commandReply, "runCommandReply")
      .mockResolvedValue({ payloads: [{ text: "ok" }], meta: { durationMs: 1 } });

    await getReplyFromConfig(
      {
        Body: "status update",
        From: "group:dev",
        To: "+1888",
        ChatType: "group",
        GroupSubject: "Release Squad",
        GroupMembers: "Alice, Bob",
        Surface: "discord",
      },
      {},
      baseCfg,
    );

    expect(commandSpy).toHaveBeenCalledOnce();
    const body =
      commandSpy.mock.calls.at(-1)?.[0]?.templatingCtx.Body ?? "";
    const intro = body.split("\n\n")[0];
    expect(intro).toBe(
      'You are replying inside the Discord group "Release Squad". Group members: Alice, Bob. Address the specific sender noted in the message context.',
    );
  });

  it("keeps WhatsApp labeling for WhatsApp group chats", async () => {
    const commandSpy = vi
      .spyOn(commandReply, "runCommandReply")
      .mockResolvedValue({ payloads: [{ text: "ok" }], meta: { durationMs: 1 } });

    await getReplyFromConfig(
      {
        Body: "ping",
        From: "123@g.us",
        To: "+1999",
        ChatType: "group",
        GroupSubject: "Ops",
        Surface: "whatsapp",
      },
      {},
      baseCfg,
    );

    expect(commandSpy).toHaveBeenCalledOnce();
    const body =
      commandSpy.mock.calls.at(-1)?.[0]?.templatingCtx.Body ?? "";
    const intro = body.split("\n\n")[0];
    expect(intro).toBe(
      'You are replying inside the Whatsapp group "Ops". Address the specific sender noted in the message context.',
    );
  });

  it("labels Telegram groups using their own surface", async () => {
    const commandSpy = vi
      .spyOn(commandReply, "runCommandReply")
      .mockResolvedValue({ payloads: [{ text: "ok" }], meta: { durationMs: 1 } });

    await getReplyFromConfig(
      {
        Body: "ping",
        From: "group:tg",
        To: "+1777",
        ChatType: "group",
        GroupSubject: "Dev Chat",
        Surface: "telegram",
      },
      {},
      baseCfg,
    );

    expect(commandSpy).toHaveBeenCalledOnce();
    const body =
      commandSpy.mock.calls.at(-1)?.[0]?.templatingCtx.Body ?? "";
    const intro = body.split("\n\n")[0];
    expect(intro).toBe(
      'You are replying inside the Telegram group "Dev Chat". Address the specific sender noted in the message context.',
    );
  });
});
