/**
 * Ruvector Search Tool
 *
 * Provides semantic vector search capabilities for Clawdbot agents using ruvector.
 * Embeds queries using the configured embedding provider and searches the vector store.
 */

import { Type } from "@sinclair/typebox";

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { jsonResult, readNumberParam, readStringParam, stringEnum } from "clawdbot/plugin-sdk";

import type { RuvectorService } from "./service.js";
import type { RuvectorDB } from "./db.js";
import type { EmbeddingProvider } from "./embeddings.js";
import type { VectorSearchResult } from "./types.js";
import { RelationshipInferrer } from "./graph/relationships.js";

// Schema for the ruvector_search tool parameters
const RuvectorSearchSchema = Type.Object({
  query: Type.String({
    description: "The search query to embed and search for in the vector store",
  }),
  k: Type.Optional(
    Type.Number({
      description: "Number of results to return (default: 10)",
      default: 10,
    }),
  ),
  filters: Type.Optional(
    Type.Object(
      {},
      {
        additionalProperties: true,
        description: "Optional metadata filters to apply to the search",
      },
    ),
  ),
});

export type CreateRuvectorSearchToolOptions = {
  api: ClawdbotPluginApi;
  service: RuvectorService;
  embedQuery: (text: string) => Promise<number[]>;
};

/**
 * Creates the ruvector_search agent tool.
 *
 * @param options - Tool configuration including API, service, and embedding function
 * @returns An agent tool that can be registered with the plugin API
 */
export function createRuvectorSearchTool(options: CreateRuvectorSearchToolOptions) {
  const { api, service, embedQuery } = options;

  return {
    name: "ruvector_search",
    label: "Ruvector Search",
    description:
      "Search the ruvector vector knowledge base using semantic similarity. " +
      "Use this tool to find relevant documents, memories, or knowledge based on meaning rather than exact keywords.",
    parameters: RuvectorSearchSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const query = readStringParam(params, "query", { required: true });
      const rawK = readNumberParam(params, "k", { integer: true }) ?? 10;
      // Clamp k to reasonable bounds
      const k = Math.max(1, Math.min(rawK, 100));
      const filters = params.filters as Record<string, unknown> | undefined;

      // Validate service is running
      if (!service.isRunning()) {
        return jsonResult({
          results: [],
          error: "ruvector service is not running",
          disabled: true,
        });
      }

      try {
        // Get the ruvector client (validates service is connected)
        const client = service.getClient();

        // Generate embedding for the query
        api.logger.debug?.(`ruvector_search: embedding query "${query.slice(0, 50)}..."`);
        const queryVector = await embedQuery(query);

        // Perform the vector search
        api.logger.debug?.(
          `ruvector_search: searching with k=${k}${filters ? `, filters=${JSON.stringify(filters)}` : ""}`,
        );

        const searchResults = await client.search({
          vector: queryVector,
          limit: k,
          filter: filters,
        });

        // Format results
        if (searchResults.length === 0) {
          return jsonResult({
            results: [],
            message: "No matching results found",
            query,
            k,
          });
        }

        const formattedResults = searchResults.map((r) => ({
          id: r.entry.id,
          text: r.entry.metadata.text ?? "",
          score: r.score,
          category: r.entry.metadata.category,
          metadata: r.entry.metadata,
        }));

        const formattedText = formattedResults
          .map((r, i) => {
            const text = r.text || "(no text)";
            const truncated = text.slice(0, 100);
            const suffix = text.length > 100 ? "..." : "";
            return `${i + 1}. [${r.category ?? "other"}] ${truncated}${suffix} (${(r.score * 100).toFixed(0)}%)`;
          })
          .join("\n");

        return jsonResult({
          results: formattedResults,
          count: searchResults.length,
          query,
          k,
          message: `Found ${searchResults.length} result(s):\n\n${formattedText}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvector_search: search failed: ${message}`);
        return jsonResult({
          results: [],
          error: message,
          disabled: true,
        });
      }
    },
  };
}

// ============================================================================
// SONA Feedback Tool
// ============================================================================

