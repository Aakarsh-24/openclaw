import { describe, expect, it } from "vitest";
import type { InterceptorEvent } from "./types.js";
import { formatInterceptorEvent } from "./format.js";

describe("formatInterceptorEvent", () => {
  it("formats a blocked tool.before event", () => {
    const evt: InterceptorEvent = {
      name: "tool.before",
      interceptorId: "builtin:command-safety-guard",
      matchContext: "exec",
      blocked: true,
      blockReason: "rm -rf is not allowed",
    };
    expect(formatInterceptorEvent(evt)).toBe(
      '🛡️ builtin:command-safety-guard · blocked exec — "rm -rf is not allowed"',
    );
  });

  it("formats a blocked event without reason", () => {
    const evt: InterceptorEvent = {
      name: "tool.before",
      interceptorId: "builtin:security-audit",
      matchContext: "read",
      blocked: true,
    };
    expect(formatInterceptorEvent(evt)).toBe("🛡️ builtin:security-audit · blocked read");
  });

  it("formats message.before mutations", () => {
    const evt: InterceptorEvent = {
      name: "message.before",
      interceptorId: "enricher",
      mutations: ["message mutated", "metadata: complexity"],
    };
    expect(formatInterceptorEvent(evt)).toBe(
      "📨 message.before · message mutated, metadata: complexity",
    );
  });

  it("formats params.before mutations", () => {
    const evt: InterceptorEvent = {
      name: "params.before",
      interceptorId: "router",
      mutations: ["thinkLevel → high"],
    };
    expect(formatInterceptorEvent(evt)).toBe("⚙️ params.before · thinkLevel → high");
  });

  it("returns null for no-op events", () => {
    const evt: InterceptorEvent = {
      name: "tool.after",
      interceptorId: "logger",
    };
    expect(formatInterceptorEvent(evt)).toBeNull();
  });

  it("returns null for empty mutations array", () => {
    const evt: InterceptorEvent = {
      name: "params.before",
      interceptorId: "noop",
      mutations: [],
    };
    expect(formatInterceptorEvent(evt)).toBeNull();
  });
});
