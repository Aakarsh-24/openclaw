/**
 * Tool Hook Wrappers
 *
 * Wraps tool execute methods to fire before_tool_call and after_tool_call
 * plugin hooks around every tool invocation.
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { HookRunner } from "../plugins/hooks.js";
import type { AnyAgentTool } from "./pi-tools.types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("tools/hooks");

/**
 * Wrap a single AgentTool's execute method to fire before_tool_call and after_tool_call hooks.
 */
export function wrapToolWithHooks(
  tool: AnyAgentTool,
  hookRunner: HookRunner,
  ctx: { agentId?: string; sessionKey?: string },
): AnyAgentTool {
  const originalExecute = tool.execute;
  if (!originalExecute) {
    return tool;
  }

  const toolName = tool.name;

  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate): Promise<AgentToolResult<unknown>> => {
      const hookCtx = {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
        toolName,
      };

      // --- before_tool_call ---
      let effectiveParams = params;
      if (hookRunner.hasHooks("before_tool_call")) {
        try {
          const beforeResult = await hookRunner.runBeforeToolCall(
            {
              toolName,
              params: (params ?? {}) as Record<string, unknown>,
            },
            hookCtx,
          );
          if (beforeResult?.block) {
            const reason = beforeResult.blockReason ?? "Blocked by plugin hook";
            log.debug(`before_tool_call: blocked ${toolName} — ${reason}`);
            return {
              content: [{ type: "text", text: `[Tool call blocked] ${reason}` }],
              details: { blocked: true, reason },
            };
          }
          if (beforeResult?.params) {
            effectiveParams = beforeResult.params;
          }
        } catch (err) {
          log.debug(`before_tool_call hook error for ${toolName}: ${String(err)}`);
          // Hook errors must not break tool execution
        }
      }

      // --- execute ---
      const startMs = Date.now();
      let result: AgentToolResult<unknown> | undefined;
      let error: string | undefined;
      try {
        result = await originalExecute(toolCallId, effectiveParams, signal, onUpdate);
        return result;
      } catch (err) {
        error = String(err);
        throw err;
      } finally {
        // --- after_tool_call (fire-and-forget) ---
        if (hookRunner.hasHooks("after_tool_call")) {
          hookRunner
            .runAfterToolCall(
              {
                toolName,
                params: (effectiveParams ?? {}) as Record<string, unknown>,
                result,
                error,
                durationMs: Date.now() - startMs,
              },
              hookCtx,
            )
            .catch((hookErr) => {
              log.debug(`after_tool_call hook error for ${toolName}: ${String(hookErr)}`);
            });
        }
      }
    },
  };
}

/**
 * Wrap a single ToolDefinition's execute method to fire before_tool_call and after_tool_call hooks.
 * ToolDefinition uses a different execute signature: (toolCallId, params, onUpdate, ctx, signal)
 */
export function wrapToolDefinitionWithHooks<T extends ToolDefinition>(
  tool: T,
  hookRunner: HookRunner,
  ctx: { agentId?: string; sessionKey?: string },
): T {
  if (!tool.execute) {
    return tool;
  }
  // Bind to preserve context in case execute uses `this`
  const originalExecute = tool.execute.bind(tool);
  const toolName = tool.name;

  return {
    ...tool,
    execute: async (
      toolCallId,
      params,
      onUpdate,
      extCtx,
      signal,
    ): Promise<AgentToolResult<unknown>> => {
      const hookCtx = {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
        toolName,
      };

      // --- before_tool_call ---
      let effectiveParams = params;
      if (hookRunner.hasHooks("before_tool_call")) {
        try {
          const beforeResult = await hookRunner.runBeforeToolCall(
            {
              toolName,
              params: (params ?? {}) as Record<string, unknown>,
            },
            hookCtx,
          );
          if (beforeResult?.block) {
            const reason = beforeResult.blockReason ?? "Blocked by plugin hook";
            log.debug(`before_tool_call: blocked ${toolName} — ${reason}`);
            return {
              content: [{ type: "text", text: `[Tool call blocked] ${reason}` }],
              details: { blocked: true, reason },
            };
          }
          if (beforeResult?.params) {
            effectiveParams = beforeResult.params;
          }
        } catch (err) {
          log.debug(`before_tool_call hook error for ${toolName}: ${String(err)}`);
          // Hook errors must not break tool execution
        }
      }

      // --- execute ---
      const startMs = Date.now();
      let result: AgentToolResult<unknown> | undefined;
      let error: string | undefined;
      try {
        result = await originalExecute(toolCallId, effectiveParams, onUpdate, extCtx, signal);
        return result;
      } catch (err) {
        error = String(err);
        throw err;
      } finally {
        // --- after_tool_call (fire-and-forget) ---
        if (hookRunner.hasHooks("after_tool_call")) {
          hookRunner
            .runAfterToolCall(
              {
                toolName,
                params: (effectiveParams ?? {}) as Record<string, unknown>,
                result,
                error,
                durationMs: Date.now() - startMs,
              },
              hookCtx,
            )
            .catch((hookErr) => {
              log.debug(`after_tool_call hook error for ${toolName}: ${String(hookErr)}`);
            });
        }
      }
    },
  } as T;
}

/**
 * Wrap all AgentTools in an array with before/after tool call hooks.
 * Returns the original array unchanged if no tool call hooks are registered.
 */
export function wrapToolsWithHooks(
  tools: AnyAgentTool[],
  hookRunner: HookRunner,
  ctx: { agentId?: string; sessionKey?: string },
): AnyAgentTool[] {
  if (!hookRunner.hasHooks("before_tool_call") && !hookRunner.hasHooks("after_tool_call")) {
    return tools;
  }
  return tools.map((tool) => wrapToolWithHooks(tool, hookRunner, ctx));
}

/**
 * Wrap all ToolDefinitions in an array with before/after tool call hooks.
 * Returns the original array unchanged if no tool call hooks are registered.
 */
export function wrapToolDefinitionsWithHooks<T extends ToolDefinition>(
  tools: T[],
  hookRunner: HookRunner,
  ctx: { agentId?: string; sessionKey?: string },
): T[] {
  if (!hookRunner.hasHooks("before_tool_call") && !hookRunner.hasHooks("after_tool_call")) {
    return tools;
  }
  return tools.map((tool) => wrapToolDefinitionWithHooks(tool, hookRunner, ctx));
}
