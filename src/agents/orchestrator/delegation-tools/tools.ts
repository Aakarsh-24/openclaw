import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../tools/common.js";
import {
  delegateToOpenCodeAgent,
  delegateToResearchAgent,
  delegateToEmbeddedAgent,
} from "./index.js";
import type { OrchestratorConfig } from "../types.js";
import type { MoltbotConfig } from "../../../config/config.js";

export function createDelegationTools(params: {
  config: MoltbotConfig;
  orchestratorConfig: OrchestratorConfig;
  sessionId: string;
  sessionKey?: string;
  onAgentResult: (result: any) => void;
}): AnyAgentTool[] {
  const { config, orchestratorConfig, sessionId, sessionKey, onAgentResult } = params;
  const tools: AnyAgentTool[] = [];

  if (orchestratorConfig.agents?.opencode?.enabled !== false) {
    tools.push({
      name: "delegate_to_opencode",
      label: "OpenCode",
      description: "Delegate a coding, debugging, or file modification task to the OpenCode agent.",
      parameters: Type.Object({
        task: Type.String({ description: "The specific coding task to perform." }),
      }),
      execute: async (_id, args) => {
        const result = await delegateToOpenCodeAgent(
          String(args.task),
          orchestratorConfig.agents!.opencode!,
          config.agents?.defaults?.workspace ?? process.cwd(),
        );
        onAgentResult(result);
        return {
          content: [
            { type: "text", text: result.output || result.errorMessage || "Task completed." },
          ],
          details: result,
        };
      },
    });
  }

  if (orchestratorConfig.agents?.research?.enabled !== false) {
    tools.push({
      name: "delegate_to_research",
      label: "Research",
      description: "Delegate an information retrieval or web search task to the Research agent.",
      parameters: Type.Object({
        query: Type.String({ description: "The search query or research topic." }),
      }),
      execute: async (_id, args) => {
        const result = await delegateToResearchAgent(
          String(args.query),
          orchestratorConfig.agents!.research!,
          config,
        );
        onAgentResult(result);
        return {
          content: [
            { type: "text", text: result.output || result.errorMessage || "Research completed." },
          ],
          details: result,
        };
      },
    });
  }

  if (orchestratorConfig.agents?.embedded?.enabled !== false) {
    tools.push({
      name: "delegate_to_moltbot",
      label: "Moltbot",
      description: "Delegate a general query or Moltbot-specific task to the main Moltbot agent.",
      parameters: Type.Object({
        message: Type.String({ description: "The message or task for the Moltbot agent." }),
      }),
      execute: async (_id, args) => {
        const result = await delegateToEmbeddedAgent(
          String(args.message),
          orchestratorConfig.agents!.embedded!,
          config,
          sessionId,
          sessionKey,
        );
        onAgentResult(result);
        return {
          content: [
            { type: "text", text: result.output || result.errorMessage || "Task completed." },
          ],
          details: result,
        };
      },
    });
  }

  return tools;
}
