/**
 * Clawdbot Memory (Ruvector) Plugin
 *
 * Long-term memory with vector search using ruvector as the backend.
 * Provides lifecycle management for the ruvector connection and automatic
 * message indexing via hooks.
 *
 * Supports two modes:
 * 1. Remote service (url-based) - connects to external ruvector server
 * 2. Local database (dbPath-based) - uses local ruvector storage with hooks
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

import { RuvectorService } from "./service.js";
import {
  createRuvectorSearchTool,
  createRuvectorFeedbackTool,
  createRuvectorGraphTool,
  createRuvectorRecallTool,
  createRuvectorLearnTool,
} from "./tool.js";
import { ruvectorConfigSchema, type RuvectorConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { createEmbeddingProvider } from "./embeddings.js";
import { registerHooks } from "./hooks.js";
import type { MessageBatcher } from "./hooks.js";
import { PatternStore } from "./sona/patterns.js";
import { ContextInjector, registerContextInjectionHook } from "./context-injection.js";
import { TrajectoryRecorder } from "./sona/trajectory.js";

// ============================================================================
// Config Parsing
// ============================================================================

/**
 * Remote service config (URL-based connection to external ruvector server).
 */
type RemoteServiceConfig = {
  url: string;
  apiKey?: string;
  collection: string;
  timeoutMs: number;
};

type ParsedConfig =
  | { mode: "remote"; remote: RemoteServiceConfig }
  | { mode: "local"; local: RuvectorConfig };

/**
 * Resolve environment variable references in config values.
 * Supports ${VAR_NAME} syntax.
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`ruvector: environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

/**
 * Parse and validate plugin configuration for ruvector.
 * Supports both remote (URL-based) and local (dbPath-based) modes.
 */
