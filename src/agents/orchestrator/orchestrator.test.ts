import { describe, expect, it, vi } from "vitest";
import { orchestrateUserMessage } from "./orchestrator.js";
import { ORCHESTRATOR_DEFAULT_MODEL } from "./config.js";

vi.mock("../pi-embedded-runner/run.js", () => ({
  runEmbeddedPiAgent: vi.fn(async (params) => {
    if (params.sessionId.startsWith("orch-")) {
      return {
        payloads: [{ text: "I'll help you with that." }],
        meta: {
          durationMs: 100,
          agentMeta: {
            sessionId: params.sessionId,
            provider: params.provider,
            model: params.model,
          },
        },
      };
    }
    return {
      payloads: [{ text: "Sub-agent result" }],
      meta: {
        durationMs: 200,
        agentMeta: {
          sessionId: params.sessionId,
          provider: params.provider,
          model: params.model,
        },
      },
    };
  }),
}));

describe("Orchestrator", () => {
  it("should handle direct response when no tools called", async () => {
    const result = await orchestrateUserMessage({
      userMessage: "hello",
      sessionId: "test-session",
      config: {
        orchestrator: {
          enabled: true,
          model: ORCHESTRATOR_DEFAULT_MODEL,
        },
      } as any,
    });

    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].agentName).toBe("Orchestrator");
    expect(result.agentResults[0].output).toBe("I'll help you with that.");
  });

  it("should fall back to direct embedded run if disabled", async () => {
    const result = await orchestrateUserMessage({
      userMessage: "hello",
      sessionId: "test-session",
      config: {
        orchestrator: {
          enabled: false,
        },
      } as any,
    });

    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].agentName).toBe("Moltbot");
    expect(result.agentResults[0].agentType).toBe("embedded");
    expect(result.agentResults[0].output).toBe("Sub-agent result");
  });
});
