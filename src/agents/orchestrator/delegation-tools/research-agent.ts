import { createWebSearchTool } from "../../tools/web-search.js";
import type { AgentResult, ResearchAgentConfig } from "../types.js";
import type { MoltbotConfig } from "../../../config/config.js";

export async function delegateToResearchAgent(
  query: string,
  options: ResearchAgentConfig,
  config?: MoltbotConfig,
): Promise<AgentResult> {
  const started = Date.now();

  try {
    const searchTool = createWebSearchTool({ config });
    if (!searchTool) {
      throw new Error("Web search tool not available or not configured.");
    }

    const result = await searchTool.execute("orchestrator-research", { query });
    const firstContent = result.content[0];
    if (!firstContent || firstContent.type !== "text") {
      throw new Error("Research tool returned unexpected content type.");
    }
    const data = JSON.parse(firstContent.text);

    let output = "";
    if (data.results) {
      output = data.results
        .map((r: any) => `**${r.title}**\n${r.url}\n${r.description}`)
        .join("\n\n");
    } else if (data.content) {
      output = data.content;
    } else {
      output = JSON.stringify(data, null, 2);
    }

    return {
      agentName: "Research",
      agentType: "research",
      status: data.error ? "error" : "success",
      output,
      errorMessage: data.error ? data.message || data.error : undefined,
      durationMs: Date.now() - started,
      model: options.model,
    };
  } catch (error: any) {
    return {
      agentName: "Research",
      agentType: "research",
      status: "error",
      output: "",
      errorMessage: error.message || "Failed to execute research",
      durationMs: Date.now() - started,
      model: options.model,
    };
  }
}
