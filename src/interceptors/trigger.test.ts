import { describe, expect, it } from "vitest";
import type {
  MessageBeforeOutput,
  ParamsBeforeOutput,
  ToolAfterOutput,
  ToolBeforeOutput,
} from "./types.js";
import { createInterceptorRegistry } from "./registry.js";
import { trigger } from "./trigger.js";

describe("trigger", () => {
  it("returns output unchanged for empty registry", async () => {
    const registry = createInterceptorRegistry();
    const output: ToolBeforeOutput = { args: { cmd: "ls" } };
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      output,
    );
    expect(result).toBe(output);
    expect(result.args).toEqual({ cmd: "ls" });
  });

  it("tool.before handler can mutate args", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "prefix",
      name: "tool.before",
      handler: (_input, output) => {
        output.args = { ...output.args, injected: true };
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: { cmd: "ls" } },
    );
    expect(result.args).toEqual({ cmd: "ls", injected: true });
  });

  it("tool.before handler can set block", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "blocker",
      name: "tool.before",
      handler: (_input, output) => {
        output.block = true;
        output.blockReason = "denied";
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: {} },
    );
    expect(result.block).toBe(true);
    expect(result.blockReason).toBe("denied");
  });

  it("tool.after handler can mutate result", async () => {
    const registry = createInterceptorRegistry();
    const originalResult = { details: { status: "ok" }, output: "hello" };
    registry.add({
      id: "mutator",
      name: "tool.after",
      handler: (_input, output) => {
        output.result = { ...output.result, output: "modified" } as typeof output.result;
      },
    });
    const result = await trigger(
      registry,
      "tool.after",
      { toolName: "exec", toolCallId: "c1", isError: false },
      { result: originalResult } as ToolAfterOutput,
    );
    expect(result.result).toHaveProperty("output", "modified");
  });

  it("runs handlers sequentially in priority order", async () => {
    const registry = createInterceptorRegistry();
    const order: string[] = [];
    registry.add({
      id: "low",
      name: "tool.before",
      priority: 0,
      handler: () => {
        order.push("low");
      },
    });
    registry.add({
      id: "high",
      name: "tool.before",
      priority: 10,
      handler: () => {
        order.push("high");
      },
    });
    await trigger(registry, "tool.before", { toolName: "exec", toolCallId: "c1" }, { args: {} });
    expect(order).toEqual(["high", "low"]);
  });

  it("toolMatcher filters handlers", async () => {
    const registry = createInterceptorRegistry();
    const called: string[] = [];
    registry.add({
      id: "exec-only",
      name: "tool.before",
      toolMatcher: /^exec$/,
      handler: () => {
        called.push("exec-only");
      },
    });
    registry.add({
      id: "all",
      name: "tool.before",
      handler: () => {
        called.push("all");
      },
    });

    await trigger(registry, "tool.before", { toolName: "read", toolCallId: "c1" }, { args: {} });
    expect(called).toEqual(["all"]);

    called.length = 0;
    await trigger(registry, "tool.before", { toolName: "exec", toolCallId: "c2" }, { args: {} });
    expect(called).toEqual(["exec-only", "all"]);
  });

  it("supports async handlers", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "async",
      name: "tool.before",
      handler: async (_input, output) => {
        await new Promise((r) => setTimeout(r, 1));
        output.args = { delayed: true };
      },
    });
    const result = await trigger(
      registry,
      "tool.before",
      { toolName: "exec", toolCallId: "c1" },
      { args: {} },
    );
    expect(result.args).toEqual({ delayed: true });
  });

  it("message.before handler can mutate message and set metadata", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "enrich",
      name: "message.before",
      handler: (_input, output) => {
        output.message = `[enriched] ${output.message}`;
        output.metadata.enriched = true;
      },
    });
    const result = await trigger(
      registry,
      "message.before",
      { agentId: "main", provider: "anthropic", model: "claude-3" },
      { message: "hello", metadata: {} } as MessageBeforeOutput,
    );
    expect(result.message).toBe("[enriched] hello");
    expect(result.metadata.enriched).toBe(true);
  });

  it("params.before handler can override thinkLevel", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "think-boost",
      name: "params.before",
      handler: (input, output) => {
        if (input.metadata.complex) {
          output.thinkLevel = "high";
        }
      },
    });
    const result = await trigger(
      registry,
      "params.before",
      { agentId: "main", message: "solve this", metadata: { complex: true } },
      { provider: "anthropic", model: "claude-3", thinkLevel: "low" } as ParamsBeforeOutput,
    );
    expect(result.thinkLevel).toBe("high");
  });

  it("agentMatcher filters message.before handlers", async () => {
    const registry = createInterceptorRegistry();
    const called: string[] = [];
    registry.add({
      id: "coder-only",
      name: "message.before",
      agentMatcher: /^coder$/,
      handler: () => {
        called.push("coder-only");
      },
    });
    registry.add({
      id: "all-agents",
      name: "message.before",
      handler: () => {
        called.push("all-agents");
      },
    });

    await trigger(
      registry,
      "message.before",
      { agentId: "main", provider: "anthropic", model: "claude-3" },
      { message: "hi", metadata: {} } as MessageBeforeOutput,
    );
    expect(called).toEqual(["all-agents"]);

    called.length = 0;
    await trigger(
      registry,
      "message.before",
      { agentId: "coder", provider: "anthropic", model: "claude-3" },
      { message: "hi", metadata: {} } as MessageBeforeOutput,
    );
    expect(called).toEqual(["coder-only", "all-agents"]);
  });

  it("metadata flows from message.before to params.before", async () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "tagger",
      name: "message.before",
      handler: (_input, output) => {
        output.metadata.complexity = "high";
      },
    });
    registry.add({
      id: "router",
      name: "params.before",
      handler: (input, output) => {
        if (input.metadata.complexity === "high") {
          output.thinkLevel = "high";
        }
      },
    });

    const msgResult = await trigger(
      registry,
      "message.before",
      { agentId: "main", provider: "anthropic", model: "claude-3" },
      { message: "complex problem", metadata: {} } as MessageBeforeOutput,
    );

    const paramsResult = await trigger(
      registry,
      "params.before",
      { agentId: "main", message: msgResult.message, metadata: msgResult.metadata },
      { provider: "anthropic", model: "claude-3", thinkLevel: "off" } as ParamsBeforeOutput,
    );
    expect(paramsResult.thinkLevel).toBe("high");
  });
});
