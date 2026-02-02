import type { AgentTool } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it } from "vitest";
import { initializeGlobalInterceptors, resetGlobalInterceptors } from "../interceptors/global.js";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

describe("pi tool definition adapter", () => {
  afterEach(() => {
    resetGlobalInterceptors();
  });

  it("wraps tool errors into a tool result", async () => {
    const tool = {
      name: "boom",
      label: "Boom",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call1", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "boom",
    });
    expect(result.details).toMatchObject({ error: "nope" });
    expect(JSON.stringify(result.details)).not.toContain("\n    at ");
  });

  it("normalizes exec tool aliases in error results", async () => {
    const tool = {
      name: "bash",
      label: "Bash",
      description: "throws",
      parameters: {},
      execute: async () => {
        throw new Error("nope");
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call2", {}, undefined, undefined);

    expect(result.details).toMatchObject({
      status: "error",
      tool: "exec",
      error: "nope",
    });
  });

  it("executes normally when no interceptor registry is set", async () => {
    const tool = {
      name: "echo",
      label: "Echo",
      description: "echoes",
      parameters: {},
      execute: async () => ({ details: { text: "hello" }, output: "hello" }),
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call3", {}, undefined, undefined);
    expect(result.details).toEqual({ text: "hello" });
  });

  it("tool.before interceptor can block execution", async () => {
    const registry = initializeGlobalInterceptors();
    registry.add({
      id: "blocker",
      name: "tool.before",
      handler: (_input, output) => {
        output.block = true;
        output.blockReason = "not allowed";
      },
    });

    const tool = {
      name: "echo",
      label: "Echo",
      description: "echoes",
      parameters: {},
      execute: async () => ({ details: { text: "hello" }, output: "hello" }),
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call4", {}, undefined, undefined);
    expect(result.details).toMatchObject({
      status: "blocked",
      tool: "echo",
      reason: "not allowed",
    });
  });

  it("tool.before interceptor can mutate args", async () => {
    const registry = initializeGlobalInterceptors();
    registry.add({
      id: "injector",
      name: "tool.before",
      handler: (_input, output) => {
        output.args = { ...output.args, extra: "injected" };
      },
    });

    let receivedParams: unknown;
    const tool = {
      name: "echo",
      label: "Echo",
      description: "echoes",
      parameters: {},
      execute: async (_id: string, params: unknown) => {
        receivedParams = params;
        return { details: { ok: true }, output: "ok" };
      },
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    await defs[0].execute("call5", { original: true }, undefined, undefined);
    expect(receivedParams).toEqual({ original: true, extra: "injected" });
  });

  it("tool.after interceptor can modify result", async () => {
    const registry = initializeGlobalInterceptors();
    registry.add({
      id: "modifier",
      name: "tool.after",
      handler: (_input, output) => {
        output.result = { details: { modified: true }, output: "modified" };
      },
    });

    const tool = {
      name: "echo",
      label: "Echo",
      description: "echoes",
      parameters: {},
      execute: async () => ({ details: { text: "original" }, output: "original" }),
    } satisfies AgentTool<unknown, unknown>;

    const defs = toToolDefinitions([tool]);
    const result = await defs[0].execute("call6", {}, undefined, undefined);
    expect(result.details).toEqual({ modified: true });
  });
});
