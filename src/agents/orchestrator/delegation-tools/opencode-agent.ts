import { runCommandWithTimeout } from "../../../process/exec.js";
import type { AgentResult, OpenCodeAgentConfig } from "../types.js";

export async function delegateToOpenCodeAgent(
  message: string,
  options: OpenCodeAgentConfig,
  workspaceDir: string,
): Promise<AgentResult> {
  const started = Date.now();
  const args = ["run", message];
  if (options.model) {
    args.push("--model", options.model);
  }

  try {
    const result = await runCommandWithTimeout([options.binary ?? "opencode", ...args], {
      timeoutMs: options.timeoutMs ?? 300000,
      cwd: workspaceDir,
    });

    return {
      agentName: "OpenCode",
      agentType: "opencode",
      status: result.code === 0 ? "success" : "error",
      output: result.stdout.trim(),
      errorMessage: result.code !== 0 ? result.stderr.trim() || "OpenCode failed." : undefined,
      durationMs: Date.now() - started,
      model: options.model,
    };
  } catch (error: any) {
    return {
      agentName: "OpenCode",
      agentType: "opencode",
      status: "error",
      output: "",
      errorMessage: error.message || "Failed to execute OpenCode CLI",
      durationMs: Date.now() - started,
      model: options.model,
    };
  }
}
