import type { AgentTool } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

// Mock the global hook runner
vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: vi.fn(() => null),
}));

import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";

const mockGetGlobalHookRunner = vi.mocked(getGlobalHookRunner);

function makeTool(
  overrides: Partial<AgentTool<unknown, unknown>> = {},
): AgentTool<unknown, unknown> {
  return {
    name: "test-tool",
    label: "Test",
    description: "test",
    parameters: {},
    execute: async () => ({ details: { ok: true }, resultForAssistant: "ok" }),
    ...overrides,
  };
}

describe("pi tool definition adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  // =========================================================================
  // before_tool_call hook tests
  // =========================================================================

  describe("before_tool_call hook", () => {
    it("blocks tool execution when hook returns block: true", async () => {
      const executeSpy = vi.fn(async () => ({ details: { ok: true }, resultForAssistant: "ok" }));
      const tool = makeTool({ name: "exec", execute: executeSpy });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "before_tool_call",
        runBeforeToolCall: vi.fn(async () => ({
          block: true,
          blockReason: "Security policy: blocked",
        })),
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "main", sessionKey: "main:abc" });
      const result = await defs[0].execute("call1", { command: "gog inbox" }, undefined, undefined);

      expect(executeSpy).not.toHaveBeenCalled();
      expect(result.details).toMatchObject({
        status: "blocked",
        tool: "exec",
        error: "Security policy: blocked",
      });
    });

    it("allows tool execution when hook does not block", async () => {
      const executeSpy = vi.fn(async () => ({
        details: { ran: true },
        resultForAssistant: "done",
      }));
      const tool = makeTool({ name: "read", execute: executeSpy });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "before_tool_call",
        runBeforeToolCall: vi.fn(async () => undefined),
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "main" });
      const result = await defs[0].execute("call1", { path: "/tmp/f" }, undefined, undefined);

      expect(executeSpy).toHaveBeenCalled();
      expect(result.details).toMatchObject({ ran: true });
    });

    it("passes modified params from hook to tool.execute", async () => {
      const executeSpy = vi.fn(async (_id: string, params: unknown) => ({
        details: { params },
        resultForAssistant: "ok",
      }));
      const tool = makeTool({ name: "exec", execute: executeSpy });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "before_tool_call",
        runBeforeToolCall: vi.fn(async () => ({
          params: { command: "echo safe" },
        })),
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "main" });
      await defs[0].execute("call1", { command: "rm -rf /" }, undefined, undefined);

      expect(executeSpy).toHaveBeenCalledWith(
        "call1",
        { command: "echo safe" },
        undefined,
        undefined,
      );
    });

    it("provides correct context to before_tool_call hook", async () => {
      const runBeforeToolCall = vi.fn(async () => undefined);
      const tool = makeTool({ name: "exec" });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "before_tool_call",
        runBeforeToolCall,
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "reader", sessionKey: "reader:xyz" });
      await defs[0].execute("call1", { command: "ls" }, undefined, undefined);

      expect(runBeforeToolCall).toHaveBeenCalledWith(
        { toolName: "exec", params: { command: "ls" } },
        { agentId: "reader", sessionKey: "reader:xyz", toolName: "exec" },
      );
    });
  });

  // =========================================================================
  // after_tool_call hook tests
  // =========================================================================

  describe("after_tool_call hook", () => {
    it("fires after_tool_call on successful execution", async () => {
      const runAfterToolCall = vi.fn(async () => {});
      const tool = makeTool({
        name: "read",
        execute: async () => ({ details: { content: "hello" }, resultForAssistant: "hello" }),
      });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "after_tool_call",
        runBeforeToolCall: vi.fn(async () => undefined),
        runAfterToolCall,
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "main" });
      await defs[0].execute("call1", { path: "/tmp/f" }, undefined, undefined);

      // Wait for the fire-and-forget promise
      await new Promise((r) => setTimeout(r, 10));

      expect(runAfterToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "read",
          params: { path: "/tmp/f" },
          result: { content: "hello" },
        }),
        expect.objectContaining({ agentId: "main", toolName: "read" }),
      );
      expect(runAfterToolCall.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("fires after_tool_call on error path with error message", async () => {
      const runAfterToolCall = vi.fn(async () => {});
      const tool = makeTool({
        name: "exec",
        execute: async () => {
          throw new Error("boom");
        },
      });

      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: (name: string) => name === "after_tool_call",
        runBeforeToolCall: vi.fn(async () => undefined),
        runAfterToolCall,
      } as any);

      const defs = toToolDefinitions([tool], { agentId: "main" });
      await defs[0].execute("call1", { command: "fail" }, undefined, undefined);

      await new Promise((r) => setTimeout(r, 10));

      expect(runAfterToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "exec",
          error: "boom",
        }),
        expect.objectContaining({ agentId: "main", toolName: "exec" }),
      );
    });
  });

  // =========================================================================
  // No hook runner (null) — backwards compatibility
  // =========================================================================

  describe("without hook runner", () => {
    it("executes normally when no hook runner is available", async () => {
      mockGetGlobalHookRunner.mockReturnValue(null);

      const tool = makeTool({
        name: "read",
        execute: async () => ({ details: { ok: true }, resultForAssistant: "ok" }),
      });

      const defs = toToolDefinitions([tool]);
      const result = await defs[0].execute("call1", {}, undefined, undefined);
      expect(result.details).toMatchObject({ ok: true });
    });

    it("executes normally when hookCtx is not provided", async () => {
      mockGetGlobalHookRunner.mockReturnValue(null);

      const tool = makeTool();
      const defs = toToolDefinitions([tool]);
      const result = await defs[0].execute("call1", {}, undefined, undefined);
      expect(result.details).toMatchObject({ ok: true });
    });
  });
});
