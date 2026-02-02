import { describe, expect, it } from "vitest";
import type { InterceptorRegistration } from "./types.js";
import { createInterceptorRegistry } from "./registry.js";

describe("interceptor registry", () => {
  it("adds and lists registrations", () => {
    const registry = createInterceptorRegistry();
    const reg: InterceptorRegistration = {
      id: "a",
      name: "tool.before",
      handler: () => {},
    };
    registry.add(reg);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].id).toBe("a");
  });

  it("removes by id", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "tool.before", handler: () => {} });
    registry.add({ id: "b", name: "tool.before", handler: () => {} });
    registry.remove("a");
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].id).toBe("b");
  });

  it("remove is a no-op for unknown id", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "tool.before", handler: () => {} });
    registry.remove("unknown");
    expect(registry.list()).toHaveLength(1);
  });

  it("clears all entries", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "tool.before", handler: () => {} });
    registry.add({ id: "b", name: "tool.after", handler: () => {} });
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it("get filters by name", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "tool.before", handler: () => {} });
    registry.add({ id: "b", name: "tool.after", handler: () => {} });
    expect(registry.get("tool.before")).toHaveLength(1);
    expect(registry.get("tool.before")[0].id).toBe("a");
    expect(registry.get("tool.after")).toHaveLength(1);
    expect(registry.get("tool.after")[0].id).toBe("b");
  });

  it("get sorts by priority descending", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "low", name: "tool.before", handler: () => {}, priority: 1 });
    registry.add({ id: "high", name: "tool.before", handler: () => {}, priority: 10 });
    registry.add({ id: "default", name: "tool.before", handler: () => {} });
    const result = registry.get("tool.before");
    expect(result.map((r) => r.id)).toEqual(["high", "low", "default"]);
  });

  it("get filters by toolMatcher", () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "exec-only",
      name: "tool.before",
      handler: () => {},
      toolMatcher: /^exec$/,
    });
    registry.add({ id: "all", name: "tool.before", handler: () => {} });

    const execResults = registry.get("tool.before", "exec");
    expect(execResults.map((r) => r.id)).toEqual(["exec-only", "all"]);

    const readResults = registry.get("tool.before", "read");
    expect(readResults.map((r) => r.id)).toEqual(["all"]);
  });

  it("get without toolName returns entries with and without matchers", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "tool.before", handler: () => {}, toolMatcher: /exec/ });
    registry.add({ id: "b", name: "tool.before", handler: () => {} });
    // When no toolName is passed, entries with toolMatcher are still included
    expect(registry.get("tool.before")).toHaveLength(2);
  });

  it("throws on toolMatcher that matches no known tool", () => {
    const registry = createInterceptorRegistry();
    expect(() =>
      registry.add({
        id: "bad",
        name: "tool.before",
        handler: () => {},
        toolMatcher: /^nonexistent_tool$/,
      }),
    ).toThrow(/does not match any known tool name/);
  });

  it("allows toolMatcher that matches a known tool", () => {
    const registry = createInterceptorRegistry();
    expect(() =>
      registry.add({
        id: "good",
        name: "tool.before",
        handler: () => {},
        toolMatcher: /^exec$/,
      }),
    ).not.toThrow();
  });

  it("allows toolMatcher with regex patterns matching known tools", () => {
    const registry = createInterceptorRegistry();
    expect(() =>
      registry.add({
        id: "multi",
        name: "tool.before",
        handler: () => {},
        toolMatcher: /^(read|write|edit)$/,
      }),
    ).not.toThrow();
  });

  it("agentMatcher filters message.before interceptors", () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "coder",
      name: "message.before",
      handler: () => {},
      agentMatcher: /^coder$/,
    });
    registry.add({ id: "all", name: "message.before", handler: () => {} });

    expect(registry.get("message.before", "main").map((r) => r.id)).toEqual(["all"]);
    expect(registry.get("message.before", "coder").map((r) => r.id)).toEqual(["coder", "all"]);
  });

  it("get filters params.before by name", () => {
    const registry = createInterceptorRegistry();
    registry.add({ id: "a", name: "message.before", handler: () => {} });
    registry.add({ id: "b", name: "params.before", handler: () => {} });
    expect(registry.get("params.before")).toHaveLength(1);
    expect(registry.get("params.before")[0].id).toBe("b");
  });

  it("agentMatcher does not affect tool events", () => {
    const registry = createInterceptorRegistry();
    registry.add({
      id: "with-agent",
      name: "tool.before",
      handler: () => {},
      agentMatcher: /^coder$/,
    });
    // tool.before ignores agentMatcher — entry should still appear
    expect(registry.get("tool.before", "exec")).toHaveLength(1);
  });
});
