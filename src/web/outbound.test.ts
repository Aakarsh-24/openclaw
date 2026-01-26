import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLogger, setLoggerOverride } from "../logging.js";
import { setActiveWebListener } from "./active-listener.js";

const loadWebMediaMock = vi.fn();
vi.mock("./media.js", () => ({
  loadWebMedia: (...args: unknown[]) => loadWebMediaMock(...args),
}));

import { sendMessageWhatsApp, sendPollWhatsApp, sendReactionWhatsApp } from "./outbound.js";

describe("web outbound", () => {
  const sendComposingTo = vi.fn(async () => {});
  const sendMessage = vi.fn(async () => ({ messageId: "msg123" }));
  const sendPoll = vi.fn(async () => ({ messageId: "poll123" }));
  const sendReaction = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWebListener({
      sendComposingTo,
      sendMessage,
      sendPoll,
      sendReaction,
    });
  });

  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
    setActiveWebListener(null);
  });

  it("sends message via active listener", async () => {
    const result = await sendMessageWhatsApp("+1555", "hi", { verbose: false });
    expect(result).toEqual({
      messageId: "msg123",
      toJid: "1555@s.whatsapp.net",
    });
    expect(sendComposingTo).toHaveBeenCalledWith("+1555");
    expect(sendMessage).toHaveBeenCalledWith(
      "+1555",
      "hi",
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("throws a helpful error when no active listener exists", async () => {
    setActiveWebListener(null);
    await expect(
      sendMessageWhatsApp("+1555", "hi", { verbose: false, accountId: "work" }),
    ).rejects.toThrow(/No active WhatsApp Web listener/);
    await expect(
      sendMessageWhatsApp("+1555", "hi", { verbose: false, accountId: "work" }),
    ).rejects.toThrow(/channels login/);
    await expect(
      sendMessageWhatsApp("+1555", "hi", { verbose: false, accountId: "work" }),
    ).rejects.toThrow(/account: work/);
  });

  it("maps audio to PTT with opus mime when ogg", async () => {
    const buf = Buffer.from("audio");
    loadWebMediaMock.mockResolvedValueOnce({
      buffer: buf,
      contentType: "audio/ogg",
      kind: "audio",
    });
    await sendMessageWhatsApp("+1555", "voice note", {
      verbose: false,
      mediaUrl: "/tmp/voice.ogg",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "voice note",
      buf,
      "audio/ogg; codecs=opus",
      undefined,
      undefined,
    );
  });

  it("maps video with caption", async () => {
    const buf = Buffer.from("video");
    loadWebMediaMock.mockResolvedValueOnce({
      buffer: buf,
      contentType: "video/mp4",
      kind: "video",
    });
    await sendMessageWhatsApp("+1555", "clip", {
      verbose: false,
      mediaUrl: "/tmp/video.mp4",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "clip",
      buf,
      "video/mp4",
      undefined,
      undefined,
    );
  });

  it("marks gif playback for video when requested", async () => {
    const buf = Buffer.from("gifvid");
    loadWebMediaMock.mockResolvedValueOnce({
      buffer: buf,
      contentType: "video/mp4",
      kind: "video",
    });
    await sendMessageWhatsApp("+1555", "gif", {
      verbose: false,
      mediaUrl: "/tmp/anim.mp4",
      gifPlayback: true,
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "gif",
      buf,
      "video/mp4",
      {
        gifPlayback: true,
        accountId: undefined,
      },
      undefined,
    );
  });

  it("maps image with caption", async () => {
    const buf = Buffer.from("img");
    loadWebMediaMock.mockResolvedValueOnce({
      buffer: buf,
      contentType: "image/jpeg",
      kind: "image",
    });
    await sendMessageWhatsApp("+1555", "pic", {
      verbose: false,
      mediaUrl: "/tmp/pic.jpg",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "pic",
      buf,
      "image/jpeg",
      undefined,
      undefined,
    );
  });

  it("maps other kinds to document with filename", async () => {
    const buf = Buffer.from("pdf");
    loadWebMediaMock.mockResolvedValueOnce({
      buffer: buf,
      contentType: "application/pdf",
      kind: "document",
      fileName: "file.pdf",
    });
    await sendMessageWhatsApp("+1555", "doc", {
      verbose: false,
      mediaUrl: "/tmp/file.pdf",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "doc",
      buf,
      "application/pdf",
      undefined,
      undefined,
    );
  });

  it("sends location via active listener", async () => {
    const location = {
      latitude: 33.538368,
      longitude: -7.760028,
      name: "Home",
      address: "Some Address",
      accuracy: 12,
    };
    await sendMessageWhatsApp("+1555", "pin", {
      verbose: false,
      location,
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      "+1555",
      "pin",
      undefined,
      undefined,
      undefined,
      location,
    );
  });

  it("sends polls via active listener", async () => {
    const result = await sendPollWhatsApp(
      "+1555",
      { question: "Lunch?", options: ["Pizza", "Sushi"], maxSelections: 2 },
      { verbose: false },
    );
    expect(result).toEqual({
      messageId: "poll123",
      toJid: "1555@s.whatsapp.net",
    });
    expect(sendPoll).toHaveBeenCalledWith("+1555", {
      question: "Lunch?",
      options: ["Pizza", "Sushi"],
      maxSelections: 2,
      durationHours: undefined,
    });
  });

  it("sends reactions via active listener", async () => {
    await sendReactionWhatsApp("1555@s.whatsapp.net", "msg123", "✅", {
      verbose: false,
      fromMe: false,
    });
    expect(sendReaction).toHaveBeenCalledWith(
      "1555@s.whatsapp.net",
      "msg123",
      "✅",
      false,
      undefined,
    );
  });
});