function parseConfig(pluginConfig: Record<string, unknown> | undefined): ParsedConfig {
  if (!pluginConfig || typeof pluginConfig !== "object") {
    throw new Error("ruvector: plugin config required");
  }

  // Detect mode based on config keys
  const hasUrl = typeof pluginConfig.url === "string" && pluginConfig.url.trim();
  const hasEmbedding = pluginConfig.embedding && typeof pluginConfig.embedding === "object";

  // Reject ambiguous config with both url and embedding
  if (hasUrl && hasEmbedding) {
    throw new Error(
      "ruvector: invalid config - cannot specify both 'url' (remote mode) and 'embedding' (local mode). Choose one.",
    );
  }

  // Remote mode: URL-based connection to external ruvector server
  if (hasUrl) {
    const url = pluginConfig.url as string;
    const apiKey = typeof pluginConfig.apiKey === "string"
      ? resolveEnvVars(pluginConfig.apiKey)
      : undefined;
    const collection = typeof pluginConfig.collection === "string"
      ? pluginConfig.collection
      : "clawdbot-memory";
    const timeoutMs = typeof pluginConfig.timeoutMs === "number"
      ? pluginConfig.timeoutMs
      : 5000;

    return {
      mode: "remote",
      remote: {
        url: url.trim(),
        apiKey,
        collection,
        timeoutMs,
      },
    };
  }

  // Local mode: local database with embeddings and hooks
  if (hasEmbedding) {
    let local: RuvectorConfig;
    try {
      local = ruvectorConfigSchema.parse(pluginConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: invalid local mode config: ${message}`);
    }
    return {
      mode: "local",
      local,
    };
  }

  throw new Error(
    "ruvector: invalid config - provide either 'url' for remote mode or 'embedding' for local mode",
  );
}

// ============================================================================
// Plugin Registration
// ============================================================================

/**
 * Register the ruvector memory plugin.
 * Sets up the service for lifecycle management and registers hooks for
 * automatic message indexing.
 */
export default function register(api: ClawdbotPluginApi): void {
  const parsed = parseConfig(api.pluginConfig);

  if (parsed.mode === "remote") {
    registerRemoteMode(api, parsed.remote);
  } else {
    registerLocalMode(api, parsed.local);
  }
}

/**
 * Register remote mode - connects to external ruvector server.
 *
 * Note: Remote mode is a legacy configuration pattern. For full feature support
 * including automatic message indexing via hooks, use local mode with 'embedding' config.
 */
function registerRemoteMode(api: ClawdbotPluginApi, config: RemoteServiceConfig): void {
  // Pass remote config to service - it handles the RuvectorServiceConfig type
  const service = new RuvectorService(
    {
      url: config.url,
      apiKey: config.apiKey,
      collection: config.collection,
      timeoutMs: config.timeoutMs,
    },
    api.logger,
  );

  api.logger.info(
    `memory-ruvector: plugin registered in remote mode (url: ${config.url}, collection: ${config.collection})`,
  );
  api.logger.warn(
    "memory-ruvector: remote mode does not support automatic message indexing hooks. " +
    "Use local mode with 'embedding' config for full hook support.",
  );

  // Create embedding function (placeholder for remote mode)
  const embedQuery = async (_text: string): Promise<number[]> => {
    api.logger.debug?.(`memory-ruvector: generating embedding for query`);
    // Placeholder: return dummy 1536-dim vector (OpenAI text-embedding-3-small)
    // Remote mode expects the server to handle embeddings
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  };

  // Register the ruvector_search tool
  api.registerTool(
    createRuvectorSearchTool({
      api,
      service,
      embedQuery,
    }),
    { name: "ruvector_search", optional: true },
  );

  // Register the ruvector_recall tool (pattern-aware memory recall)
  api.registerTool(
    createRuvectorRecallTool({
      api,
      service,
      embedQuery,
    }),
    { name: "ruvector_recall", optional: true },
  );

  // Register the service for lifecycle management
  api.registerService({
    id: "memory-ruvector",

    async start(_ctx) {
      await service.start();
      // Initialize pattern store for learning
      const client = service.getClient();
      client.initializePatternStore();
      api.logger.info(
        `memory-ruvector: service started (url: ${config.url}, collection: ${config.collection})`,
      );
    },

    async stop(_ctx) {
      await service.stop();
      api.logger.info("memory-ruvector: service stopped");
    },
  });
}

/**
 * Register local mode - local database with embeddings and automatic indexing hooks.
 */
function registerLocalMode(api: ClawdbotPluginApi, config: RuvectorConfig): void {
  const resolvedDbPath = api.resolvePath(config.dbPath);
  const db = createDatabase({ ...config, dbPath: resolvedDbPath });
  const embeddings = createEmbeddingProvider(config.embedding, config.dimension);

  api.logger.info(
    `memory-ruvector: plugin registered in local mode (db: ${resolvedDbPath}, dim: ${config.dimension})`,
  );

  // Track batcher for cleanup
  let batcher: MessageBatcher | null = null;

  // =========================================================================
  // Register Hooks for Automatic Message Indexing
  // =========================================================================

  const hookResult = registerHooks(api, db, embeddings, config.hooks);
  batcher = hookResult.batcher;

  // =========================================================================
  // ruvLLM Integration (Context Injection + Trajectory Recording)
  // =========================================================================

  let contextInjector: ContextInjector | null = null;
  let trajectoryRecorder: TrajectoryRecorder | null = null;

  if (config.ruvllm?.enabled) {
    api.logger.info("memory-ruvector: ruvLLM features enabled");

    // Initialize context injector if enabled
    if (config.ruvllm.contextInjection.enabled) {
      contextInjector = new ContextInjector(config.ruvllm.contextInjection, {
        db,
        embeddings,
        logger: api.logger,
      });
      registerContextInjectionHook(api, contextInjector);
      api.logger.info(
        `memory-ruvector: context injection enabled (maxTokens: ${config.ruvllm.contextInjection.maxTokens}, threshold: ${config.ruvllm.contextInjection.relevanceThreshold})`,
      );
    }

    // Initialize trajectory recorder if enabled
    if (config.ruvllm.trajectoryRecording.enabled) {
      trajectoryRecorder = new TrajectoryRecorder(
        config.ruvllm.trajectoryRecording,
        api.logger,
      );
      api.logger.info(
        `memory-ruvector: trajectory recording enabled (max: ${config.ruvllm.trajectoryRecording.maxTrajectories})`,
      );
    }
  }

  // =========================================================================
  // Register Tools
  // =========================================================================

  // Search tool
  api.registerTool(
    {
      name: "ruvector_search",
      label: "Vector Memory Search",
      description:
        "Search through indexed conversation history using semantic similarity. Use to recall past conversations, find relevant context, or understand user patterns.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query text" },
          limit: { type: "number", description: "Max results (default: 5)" },
          direction: {
            type: "string",
            enum: ["inbound", "outbound"],
            description: "Filter by message direction",
          },
          channel: { type: "string", description: "Filter by channel ID" },
          sessionKey: { type: "string", description: "Filter by session key" },
        },
        required: ["query"],
      },
      async execute(_toolCallId, params) {
        const {
          query,
          limit = 5,
          direction,
          channel,
          sessionKey,
        } = params as {
          query: string;
          limit?: number;
          direction?: "inbound" | "outbound";
          channel?: string;
          sessionKey?: string;
        };

        try {
          const vector = await embeddings.embed(query);
          const results = await db.search(vector, {
            limit,
            minScore: 0.1,
            filter: { direction, channel, sessionKey },
          });

          // Record trajectory for ruvLLM learning
          let trajectoryId = "";
          if (trajectoryRecorder?.isEnabled()) {
            trajectoryId = trajectoryRecorder.record({
              query,
              queryVector: vector,
              resultIds: results.map((r) => r.document.id),
              resultScores: results.map((r) => r.score),
              sessionId: sessionKey,
            });
          }

          if (results.length === 0) {
            return {
              content: [{ type: "text", text: "No relevant messages found." }],
              details: { count: 0, trajectoryId: trajectoryId || undefined },
            };
          }

          const text = results
            .map(
              (r, i) =>
                `${i + 1}. [${r.document.direction}] ${r.document.content.slice(0, 200)}${
                  r.document.content.length > 200 ? "..." : ""
                } (${(r.score * 100).toFixed(0)}%)`,
            )
            .join("\n");

          const sanitizedResults = results.map((r) => ({
            id: r.document.id,
            content: r.document.content,
            direction: r.document.direction,
            channel: r.document.channel,
            user: r.document.user,
            timestamp: r.document.timestamp,
            score: r.score,
          }));

          return {
            content: [
              { type: "text", text: `Found ${results.length} messages:\n\n${text}` },
            ],
            details: {
              count: results.length,
              messages: sanitizedResults,
              trajectoryId: trajectoryId || undefined,
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          api.logger.warn(`ruvector_search: search failed: ${message}`);
          return {
            content: [{ type: "text", text: `Search failed: ${message}` }],
            details: { error: message },
          };
        }
      },
    },
    { name: "ruvector_search", optional: true },
  );

  // Index tool (manual indexing)
  api.registerTool(
    {
      name: "ruvector_index",
      label: "Index Message",
      description:
        "Manually index a message or piece of information for future retrieval.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Text content to index" },
          direction: {
            type: "string",
            enum: ["inbound", "outbound"],
            description: "Message direction (default: outbound)",
          },
          channel: { type: "string", description: "Channel identifier" },
        },
        required: ["content"],
      },
      async execute(_toolCallId, params, ctx) {
        const {
          content,
          direction = "outbound",
          channel = "manual",
        } = params as {
          content: string;
          direction?: "inbound" | "outbound";
          channel?: string;
        };

        try {
          const vector = await embeddings.embed(content);

          // Check for duplicates
          const existing = await db.search(vector, { limit: 1, minScore: 0.95 });
          if (existing.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Similar message already indexed: "${existing[0].document.content.slice(0, 100)}..."`,
                },
              ],
              details: { action: "duplicate", existingId: existing[0].document.id },
            };
          }

          const id = await db.insert({
            content,
            vector,
            direction,
            channel,
            sessionKey: ctx?.sessionKey,
            agentId: ctx?.agentId,
            timestamp: Date.now(),
          });

          return {
            content: [
              { type: "text", text: `Indexed: "${content.slice(0, 100)}..."` },
            ],
            details: { action: "created", id },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          api.logger.warn(`ruvector_index: indexing failed: ${message}`);
          return {
            content: [{ type: "text", text: `Indexing failed: ${message}` }],
            details: { error: message },
          };
        }
      },
    },
    { name: "ruvector_index", optional: true },
  );

  // SONA feedback tool
  api.registerTool(
    createRuvectorFeedbackTool({
      api,
      db,
    }),
    { name: "ruvector_feedback", optional: true },
  );

  // GNN graph tool
  api.registerTool(
    createRuvectorGraphTool({
      api,
      db,
    }),
    { name: "ruvector_graph", optional: true },
  );

  // =========================================================================
  // Pattern Store for ruvLLM Learning
  // =========================================================================

  const patternStore = new PatternStore({
    maxClusters: 10,
    minSamplesPerCluster: 3,
    qualityThreshold: config.sona?.qualityThreshold ?? 0.5,
  });

  // Pattern-aware recall tool (local mode)
  api.registerTool(
    {
      name: "ruvector_recall",
      label: "Pattern-Aware Memory Recall",
      description:
        "Recall memories using learned patterns and optional graph expansion. " +
        "Combines semantic vector search with pattern matching from past interactions " +
        "and knowledge graph traversal for comprehensive memory retrieval.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query text" },
          limit: { type: "number", description: "Max results (default: 10)" },
          usePatterns: {
            type: "boolean",
            description: "Use learned patterns to re-rank results (default: true)",
          },
          expandGraph: {
            type: "boolean",
            description: "Include graph-connected memories (default: false)",
          },
          graphDepth: {
            type: "number",
            description: "Depth for graph traversal (1-3, default: 1)",
          },
          patternBoost: {
            type: "number",
            description: "Boost factor for pattern matches (0-1, default: 0.2)",
          },
        },
        required: ["query"],
      },
      async execute(_toolCallId, params) {
        const {
          query,
          limit = 10,
          usePatterns = true,
          expandGraph = false,
          graphDepth = 1,
          patternBoost = 0.2,
        } = params as {
          query: string;
          limit?: number;
          usePatterns?: boolean;
          expandGraph?: boolean;
          graphDepth?: number;
          patternBoost?: number;
        };

        try {
          const queryVector = await embeddings.embed(query);
          let results = await db.search(queryVector, {
            limit,
            minScore: 0.1,
          });

          // Apply pattern re-ranking if enabled
          if (usePatterns && patternStore.getClusterCount() > 0) {
            results = rerankWithPatterns(results, queryVector, patternStore, patternBoost);
          }

          // Graph expansion
          let graphResults: Array<{
            id: string;
            content: string;
            score: number;
            source: "graph";
          }> = [];

          if (expandGraph) {
            const hasGraphSupport =
              "findRelated" in db &&
              typeof (db as Record<string, unknown>).findRelated === "function";

            if (hasGraphSupport) {
              const graphDb = db as typeof db & {
                findRelated: (id: string, rel?: string, depth?: number) => Promise<Array<{ document: { id: string; content: string }; score: number }>>;
              };

              // Get graph-connected results from top search hits
              for (const result of results.slice(0, 5)) {
                try {
                  const related = await graphDb.findRelated(
                    result.document.id ?? "",
                    undefined,
                    Math.max(1, Math.min(graphDepth, 3)),
                  );

                  for (const rel of related) {
                    // Skip if already in results
                    if (results.some((r) => r.document.id === rel.document.id)) continue;
                    if (graphResults.some((r) => r.id === rel.document.id)) continue;

                    graphResults.push({
                      id: rel.document.id ?? "",
                      content: rel.document.content,
                      score: rel.score * 0.8, // Decay for graph distance
                      source: "graph",
                    });
                  }
                } catch (err) {
                  // Skip graph expansion errors but log for debugging
                  const msg = err instanceof Error ? err.message : String(err);
                  api.logger.debug?.(`ruvector_recall: graph expansion failed: ${msg}`);
                }
              }

              graphResults.sort((a, b) => b.score - a.score);
              graphResults = graphResults.slice(0, Math.max(3, Math.floor(limit / 3)));
            }
          }

          if (results.length === 0 && graphResults.length === 0) {
            return {
              content: [{ type: "text", text: "No relevant memories found." }],
              details: { count: 0, graphCount: 0 },
            };
          }

          // Format output
          const vectorText = results
            .map(
              (r, i) =>
                `${i + 1}. [${r.document.direction}] ${r.document.content.slice(0, 200)}${
                  r.document.content.length > 200 ? "..." : ""
                } (${(r.score * 100).toFixed(0)}%)`,
            )
            .join("\n");

          let graphText = "";
          if (graphResults.length > 0) {
            graphText =
              "\n\nGraph-connected:\n" +
              graphResults
                .map(
                  (r, i) =>
                    `  ${i + 1}. ${r.content.slice(0, 150)}${
                      r.content.length > 150 ? "..." : ""
                    } (${(r.score * 100).toFixed(0)}%)`,
                )
                .join("\n");
          }

          // Pattern info
          let patternInfo = "";
          if (usePatterns) {
            const clusterCount = patternStore.getClusterCount();
            const sampleCount = patternStore.getSampleCount();
            if (clusterCount > 0 || sampleCount > 0) {
              patternInfo = ` [patterns: ${clusterCount} clusters from ${sampleCount} samples]`;
            }
          }

          const sanitizedResults = results.map((r) => ({
            id: r.document.id,
            content: r.document.content,
            direction: r.document.direction,
            channel: r.document.channel,
            user: r.document.user,
            timestamp: r.document.timestamp,
            score: r.score,
            source: "vector" as const,
          }));

          return {
            content: [
              {
                type: "text",
                text: `Found ${results.length} memories${patternInfo}:\n\n${vectorText}${graphText}`,
              },
            ],
            details: {
              count: results.length,
              graphCount: graphResults.length,
              messages: sanitizedResults,
              graphResults,
              usePatterns,
              expandGraph,
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          api.logger.warn(`ruvector_recall: recall failed: ${message}`);
          return {
            content: [{ type: "text", text: `Recall failed: ${message}` }],
            details: { error: message },
          };
        }
      },
    },
    { name: "ruvector_recall", optional: true },
  );

  // ruvector_learn tool (manual knowledge injection)
  api.registerTool(
    {
      name: "ruvector_learn",
      label: "Manual Knowledge Learning",
      description:
        "Explicitly learn and index new knowledge with optional graph relationships. " +
        "Use this to inject important facts, decisions, or preferences into the memory system.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content/knowledge to learn" },
          category: {
            type: "string",
            enum: ["preference", "fact", "decision", "entity", "other"],
            description: "Category for the knowledge (default: fact)",
          },
          importance: {
            type: "number",
            description: "Importance score from 0-1 (default: 0.5)",
          },
          relationships: {
            type: "array",
            items: { type: "string" },
            description: "Related document IDs to link to",
          },
        },
        required: ["content"],
      },
      async execute(_toolCallId, params, ctx) {
        const {
          content,
          category = "fact",
          importance = 0.5,
          relationships = [],
        } = params as {
          content: string;
          category?: string;
          importance?: number;
          relationships?: string[];
        };

        try {
          const vector = await embeddings.embed(content);

          // Check for duplicates
          const existing = await db.search(vector, { limit: 1, minScore: 0.95 });
          if (existing.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Similar knowledge already exists: "${existing[0].document.content.slice(0, 100)}..."`,
                },
              ],
              details: { indexed: false, duplicate: true, existingId: existing[0].document.id },
            };
          }

          const validCategories = ["preference", "fact", "decision", "entity", "other"];
          const validCategory = validCategories.includes(category) ? category : "fact";
          const clampedImportance = Math.max(0, Math.min(1, importance));

          const id = await db.insert({
            content,
            vector,
            direction: "outbound",
            channel: "ruvector_learn",
            sessionKey: ctx?.sessionKey,
            agentId: ctx?.agentId,
            timestamp: Date.now(),
            category: validCategory,
            importance: clampedImportance,
          });

          // Create graph edges if relationships provided
          let edgesCreated = 0;
          const hasGraphSupport =
            "linkMessages" in db &&
            typeof (db as Record<string, unknown>).linkMessages === "function";

          if (hasGraphSupport && relationships.length > 0) {
            const graphDb = db as typeof db & {
              linkMessages: (source: string, target: string, rel: string) => Promise<boolean>;
            };
            for (const targetId of relationships) {
              try {
                const created = await graphDb.linkMessages(id, targetId, "RELATED_TO");
                if (created) edgesCreated++;
              } catch (err) {
                // Skip failed edges but log for debugging
                const msg = err instanceof Error ? err.message : String(err);
                api.logger.debug?.(`ruvector_learn: failed to create edge to ${targetId}: ${msg}`);
              }
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `Learned: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}" [${validCategory}] with ${edgesCreated} relationship(s)`,
              },
            ],
            details: { indexed: true, id, category: validCategory, importance: clampedImportance, edges: edgesCreated },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          api.logger.warn(`ruvector_learn: learning failed: ${message}`);
          return {
            content: [{ type: "text", text: `Learning failed: ${message}` }],
            details: { indexed: false, error: message },
          };
        }
      },
    },
    { name: "ruvector_learn", optional: true },
  );

  // =========================================================================
  // Register CLI Commands
  // =========================================================================

  api.registerCli(
    ({ program }) => {
      const rv = program
        .command("ruvector")
        .description("ruvector memory plugin commands");

      rv.command("stats")
        .description("Show memory statistics")
        .action(async () => {
          const count = await db.count();
          console.log(`Total indexed messages: ${count}`);
          console.log(`Database path: ${resolvedDbPath}`);
          console.log(`Vector dimension: ${config.dimension}`);
          console.log(`Distance metric: ${config.metric}`);
          console.log(`Hooks enabled: ${config.hooks.enabled}`);
        });

      rv.command("search")
        .description("Search indexed messages")
        .argument("<query>", "Search query")
        .option("--limit <n>", "Max results", "5")
        .option("--direction <dir>", "Filter by direction (inbound/outbound)")
        .option("--channel <ch>", "Filter by channel")
        .action(async (query, opts) => {
          const parsedLimit = parseInt(opts.limit, 10);
          const limit = Number.isNaN(parsedLimit) ? 5 : Math.max(1, Math.min(parsedLimit, 100));
          const vector = await embeddings.embed(query);
          const results = await db.search(vector, {
            limit,
            minScore: 0.1,
            filter: {
              direction: opts.direction,
              channel: opts.channel,
            },
          });

          const output = results.map((r) => ({
            id: r.document.id,
            content: r.document.content,
            direction: r.document.direction,
            channel: r.document.channel,
            timestamp: new Date(r.document.timestamp).toISOString(),
            score: r.score.toFixed(3),
          }));
          console.log(JSON.stringify(output, null, 2));
        });

      rv.command("flush")
        .description("Force flush pending batch")
        .action(async () => {
          if (batcher !== null) {
            await batcher.forceFlush();
            api.logger.info?.("Batch flushed.");
          } else {
            api.logger.info?.("No active batcher (hooks may be disabled).");
          }
        });

      // SONA learning statistics
      rv.command("sona-stats")
        .description("Show SONA learning statistics")
        .action(async () => {
          const hasSONASupport = "getSONAStats" in db && typeof (db as Record<string, unknown>).getSONAStats === "function";

          if (hasSONASupport) {
            const sonaDb = db as typeof db & { getSONAStats: () => Promise<{
              totalFeedbackEntries: number;
              averageRelevanceScore: number;
              learningIterations: number;
              lastTrainingTime: number | null;
              modelVersion: string;
            }> };
            const stats = await sonaDb.getSONAStats();
            console.log("SONA Learning Statistics:");
            console.log(`  Total feedback entries: ${stats.totalFeedbackEntries}`);
            console.log(`  Average relevance score: ${(stats.averageRelevanceScore * 100).toFixed(1)}%`);
            console.log(`  Learning iterations: ${stats.learningIterations}`);
            console.log(`  Last training: ${stats.lastTrainingTime ? new Date(stats.lastTrainingTime).toISOString() : "Never"}`);
            console.log(`  Model version: ${stats.modelVersion}`);
          } else {
            const count = await db.count();
            console.log("SONA Learning Statistics (limited - full SONA not enabled):");
            console.log(`  Total indexed documents: ${count}`);
            console.log(`  Feedback collection: Not available`);
            console.log(`  Note: Enable ruvector with SONA extension for full learning statistics`);
          }
        });

      // GNN graph query
      rv.command("graph")
        .description("Execute a Cypher query on the knowledge graph")
        .argument("<query>", "Cypher query to execute")
        .action(async (query) => {
          const hasGraphSupport = "graphQuery" in db && typeof (db as Record<string, unknown>).graphQuery === "function";

          if (!hasGraphSupport) {
            console.log("GNN graph features not available.");
            console.log("Requires ruvector with graph extension enabled.");
            return;
          }

          const graphDb = db as typeof db & { graphQuery: (cypher: string) => Promise<unknown[]> };
          const results = await graphDb.graphQuery(query);

          if (results.length === 0) {
            console.log("No results found.");
          } else {
            console.log(JSON.stringify(results, null, 2));
          }
        });

      // GNN neighbors lookup
      rv.command("neighbors")
        .description("Show related nodes for a given document ID")
        .argument("<id>", "Document/node ID to find neighbors for")
        .option("--depth <n>", "Traversal depth (1-5)", "1")
        .action(async (id, opts) => {
          const hasGraphSupport = "graphNeighbors" in db && typeof (db as Record<string, unknown>).graphNeighbors === "function";

          if (!hasGraphSupport) {
            console.log("GNN graph features not available.");
            console.log("Requires ruvector with graph extension enabled.");
            return;
          }

          const parsedDepth = parseInt(opts.depth, 10);
          const depth = Number.isNaN(parsedDepth) ? 1 : Math.max(1, Math.min(parsedDepth, 5));
          const graphDb = db as typeof db & { graphNeighbors: (nodeId: string, depth: number) => Promise<unknown[]> };
          const neighbors = await graphDb.graphNeighbors(id, depth);

          if (neighbors.length === 0) {
            console.log(`No neighbors found for node ${id} at depth ${depth}.`);
          } else {
            console.log(`Found ${neighbors.length} neighbor(s) at depth ${depth}:`);
            console.log(JSON.stringify(neighbors, null, 2));
          }
        });

      // GNN link command
      rv.command("link")
        .description("Create a relationship between two messages")
        .argument("<sourceId>", "Source message ID")
        .argument("<targetId>", "Target message ID")
        .option("--relationship <rel>", "Relationship type", "RELATES_TO")
        .action(async (sourceId, targetId, opts) => {
          const hasGraphSupport = "linkMessages" in db && typeof (db as Record<string, unknown>).linkMessages === "function";

          if (!hasGraphSupport) {
            console.log("GNN graph features not available.");
            console.log("Requires ruvector with graph extension enabled.");
            return;
          }

          const relationship = opts.relationship || "RELATES_TO";
          const graphDb = db as typeof db & { linkMessages: (source: string, target: string, rel: string) => Promise<boolean> };

          try {
            const created = await graphDb.linkMessages(sourceId, targetId, relationship);
            if (created) {
              console.log(`Created link: ${sourceId} -[${relationship}]-> ${targetId}`);
            } else {
              console.log(`Link already exists or could not be created.`);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Failed to create link: ${message}`);
            process.exitCode = 1;
          }
        });

      // Pattern export command (P3 Advanced Features)
      rv.command("export-patterns")
        .description("Export learned patterns to a JSON file")
        .argument("<path>", "File path to export patterns to")
        .option("--compact", "Output compact JSON without indentation", false)
        .action(async (exportPath: string, opts: { compact?: boolean }) => {
          // Validate path
          if (!exportPath || typeof exportPath !== "string" || exportPath.trim() === "") {
            console.error("Error: path must be a non-empty string");
            process.exitCode = 1;
            return;
          }

          const clusterCount = patternStore.getClusterCount();
          const sampleCount = patternStore.getSampleCount();

          if (clusterCount === 0 && sampleCount === 0) {
            console.log("No patterns to export. Learn some patterns first via feedback.");
            return;
          }

          const exportData = patternStore.export();
          const output = {
            version: "1.0.0",
            exportedAt: Date.now(),
            dimension: config.dimension,
            metric: config.metric,
            clusters: exportData.clusters,
            samples: exportData.samples,
            metadata: {
              clusterCount,
              sampleCount,
            },
          };

          try {
            const { writeFile } = await import("node:fs/promises");
            const jsonOutput = opts.compact
              ? JSON.stringify(output)
              : JSON.stringify(output, null, 2);
            await writeFile(exportPath, jsonOutput, "utf-8");
            console.log(`Exported ${clusterCount} clusters and ${sampleCount} samples to ${exportPath}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Failed to export patterns: ${message}`);
            process.exitCode = 1;
          }
        });

      // Pattern import command (P3 Advanced Features)
      rv.command("import-patterns")
        .description("Import learned patterns from a JSON file")
        .argument("<path>", "File path to import patterns from")
        .option("--merge", "Merge with existing patterns instead of replacing", false)
        .action(async (importPath: string, opts: { merge?: boolean }) => {
          // Validate path
          if (!importPath || typeof importPath !== "string" || importPath.trim() === "") {
            console.error("Error: path must be a non-empty string");
            process.exitCode = 1;
            return;
          }

          try {
            const { readFile } = await import("node:fs/promises");
            let content: string;
            try {
              content = await readFile(importPath, "utf-8");
            } catch (readErr) {
              const readMessage = readErr instanceof Error ? readErr.message : String(readErr);
              console.error(`Failed to read file: ${readMessage}`);
              process.exitCode = 1;
              return;
            }

            let data: unknown;
            try {
              data = JSON.parse(content);
            } catch (parseErr) {
              console.error(`Invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
              process.exitCode = 1;
              return;
            }

            // Type validation
            if (
              typeof data !== "object" ||
              data === null ||
              !("version" in data) ||
              !("clusters" in data) ||
              !("samples" in data)
            ) {
              console.error("Invalid pattern export format: missing required fields (version, clusters, samples)");
              process.exitCode = 1;
              return;
            }

            const typedData = data as {
              version: string;
              exportedAt?: number;
              dimension?: number;
              clusters: Array<{
                id: string;
                centroid: number[];
                members: string[];
                avgQuality: number;
                lastUpdated: number;
              }>;
              samples: Array<{
                id: string;
                queryVector: number[];
                resultVector: number[];
                relevanceScore: number;
                timestamp: number;
              }>;
            };

            // Validate arrays
            if (!Array.isArray(typedData.clusters) || !Array.isArray(typedData.samples)) {
              console.error("Invalid pattern export format: clusters and samples must be arrays");
              process.exitCode = 1;
              return;
            }

            // Warn about dimension mismatch
            if (typedData.dimension && typedData.dimension !== config.dimension) {
              console.warn(
                `Warning: dimension mismatch (file: ${typedData.dimension}, config: ${config.dimension}). ` +
                  "Patterns may not work correctly.",
              );
            }

            const beforeClusters = patternStore.getClusterCount();
            const beforeSamples = patternStore.getSampleCount();

            if (opts.merge) {
              // Merge mode: add samples and re-cluster
              for (const sample of typedData.samples) {
                patternStore.addSample(sample);
              }
              patternStore.cluster();
              console.log(
                `Merged ${typedData.samples.length} samples. ` +
                  `Before: ${beforeClusters} clusters, ${beforeSamples} samples. ` +
                  `After: ${patternStore.getClusterCount()} clusters, ${patternStore.getSampleCount()} samples.`,
              );
            } else {
              // Replace mode: full import
              patternStore.import({
                clusters: typedData.clusters,
                samples: typedData.samples,
              });
              console.log(
                `Imported ${typedData.clusters.length} clusters and ${typedData.samples.length} samples from ${importPath}`,
              );
            }

            // Show export timestamp if available
            if (typedData.exportedAt) {
              console.log(`  (exported at ${new Date(typedData.exportedAt).toISOString()})`);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Failed to import patterns: ${message}`);
            process.exitCode = 1;
          }
        });

      // Pattern statistics command
      rv.command("pattern-stats")
        .description("Show learned pattern statistics")
        .action(() => {
          const clusterCount = patternStore.getClusterCount();
          const sampleCount = patternStore.getSampleCount();
          const clusters = patternStore.getClusters();

          console.log("Pattern Store Statistics:");
          console.log(`  Total samples: ${sampleCount}`);
          console.log(`  Total clusters: ${clusterCount}`);

          if (clusterCount > 0) {
            console.log("\nCluster Details:");
            for (const cluster of clusters) {
              const age = Date.now() - cluster.lastUpdated;
              const ageStr = age < 3600000
                ? `${Math.floor(age / 60000)}m ago`
                : `${Math.floor(age / 3600000)}h ago`;
              console.log(
                `  ${cluster.id}: ${cluster.members.length} members, ` +
                  `quality ${(cluster.avgQuality * 100).toFixed(1)}%, ` +
                  `updated ${ageStr}`,
              );
            }
          } else {
            console.log("\nNo clusters yet. Provide feedback via ruvector_feedback tool to learn patterns.");
          }
        });

      // Trajectory statistics command (ruvLLM)
      rv.command("trajectory-stats")
        .description("Show ruvLLM trajectory recording statistics")
        .action(() => {
          if (!trajectoryRecorder) {
            console.log("Trajectory recording not enabled.");
            console.log("Enable ruvllm.trajectoryRecording in config to use this feature.");
            return;
          }

          const stats = trajectoryRecorder.getStats();
          console.log("Trajectory Recording Statistics:");
          console.log(`  Total trajectories: ${stats.totalTrajectories}`);
          console.log(`  With feedback: ${stats.trajectoriesWithFeedback}`);
          console.log(
            `  Average feedback: ${stats.trajectoriesWithFeedback > 0 ? (stats.averageFeedbackScore * 100).toFixed(1) + "%" : "N/A"}`,
          );
          if (stats.oldestTimestamp) {
            console.log(`  Oldest: ${new Date(stats.oldestTimestamp).toISOString()}`);
          }
          if (stats.newestTimestamp) {
            console.log(`  Newest: ${new Date(stats.newestTimestamp).toISOString()}`);
          }
        });

      // Context injection status command (ruvLLM)
      rv.command("ruvllm-status")
        .description("Show ruvLLM feature status")
        .action(() => {
          console.log("ruvLLM Feature Status:");
          console.log(`  ruvLLM enabled: ${config.ruvllm?.enabled ?? false}`);

          if (config.ruvllm?.enabled) {
            console.log("\nContext Injection:");
            console.log(`  Enabled: ${contextInjector !== null}`);
            if (contextInjector) {
              console.log(`  Max tokens: ${contextInjector.getMaxTokens()}`);
              console.log(`  Relevance threshold: ${contextInjector.getRelevanceThreshold()}`);
            }

            console.log("\nTrajectory Recording:");
            console.log(`  Enabled: ${trajectoryRecorder !== null}`);
            if (trajectoryRecorder) {
              const stats = trajectoryRecorder.getStats();
              console.log(`  Trajectories: ${stats.totalTrajectories}`);
              console.log(`  With feedback: ${stats.trajectoriesWithFeedback}`);
            }
          }
        });
    },
    { commands: ["ruvector"] },
  );

  // =========================================================================
  // Register Service
  // =========================================================================

  api.registerService({
    id: "memory-ruvector",

    start() {
      api.logger.info(
        `memory-ruvector: service started (hooks: ${config.hooks.enabled ? "enabled" : "disabled"})`,
      );
    },

    async stop() {
      // Flush any pending messages before shutdown and clean up batcher
      if (batcher !== null) {
        await batcher.forceFlush();
        batcher.destroy();
      }

      // Clean up trajectory recorder (prune before shutdown)
      if (trajectoryRecorder) {
        trajectoryRecorder.prune();
        trajectoryRecorder.clear();
      }

      await db.close();
      api.logger.info("memory-ruvector: service stopped");
    },
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

import type { SearchResult } from "./db.js";

/**
 * Re-rank search results using learned patterns.
 *
 * @param results - Original search results
 * @param queryVector - Query vector used for search
 * @param patternStore - Pattern store with learned clusters
 * @param boostFactor - How much to boost pattern-matched results
 * @returns Re-ranked results
 */
function rerankWithPatterns(
  results: SearchResult[],
  queryVector: number[],
  patternStore: PatternStore,
  boostFactor: number,
): SearchResult[] {
  if (results.length === 0 || patternStore.getClusterCount() === 0) {
    return results;
  }

  // Find similar patterns to the query
  const similarPatterns = patternStore.findSimilar(queryVector, 5);
  if (similarPatterns.length === 0) {
    return results;
  }

  // Calculate pattern-based boosts
  const boostedResults = results.map((result) => {
    let patternBoost = 0;

    for (const pattern of similarPatterns) {
      // Pattern centroid contains [query, result], extract result portion
      const dim = queryVector.length;
      // Validate centroid has expected structure before slicing
      if (pattern.centroid.length < dim * 2) {
        continue; // Skip malformed pattern
      }
      const patternResultCentroid = pattern.centroid.slice(dim, dim * 2);

      // result.document.vector is intentionally [] to save memory, so pattern boosting
      // only works when vectors are available (e.g., from graph expansion with vectors)
      if (patternResultCentroid.length > 0 && result.document.vector.length > 0) {
        const similarity = cosineSimilarity(result.document.vector, patternResultCentroid);
        patternBoost += similarity * pattern.avgQuality * boostFactor;
      }
    }

    // Normalize boost
    patternBoost = Math.min(patternBoost / similarPatterns.length, boostFactor);

    return {
      ...result,
      score: Math.min(1.0, result.score + patternBoost),
    };
  });

  // Sort by new score
  boostedResults.sort((a, b) => b.score - a.score);

  return boostedResults;
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
