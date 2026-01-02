/**
 * ATLAS Knowledge Base Integration Tool
 *
 * Provides access to the user's ATLAS knowledge management system via HTTP API.
 * ATLAS runs on localhost:8888 by default.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

// biome-ignore lint/suspicious/noExplicitAny: TypeBox schema type from pi-ai uses a different module instance.
type AnyAgentTool = AgentTool<any, unknown>;

const ATLAS_URL = process.env.ATLAS_URL || "http://localhost:8888";

const AtlasToolSchema = Type.Object({
  action: Type.Union(
    [
      Type.Literal("search"),
      Type.Literal("concept"),
      Type.Literal("insights"),
      Type.Literal("actions"),
      Type.Literal("stats"),
    ],
    {
      description:
        "Action to perform: search (semantic search), concept (get concept details), insights (curated insights), actions (pending tasks), stats (overview)",
    },
  ),
  query: Type.Optional(
    Type.String({
      description: "Search query or topic (required for search/insights)",
    }),
  ),
  concept_name: Type.Optional(
    Type.String({
      description: "Concept name for concept lookup",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of results to return (default: 10)",
    }),
  ),
});

function jsonResult(payload: unknown): AgentToolResult<unknown> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

function errorResult(message: string): AgentToolResult<unknown> {
  return {
    content: [
      {
        type: "text",
        text: `ATLAS Error: ${message}`,
      },
    ],
    details: { error: message },
  };
}

async function fetchAtlas(
  endpoint: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  },
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const { method = "GET", body } = options ?? {};
  const url = `${ATLAS_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}${text ? ` - ${text}` : ""}`,
      };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ECONNREFUSED")) {
      return {
        ok: false,
        error: `Cannot reach ATLAS at ${ATLAS_URL}. Is the ATLAS server running? (atlas serve)`,
      };
    }
    return { ok: false, error: message };
  }
}

export function createAtlasTool(): AnyAgentTool {
  return {
    label: "ATLAS Knowledge Base",
    name: "atlas_query",
    description: `Query the user's ATLAS personal knowledge base. Actions:
- search: Semantic search across all knowledge (requires 'query')
- concept: Get details about a specific concept (requires 'concept_name' or 'query')
- insights: Get curated insights, optionally filtered by topic
- actions: Get pending action items and tasks
- stats: Get knowledge base overview and statistics`,
    parameters: AtlasToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as {
        action: string;
        query?: string;
        concept_name?: string;
        limit?: number;
      };

      const { action, query, concept_name, limit = 10 } = params;

      switch (action) {
        case "search": {
          if (!query?.trim()) {
            return errorResult("'query' parameter required for search action");
          }
          const result = await fetchAtlas("/api/search", {
            method: "POST",
            body: { query: query.trim(), limit },
          });
          if (!result.ok) return errorResult(result.error);
          return jsonResult(result.data);
        }

        case "concept": {
          const conceptQuery = concept_name?.trim() || query?.trim();
          if (!conceptQuery) {
            return errorResult(
              "'concept_name' or 'query' parameter required for concept action",
            );
          }
          const result = await fetchAtlas(
            `/api/graph/concept/${encodeURIComponent(conceptQuery)}`,
          );
          if (!result.ok) return errorResult(result.error);
          return jsonResult(result.data);
        }

        case "insights": {
          // Insights endpoint can be filtered by topic
          const endpoint = query?.trim()
            ? `/api/search/insights?topic=${encodeURIComponent(query.trim())}&limit=${limit}`
            : `/api/search/insights?limit=${limit}`;
          const result = await fetchAtlas(endpoint);
          if (!result.ok) return errorResult(result.error);
          return jsonResult(result.data);
        }

        case "actions": {
          const result = await fetchAtlas(`/api/actions?limit=${limit}`);
          if (!result.ok) return errorResult(result.error);
          return jsonResult(result.data);
        }

        case "stats": {
          const result = await fetchAtlas("/api/overview");
          if (!result.ok) return errorResult(result.error);
          return jsonResult(result.data);
        }

        default:
          return errorResult(
            `Unknown action: ${action}. Valid actions: search, concept, insights, actions, stats`,
          );
      }
    },
  };
}

export const atlasTool = createAtlasTool();
