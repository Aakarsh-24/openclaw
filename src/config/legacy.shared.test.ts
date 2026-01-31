import { describe, it, expect } from "vitest";
import { mapLegacyAudioTranscription } from "./legacy.shared.js";

describe("mapLegacyAudioTranscription", () => {
  it("should migrate whisper config", () => {
    const result = mapLegacyAudioTranscription({
      command: ["whisper", "--model", "base"],
      timeoutSeconds: 120,
    });
    expect(result).not.toBeNull();
  });

  it("should migrate whisperx config", () => {
    const result = mapLegacyAudioTranscription({
      command: ["whisperx", "--model", "base"],
      timeoutSeconds: 120,
    });
    expect(result).not.toBeNull();
  });

  it("should migrate whisperx-transcribe.sh config", () => {
    const result = mapLegacyAudioTranscription({
      command: ["/home/user/whisperx-transcribe.sh"],
      timeoutSeconds: 120,
    });
    expect(result).not.toBeNull();
  });

  it("should migrate WhisperX (case insensitive)", () => {
    const result = mapLegacyAudioTranscription({
      command: ["WhisperX"],
      timeoutSeconds: 60,
    });
    expect(result).not.toBeNull();
  });

  it("should reject ffmpeg (not whisper-based)", () => {
    const result = mapLegacyAudioTranscription({
      command: ["ffmpeg", "-i", "input.ogg"],
      timeoutSeconds: 60,
    });
    expect(result).toBeNull();
  });

  it("should reject empty command", () => {
    const result = mapLegacyAudioTranscription({
      command: [],
    });
    expect(result).toBeNull();
  });

  it("should reject null input", () => {
    const result = mapLegacyAudioTranscription(null);
    expect(result).toBeNull();
  });
});