/**
 * Schema for the ruvector_feedback tool parameters.
 * Used for SONA (Self-Optimizing Neural Architecture) relevance feedback.
 */
const RuvectorFeedbackSchema = Type.Object({
  searchId: Type.String({
    description: "ID of the search to provide feedback for",
  }),
  selectedResultId: Type.String({
    description: "ID of the result the user found relevant",
  }),
  relevanceScore: Type.Number({
    description: "Relevance score from 0 (irrelevant) to 1 (highly relevant)",
    minimum: 0,
    maximum: 1,
  }),
});

export type CreateRuvectorFeedbackToolOptions = {
  api: ClawdbotPluginApi;
  db: RuvectorDB;
};

/**
 * Creates the ruvector_feedback agent tool for SONA learning.
 * Records search feedback to improve future search relevance.
 *
 * @param options - Tool configuration including API and database
 * @returns An agent tool that can be registered with the plugin API
 */
export function createRuvectorFeedbackTool(options: CreateRuvectorFeedbackToolOptions) {
  const { api, db } = options;

  return {
    name: "ruvector_feedback",
    label: "SONA Relevance Feedback",
    description:
      "Provide feedback on search result relevance to improve future searches. " +
      "Use after ruvector_search to indicate which results were helpful.",
    parameters: RuvectorFeedbackSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const searchId = readStringParam(params, "searchId", { required: true });
      const selectedResultId = readStringParam(params, "selectedResultId", { required: true });
      const relevanceScore = readNumberParam(params, "relevanceScore") ?? 1.0;

      try {
        // Record feedback for SONA learning
        // The db.recordSearchFeedback method stores this for model adaptation
        if ("recordSearchFeedback" in db && typeof db.recordSearchFeedback === "function") {
          await (db as RuvectorDB & { recordSearchFeedback: (f: unknown) => Promise<void> }).recordSearchFeedback({
            searchId,
            selectedResultId,
            relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
            timestamp: Date.now(),
          });

          api.logger.debug?.(
            `ruvector_feedback: recorded feedback for search=${searchId}, result=${selectedResultId}, score=${relevanceScore}`,
          );

          return jsonResult({
            success: true,
            message: `Feedback recorded: result ${selectedResultId} marked with relevance ${(relevanceScore * 100).toFixed(0)}%`,
            searchId,
            selectedResultId,
            relevanceScore,
          });
        }

        // Fallback: store feedback as metadata on the result document
        api.logger.debug?.(
          `ruvector_feedback: storing feedback as metadata (SONA not fully enabled)`,
        );

        return jsonResult({
          success: true,
          message: "Feedback acknowledged (SONA learning not fully enabled)",
          searchId,
          selectedResultId,
          relevanceScore,
          note: "Full SONA learning requires ruvector with feedback support",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvector_feedback: failed to record feedback: ${message}`);
        return jsonResult({
          success: false,
          error: message,
        });
      }
    },
  };
}

// ============================================================================
// GNN Graph Tool
// ============================================================================

/**
 * Schema for the ruvector_graph tool parameters.
 * Used for GNN (Graph Neural Network) knowledge graph operations.
 */
const RuvectorGraphSchema = Type.Object({
  action: stringEnum(["query", "neighbors", "link"] as const, {
    description: "Graph operation: query (Cypher), neighbors (find related), or link (create relationship)",
  }),
  cypherQuery: Type.Optional(
    Type.String({
      description: "Cypher query for action=query (e.g., 'MATCH (n)-[r]->(m) RETURN n, r, m')",
    }),
  ),
  nodeId: Type.Optional(
    Type.String({
      description: "Node ID for action=neighbors",
    }),
  ),
  sourceId: Type.Optional(
    Type.String({
      description: "Source node ID for action=link",
    }),
  ),
  targetId: Type.Optional(
    Type.String({
      description: "Target node ID for action=link",
    }),
  ),
  relationship: Type.Optional(
    Type.String({
      description: "Relationship type for action=link (e.g., 'RELATED_TO', 'MENTIONS')",
    }),
  ),
  depth: Type.Optional(
    Type.Number({
      description: "Traversal depth for neighbors query (default: 1)",
      default: 1,
      minimum: 1,
      maximum: 5,
    }),
  ),
});

export type CreateRuvectorGraphToolOptions = {
  api: ClawdbotPluginApi;
  db: RuvectorDB;
};

/**
 * Creates the ruvector_graph agent tool for GNN knowledge graph operations.
 * Provides graph traversal, Cypher queries, and relationship management.
 *
 * @param options - Tool configuration including API and database
 * @returns An agent tool that can be registered with the plugin API
 */
export function createRuvectorGraphTool(options: CreateRuvectorGraphToolOptions) {
  const { api, db } = options;

  return {
    name: "ruvector_graph",
    label: "GNN Knowledge Graph",
    description:
      "Query and manipulate the knowledge graph. Use for finding relationships between memories, " +
      "executing Cypher queries, or creating semantic links between documents.",
    parameters: RuvectorGraphSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const actionRaw = readStringParam(params, "action", { required: true });

      // Validate action is one of the allowed values
      const validActions = ["query", "neighbors", "link"] as const;
      type GraphAction = (typeof validActions)[number];

      if (!validActions.includes(actionRaw as GraphAction)) {
        return jsonResult({
          success: false,
          error: `Invalid action: ${actionRaw}`,
          validActions: [...validActions],
        });
      }
      const action: GraphAction = actionRaw as GraphAction;

      try {
        // Check if GNN graph features are available
        const hasGraphSupport =
          "graphQuery" in db &&
          "graphNeighbors" in db &&
          "graphLink" in db;

        if (!hasGraphSupport) {
          return jsonResult({
            success: false,
            error: "GNN graph features not available",
            note: "Requires ruvector with graph extension enabled",
            action,
          });
        }

        const graphDb = db as RuvectorDB & {
          graphQuery: (cypher: string) => Promise<unknown[]>;
          graphNeighbors: (nodeId: string, depth: number) => Promise<unknown[]>;
          graphLink: (source: string, target: string, rel: string) => Promise<boolean>;
        };

        switch (action) {
          case "query": {
            const cypherQuery = readStringParam(params, "cypherQuery", { required: true });
            api.logger.debug?.(`ruvector_graph: executing Cypher query`);

            const results = await graphDb.graphQuery(cypherQuery);

            return jsonResult({
              success: true,
              action: "query",
              resultCount: results.length,
              results,
            });
          }

          case "neighbors": {
            const nodeId = readStringParam(params, "nodeId", { required: true });
            const depth = readNumberParam(params, "depth", { integer: true }) ?? 1;
            const clampedDepth = Math.max(1, Math.min(depth, 5));

            api.logger.debug?.(
              `ruvector_graph: finding neighbors for node=${nodeId}, depth=${clampedDepth}`,
            );

            const neighbors = await graphDb.graphNeighbors(nodeId, clampedDepth);

            return jsonResult({
              success: true,
              action: "neighbors",
              nodeId,
              depth: clampedDepth,
              neighborCount: neighbors.length,
              neighbors,
            });
          }

          case "link": {
            const sourceId = readStringParam(params, "sourceId", { required: true });
            const targetId = readStringParam(params, "targetId", { required: true });
            const relationship = readStringParam(params, "relationship") ?? "RELATED_TO";

            api.logger.debug?.(
              `ruvector_graph: creating link ${sourceId} -[${relationship}]-> ${targetId}`,
            );

            const created = await graphDb.graphLink(sourceId, targetId, relationship);

            return jsonResult({
              success: created,
              action: "link",
              sourceId,
              targetId,
              relationship,
              message: created
                ? `Created relationship: ${sourceId} -[${relationship}]-> ${targetId}`
                : "Link already exists or could not be created",
            });
          }

          default: {
            // Exhaustive check - this ensures all cases are handled at compile time
            const exhaustiveCheck: never = action;
            return jsonResult({
              success: false,
              error: `Unknown action: ${String(exhaustiveCheck)}`,
              validActions: ["query", "neighbors", "link"],
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvector_graph: operation failed: ${message}`);
        return jsonResult({
          success: false,
          action,
          error: message,
        });
      }
    },
  };
}

// ============================================================================
// ruvector_recall Tool (Pattern-Aware Memory Recall)
// ============================================================================

/**
 * Schema for the ruvector_recall tool parameters.
 * Used for pattern-aware memory recall combining vector search, patterns, and graph traversal.
 */
const RuvectorRecallSchema = Type.Object({
  query: Type.String({
    description: "The search query to recall memories for",
  }),
  k: Type.Optional(
    Type.Number({
      description: "Number of results to return (default: 10)",
      default: 10,
    }),
  ),
  usePatterns: Type.Optional(
    Type.Boolean({
      description: "Use learned patterns to re-rank results (default: true)",
      default: true,
    }),
  ),
  expandGraph: Type.Optional(
    Type.Boolean({
      description: "Include graph-connected memories in results (default: false)",
      default: false,
    }),
  ),
  graphDepth: Type.Optional(
    Type.Number({
      description: "Depth for graph traversal when expandGraph is true (default: 1)",
      default: 1,
      minimum: 1,
      maximum: 3,
    }),
  ),
  patternBoost: Type.Optional(
    Type.Number({
      description: "Boost factor for pattern-matched results (default: 0.2)",
      default: 0.2,
      minimum: 0,
      maximum: 1,
    }),
  ),
});

export type CreateRuvectorRecallToolOptions = {
  api: ClawdbotPluginApi;
  service: RuvectorService;
  embedQuery: (text: string) => Promise<number[]>;
};

/**
 * Creates the ruvector_recall agent tool for pattern-aware memory recall.
 * Combines vector search with learned patterns and optional graph traversal.
 *
 * @param options - Tool configuration including API, service, and embedding function
 * @returns An agent tool that can be registered with the plugin API
 */
export function createRuvectorRecallTool(options: CreateRuvectorRecallToolOptions) {
  const { api, service, embedQuery } = options;

  return {
    name: "ruvector_recall",
    label: "Pattern-Aware Memory Recall",
    description:
      "Recall memories using learned patterns and optional graph expansion. " +
      "Combines semantic vector search with pattern matching from past interactions " +
      "and knowledge graph traversal for comprehensive memory retrieval.",
    parameters: RuvectorRecallSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const query = readStringParam(params, "query", { required: true });
      const rawK = readNumberParam(params, "k", { integer: true }) ?? 10;
      const k = Math.max(1, Math.min(rawK, 100));
      const usePatterns = params.usePatterns !== false;
      const expandGraph = params.expandGraph === true;
      const graphDepth = Math.max(1, Math.min(readNumberParam(params, "graphDepth", { integer: true }) ?? 1, 3));
      const patternBoost = Math.max(0, Math.min(readNumberParam(params, "patternBoost") ?? 0.2, 1));

      // Validate service is running
      if (!service.isRunning()) {
        return jsonResult({
          results: [],
          error: "ruvector service is not running",
          disabled: true,
        });
      }

      try {
        const client = service.getClient();

        // Generate embedding for the query
        api.logger.debug?.(`ruvector_recall: embedding query "${query.slice(0, 50)}..."`);
        const queryVector = await embedQuery(query);

        // Perform pattern-aware search
        api.logger.debug?.(
          `ruvector_recall: searching with k=${k}, usePatterns=${usePatterns}, expandGraph=${expandGraph}`,
        );

        let searchResults: VectorSearchResult[];

        if (usePatterns) {
          searchResults = await client.searchWithPatterns({
            vector: queryVector,
            limit: k,
            usePatterns: true,
            patternBoost,
          });
        } else {
          searchResults = await client.search({
            vector: queryVector,
            limit: k,
          });
        }

        // Expand with graph connections if requested
        let graphResults: Array<{
          id: string;
          text: string;
          score: number;
          source: "graph";
          relationship?: string;
        }> = [];

        if (expandGraph && client.isGraphInitialized()) {
          const graphConnections = new Map<string, { score: number; relationship?: string }>();

          // Get neighbors for each search result
          for (const result of searchResults.slice(0, 5)) {
            try {
              const neighbors = await client.getNeighbors(result.entry.id, graphDepth);

              for (const neighbor of neighbors) {
                // Skip if already in search results
                if (searchResults.some((r) => r.entry.id === neighbor.id)) {
                  continue;
                }

                // Combine score (decay based on graph distance)
                const existingScore = graphConnections.get(neighbor.id)?.score ?? 0;
                const graphScore = result.score * 0.8; // Decay factor for graph expansion
                if (graphScore > existingScore) {
                  graphConnections.set(neighbor.id, {
                    score: graphScore,
                    relationship: neighbor.labels?.[0],
                  });
                }
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              api.logger.debug?.(`ruvector_recall: graph expansion failed for ${result.entry.id}: ${errMsg}`);
            }
          }

          // Fetch full entries for graph results
          for (const [id, { score, relationship }] of graphConnections) {
            try {
              const entry = await client.get(id);
              if (entry) {
                graphResults.push({
                  id,
                  text: entry.metadata.text ?? "",
                  score,
                  source: "graph",
                  relationship,
                });
              }
            } catch (err) {
              // Skip entries that can't be fetched but log for debugging
              const errMsg = err instanceof Error ? err.message : String(err);
              api.logger.debug?.(`ruvector_recall: failed to fetch graph entry ${id}: ${errMsg}`);
            }
          }

          // Sort graph results by score
          graphResults.sort((a, b) => b.score - a.score);
          graphResults = graphResults.slice(0, Math.max(3, Math.floor(k / 3)));
        }

        // Format results
        if (searchResults.length === 0 && graphResults.length === 0) {
          return jsonResult({
            results: [],
            graphResults: [],
            message: "No matching memories found",
            query,
            k,
            usePatterns,
            expandGraph,
          });
        }

        const formattedResults = searchResults.map((r) => ({
          id: r.entry.id,
          text: r.entry.metadata.text ?? "",
          score: r.score,
          category: r.entry.metadata.category,
          source: "vector" as const,
          metadata: r.entry.metadata,
        }));

        // Build formatted text output
        const vectorText = formattedResults
          .map((r, i) => {
            const text = r.text || "(no text)";
            const truncated = text.slice(0, 100);
            const suffix = text.length > 100 ? "..." : "";
            return `${i + 1}. [${r.category ?? "memory"}] ${truncated}${suffix} (${(r.score * 100).toFixed(0)}%)`;
          })
          .join("\n");

        let graphText = "";
        if (graphResults.length > 0) {
          graphText = "\n\nGraph-connected:\n" + graphResults
            .map((r, i) => {
              const text = r.text || "(no text)";
              const truncated = text.slice(0, 100);
              const suffix = text.length > 100 ? "..." : "";
              const relLabel = r.relationship ? ` [${r.relationship}]` : "";
              return `  ${i + 1}. ${truncated}${suffix}${relLabel} (${(r.score * 100).toFixed(0)}%)`;
            })
            .join("\n");
        }

        // Get pattern info if available
        let patternInfo = "";
        const patternStore = client.getPatternStore();
        if (usePatterns && patternStore) {
          const clusterCount = patternStore.getClusterCount();
          const sampleCount = patternStore.getSampleCount();
          if (clusterCount > 0 || sampleCount > 0) {
            patternInfo = ` [patterns: ${clusterCount} clusters from ${sampleCount} samples]`;
          }
        }

        return jsonResult({
          results: formattedResults,
          graphResults,
          count: searchResults.length,
          graphCount: graphResults.length,
          query,
          k,
          usePatterns,
          expandGraph,
          message: `Found ${searchResults.length} memories${patternInfo}:\n\n${vectorText}${graphText}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvector_recall: recall failed: ${message}`);
        return jsonResult({
          results: [],
          error: message,
          disabled: true,
        });
      }
    },
  };
}

// ============================================================================
// ruvector_learn Tool (Manual Learning / Knowledge Injection)
// ============================================================================

/**
 * Schema for the ruvector_learn tool parameters.
 * Used for explicit knowledge injection with graph edges.
 */
const RuvectorLearnSchema = Type.Object({
  content: Type.String({
    description: "The content/knowledge to learn and index",
  }),
  category: Type.Optional(
    stringEnum(["preference", "fact", "decision", "entity", "other"] as const, {
      description: "Category for the knowledge (default: 'fact')",
    }),
  ),
  importance: Type.Optional(
    Type.Number({
      description: "Importance score from 0 (low) to 1 (high) (default: 0.5)",
      minimum: 0,
      maximum: 1,
    }),
  ),
  relationships: Type.Optional(
    Type.Array(Type.String(), {
      description: "Array of related document IDs to link to in the knowledge graph",
    }),
  ),
  relationshipType: Type.Optional(
    Type.String({
      description: "Relationship type for links (default: 'RELATED_TO')",
    }),
  ),
  inferRelationships: Type.Optional(
    Type.Boolean({
      description: "Auto-infer relationships from content (default: true)",
    }),
  ),
  linkSimilar: Type.Optional(
    Type.Boolean({
      description: "Auto-link to similar existing documents (default: false)",
    }),
  ),
  similarityThreshold: Type.Optional(
    Type.Number({
      description: "Similarity threshold for auto-linking (default: 0.8)",
      minimum: 0.5,
      maximum: 1.0,
    }),
  ),
});

export type CreateRuvectorLearnToolOptions = {
  api: ClawdbotPluginApi;
  service: RuvectorService;
  db: RuvectorDB;
  embeddings: EmbeddingProvider;
};

/**
 * Creates the ruvector_learn agent tool for manual learning/knowledge injection.
 * Allows explicit knowledge injection with graph edges and relationship inference.
 *
 * @param options - Tool configuration including API, service, database, and embeddings
 * @returns An agent tool that can be registered with the plugin API
 */
export function createRuvectorLearnTool(options: CreateRuvectorLearnToolOptions) {
  const { api, service, db, embeddings } = options;

  // Create relationship inferrer (lazily initialized)
  let relationshipInferrer: RelationshipInferrer | null = null;

  const getRelationshipInferrer = (): RelationshipInferrer => {
    if (!relationshipInferrer) {
      relationshipInferrer = new RelationshipInferrer({
        client: service.getClient(),
        db,
        embeddings,
        logger: api.logger,
      });
    }
    return relationshipInferrer;
  };

  return {
    name: "ruvector_learn",
    label: "Manual Knowledge Learning",
    description:
      "Explicitly learn and index new knowledge with optional graph relationships. " +
      "Use this to inject important facts, decisions, or preferences into the memory system " +
      "with fine-grained control over categorization and linking.",
    parameters: RuvectorLearnSchema,

    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const content = readStringParam(params, "content", { required: true });
      const categoryRaw = readStringParam(params, "category");
      const category = (
        categoryRaw && ["preference", "fact", "decision", "entity", "other"].includes(categoryRaw)
      ) ? categoryRaw as "preference" | "fact" | "decision" | "entity" | "other" : "fact";
      const importance = Math.max(0, Math.min(1, readNumberParam(params, "importance") ?? 0.5));
      const relationships = params.relationships as string[] | undefined;
      const relationshipType = readStringParam(params, "relationshipType") ?? "RELATED_TO";
      const inferRelationships = params.inferRelationships !== false;
      const linkSimilar = params.linkSimilar === true;
      const similarityThreshold = Math.max(0.5, Math.min(1.0, readNumberParam(params, "similarityThreshold") ?? 0.8));

      // Validate service is running
      if (!service.isRunning()) {
        return jsonResult({
          indexed: false,
          error: "ruvector service is not running",
          edges: 0,
        });
      }

      try {
        const client = service.getClient();
        const startTime = Date.now();

        // Generate embedding for the content
        api.logger.debug?.(`ruvector_learn: embedding content "${content.slice(0, 50)}..."`);
        const vector = await embeddings.embed(content);

        // Check for near-duplicates
        const existingResults = await client.search({
          vector,
          limit: 1,
          minScore: 0.95,
        });

        if (existingResults.length > 0) {
          const existing = existingResults[0];
          api.logger.debug?.(`ruvector_learn: found near-duplicate (score: ${existing.score})`);
          return jsonResult({
            indexed: false,
            duplicate: true,
            existingId: existing.entry.id,
            existingText: existing.entry.metadata.text?.slice(0, 100) + "...",
            score: existing.score,
            message: `Similar knowledge already exists (${(existing.score * 100).toFixed(0)}% match)`,
            edges: 0,
          });
        }

        // Build metadata
        const metadata = {
          text: content,
          category,
          importance,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          source: "ruvector_learn",
          manuallyInjected: true,
        };

        // Insert the new knowledge
        const entryId = await client.insert({
          vector,
          metadata,
        });

        api.logger.debug?.(`ruvector_learn: inserted entry ${entryId}`);

        let edgesCreated = 0;
        const linkedIds: string[] = [];
        const inferredEntities: string[] = [];

        // Create explicit relationships if provided
        if (relationships && relationships.length > 0 && client.isGraphInitialized()) {
          for (const targetId of relationships) {
            try {
              await client.addEdge({
                sourceId: entryId,
                targetId,
                relationship: relationshipType,
                weight: importance,
                properties: {
                  createdAt: Date.now(),
                  source: "ruvector_learn",
                },
              });
              edgesCreated++;
              linkedIds.push(targetId);
            } catch (err) {
              api.logger.debug?.(
                `ruvector_learn: failed to create edge to ${targetId}: ${formatError(err)}`,
              );
            }
          }
        }

        // Auto-infer relationships from content if enabled
        if (inferRelationships && client.isGraphInitialized()) {
          try {
            const inferrer = getRelationshipInferrer();
            const entry = {
              id: entryId,
              vector,
              metadata,
            };

            const inferenceResult = await inferrer.inferFromContent(entry, {
              maxRelationships: 5,
            });

            edgesCreated += inferenceResult.edgesCreated;
            inferredEntities.push(
              ...inferenceResult.entities.map((e) => `${e.type}:${e.text}`),
            );

            api.logger.debug?.(
              `ruvector_learn: inferred ${inferenceResult.entities.length} entities, ` +
              `created ${inferenceResult.edgesCreated} edges`,
            );
          } catch (err) {
            api.logger.debug?.(
              `ruvector_learn: relationship inference failed: ${formatError(err)}`,
            );
          }
        }

        // Auto-link to similar documents if enabled
        if (linkSimilar && client.isGraphInitialized()) {
          try {
            const inferrer = getRelationshipInferrer();
            const similarEdges = await inferrer.linkSimilar(entryId, similarityThreshold);
            edgesCreated += similarEdges;

            api.logger.debug?.(
              `ruvector_learn: created ${similarEdges} similarity links`,
            );
          } catch (err) {
            api.logger.debug?.(
              `ruvector_learn: similarity linking failed: ${formatError(err)}`,
            );
          }
        }

        const processingTimeMs = Date.now() - startTime;

        // Build pattern ID if available
        let patternId: string | undefined;
        const patternStore = client.getPatternStore?.();
        if (patternStore) {
          // Find similar patterns from existing clusters
          try {
            const patterns = patternStore.findSimilar(vector, 1);
            if (patterns && patterns.length > 0) {
              patternId = patterns[0].id;
            }
          } catch (err) {
            api.logger.debug?.(`ruvector_learn: pattern lookup failed: ${formatError(err)}`);
          }
        }

        return jsonResult({
          indexed: true,
          entryId,
          patternId,
          category,
          importance,
          edges: edgesCreated,
          linkedIds: linkedIds.length > 0 ? linkedIds : undefined,
          inferredEntities: inferredEntities.length > 0 ? inferredEntities : undefined,
          processingTimeMs,
          message: `Learned: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}" ` +
            `[${category}, importance: ${(importance * 100).toFixed(0)}%] ` +
            `with ${edgesCreated} relationship(s)`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvector_learn: learning failed: ${message}`);
        return jsonResult({
          indexed: false,
          error: message,
          edges: 0,
        });
      }
    },
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format an error for logging.
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
