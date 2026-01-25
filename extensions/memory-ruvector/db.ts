/**
 * ruvector Database Wrapper
 *
 * Provides a high-level interface for storing and searching message vectors.
 * Uses ruvector for high-performance vector similarity search.
 */

import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { RuvectorConfig } from "./config.js";

// ============================================================================
// Types
// ============================================================================

export type MessageDocument = {
  id?: string;
  content: string;
  vector: number[];
  direction: "inbound" | "outbound";
  channel: string;
  user?: string;
  conversationId?: string;
  sessionKey?: string;
  agentId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export type SearchResult = {
  document: MessageDocument;
  score: number;
};

export type CypherResult = {
  columns: string[];
  rows: unknown[][];
};

export type SearchOptions = {
  limit?: number;
  minScore?: number;
  filter?: {
    channel?: string;
    direction?: "inbound" | "outbound";
    user?: string;
    sessionKey?: string;
    agentId?: string;
    startTime?: number;
    endTime?: number;
  };
};

// ============================================================================
// Database Interface
// ============================================================================

export interface RuvectorDB {
  /** Insert a single document */
  insert(doc: MessageDocument): Promise<string>;
  /** Insert multiple documents in a batch */
  insertBatch(docs: MessageDocument[]): Promise<string[]>;
  /** Search for similar documents */
  search(vector: number[], options?: SearchOptions): Promise<SearchResult[]>;
  /** Delete a document by ID */
  delete(id: string): Promise<boolean>;
  /** Get document count */
  count(): Promise<number>;
  /** Close the database connection */
  close(): Promise<void>;
  /** Link two messages with a relationship */
  linkMessages(id1: string, id2: string, relationship: string): Promise<void>;
  /** Find related messages via graph relationships */
  findRelated(id: string, relationship?: string, depth?: number): Promise<SearchResult[]>;
  /** Execute a Cypher graph query */
  graphQuery(cypherQuery: string): Promise<CypherResult>;
}

// ============================================================================
// ruvector Implementation
// ============================================================================

/** Internal ruvector API interface */
interface RuvectorDBAPI {
  insert(
    docs: Array<{
      id: string;
      vector: number[];
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void>;
  search(params: {
    query: number[];
    k: number;
    filters?: Record<string, unknown>;
  }): Promise<
    Array<{
      id: string;
      score: number;
      metadata: Record<string, unknown>;
    }>
  >;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  close?(): Promise<void>;
}

/** Internal CodeGraph API interface */
interface CodeGraphAPI {
  createNode(id: string, labels: string[], properties: Record<string, unknown>): Promise<void>;
  createEdge(from: string, to: string, type: string, properties: Record<string, unknown>): Promise<void>;
  cypher(query: string, params?: Record<string, unknown>): Promise<{ columns: string[]; rows: unknown[][] }>;
  neighbors(nodeId: string, depth?: number): Promise<Array<{ id: string; labels?: string[]; properties?: Record<string, unknown> }>>;
}

/**
 * ruvector database implementation.
 * Falls back to in-memory storage if ruvector is not available.
 */
export class RuvectorDatabase implements RuvectorDB {
  private db: RuvectorDBAPI | null = null;
  private graph: CodeGraphAPI | null = null;
  private initPromise: Promise<void> | null = null;
  private inMemoryStore: Map<string, MessageDocument> = new Map();
  private inMemoryEdges: Map<string, Array<{ targetId: string; relationship: string }>> = new Map();
  private useInMemory = false;

  constructor(
    private readonly dbPath: string,
    private readonly config: {
      dimension: number;
      metric: "cosine" | "euclidean" | "dot";
    },
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.db !== null || this.useInMemory) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(dirname(this.dbPath), { recursive: true });

      // Try to import ruvector
      const ruvector = await import("ruvector").catch((importErr: unknown) => {
        // Log import failure for debugging (ruvector package may not be installed)
        // This is expected in some environments, so we fall back to in-memory
        if (process.env.DEBUG) {
          const msg = importErr instanceof Error ? importErr.message : String(importErr);
          console.debug(`ruvector: import failed, using in-memory fallback: ${msg}`);
        }
        return null;
      });

      if (ruvector && ruvector.VectorDB) {
        this.db = new ruvector.VectorDB({
          path: this.dbPath,
          dimension: this.config.dimension,
          metric: this.config.metric,
        }) as RuvectorDBAPI;

        // Initialize graph if CodeGraph is available
        if (ruvector.CodeGraph) {
          this.graph = new ruvector.CodeGraph({
            storagePath: this.dbPath + ".graph",
            inMemory: false,
          }) as CodeGraphAPI;
        }
      } else {
        // Fall back to in-memory storage
        // Note: Using console.warn here because db.ts doesn't have logger injection
        // In production, ruvector package should be available
        this.useInMemory = true;
      }
    } catch (initErr: unknown) {
      // Fall back to in-memory on any initialization error
      // Log for debugging but don't throw - in-memory fallback allows continued operation
      if (process.env.DEBUG) {
        const msg = initErr instanceof Error ? initErr.message : String(initErr);
        console.debug(`ruvector: initialization failed, using in-memory fallback: ${msg}`);
      }
      this.useInMemory = true;
    }
  }

  async insert(doc: MessageDocument): Promise<string> {
    const ids = await this.insertBatch([doc]);
    return ids[0];
  }

  async insertBatch(docs: MessageDocument[]): Promise<string[]> {
    await this.ensureInitialized();

    if (docs.length === 0) return [];

    // Prepare all documents with IDs
    const preparedDocs = docs.map((doc) => {
      const id = doc.id ?? randomUUID();
      return {
        id,
        docWithId: { ...doc, id },
        ruvectorDoc: {
          id,
          vector: doc.vector,
          metadata: {
            content: doc.content,
            direction: doc.direction,
            channel: doc.channel,
            user: doc.user,
            conversationId: doc.conversationId,
            sessionKey: doc.sessionKey,
            agentId: doc.agentId,
            timestamp: doc.timestamp,
            ...doc.metadata,
          },
        },
      };
    });

    const ids = preparedDocs.map((d) => d.id);

    if (this.useInMemory) {
      for (const { id, docWithId } of preparedDocs) {
        this.inMemoryStore.set(id, docWithId);
      }
    } else if (this.db) {
      // Use ruvector batch API - insert all at once
      try {
        await this.db.insert(preparedDocs.map((d) => d.ruvectorDoc));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`ruvector: batch insert failed: ${msg}`);
      }
    }

    return ids;
  }

  async search(
    vector: number[],
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0.0;

    if (this.useInMemory || !this.db) {
      return this.searchInMemory(vector, limit, minScore, options.filter);
    }

    // Build filter object for ruvector
    const filters: Record<string, unknown> = {};
    if (options.filter) {
      if (options.filter.channel) filters.channel = options.filter.channel;
      if (options.filter.direction) filters.direction = options.filter.direction;
      if (options.filter.user) filters.user = options.filter.user;
      if (options.filter.sessionKey) filters.sessionKey = options.filter.sessionKey;
      if (options.filter.agentId) filters.agentId = options.filter.agentId;
    }

    let results: Awaited<ReturnType<RuvectorDBAPI["search"]>>;
    try {
      results = await this.db.search({
        query: vector,
        k: limit,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: search failed: ${msg}`);
    }

    return results
      .filter((r) => r.score >= minScore)
      .map((r) => ({
        document: {
          id: r.id,
          content: (r.metadata.content as string | undefined) ?? "",
          vector: [], // Don't return vector to save memory
          direction: (r.metadata.direction as "inbound" | "outbound" | undefined) ?? "inbound",
          channel: (r.metadata.channel as string | undefined) ?? "",
          user: r.metadata.user as string | undefined,
          conversationId: r.metadata.conversationId as string | undefined,
          sessionKey: r.metadata.sessionKey as string | undefined,
          agentId: r.metadata.agentId as string | undefined,
          timestamp: (r.metadata.timestamp as number | undefined) ?? Date.now(),
          metadata: r.metadata,
        },
        score: r.score,
      }));
  }

  private searchInMemory(
    vector: number[],
    limit: number,
    minScore: number,
    filter?: SearchOptions["filter"],
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const doc of this.inMemoryStore.values()) {
      // Apply filters
      if (filter) {
        if (filter.channel && doc.channel !== filter.channel) continue;
        if (filter.direction && doc.direction !== filter.direction) continue;
        if (filter.user && doc.user !== filter.user) continue;
        if (filter.sessionKey && doc.sessionKey !== filter.sessionKey) continue;
        if (filter.agentId && doc.agentId !== filter.agentId) continue;
        if (filter.startTime && doc.timestamp < filter.startTime) continue;
        if (filter.endTime && doc.timestamp > filter.endTime) continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(vector, doc.vector);
      if (score >= minScore) {
        results.push({
          document: { ...doc, vector: [] }, // Don't return vector
          score,
        });
      }
    }

    // Sort by score descending and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
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

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    if (this.useInMemory || !this.db) {
      return this.inMemoryStore.delete(id);
    }

    try {
      return await this.db.delete(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: delete failed for id ${id}: ${msg}`);
    }
  }

  async count(): Promise<number> {
    await this.ensureInitialized();

    if (this.useInMemory || !this.db) {
      return this.inMemoryStore.size;
    }

    try {
      return await this.db.count();
    } catch (err: unknown) {
      // Log but don't throw - return 0 as a safe fallback for count operations
      if (process.env.DEBUG) {
        const msg = err instanceof Error ? err.message : String(err);
        console.debug(`ruvector: count failed, returning 0: ${msg}`);
      }
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.db && !this.useInMemory && this.db.close) {
      await this.db.close();
    }
    this.db = null;
    this.graph = null;
    this.initPromise = null;
    this.inMemoryStore.clear();
    this.inMemoryEdges.clear();
  }

  // ===========================================================================
  // Graph Operations
  // ===========================================================================

  /**
   * Link two messages with a relationship in the graph.
   *
   * @param id1 - First message ID
   * @param id2 - Second message ID
   * @param relationship - Relationship type (e.g., "relates_to", "follows")
   */
  async linkMessages(id1: string, id2: string, relationship: string): Promise<void> {
    await this.ensureInitialized();

    if (this.useInMemory || !this.graph) {
      // In-memory fallback: store edges in a map
      const edges = this.inMemoryEdges.get(id1) ?? [];
      edges.push({ targetId: id2, relationship });
      this.inMemoryEdges.set(id1, edges);
      return;
    }

    try {
      // Ensure nodes exist in the graph (parallel - independent operations)
      await Promise.all([
        this.graph.createNode(id1, ["Message"], {}),
        this.graph.createNode(id2, ["Message"], {}),
      ]);

      // Create the edge
      await this.graph.createEdge(id1, id2, relationship, {
        createdAt: Date.now(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: linkMessages failed (${id1} -> ${id2}): ${msg}`);
    }
  }

  /**
   * Find related messages via graph relationships.
   *
   * @param id - Message ID to find relations for
   * @param relationship - Optional relationship type filter
   * @param depth - Maximum traversal depth (default: 1)
   * @returns Array of related messages with scores
   */
  async findRelated(
    id: string,
    relationship?: string,
    depth: number = 1,
  ): Promise<SearchResult[]> {
    await this.ensureInitialized();

    if (this.useInMemory || !this.graph) {
      // In-memory fallback: traverse edges manually
      return this.findRelatedInMemory(id, relationship, depth);
    }

    // Validate relationship to prevent Cypher injection (allow alphanumeric and underscore only)
    if (relationship && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(relationship)) {
      throw new Error(`ruvector: invalid relationship type "${relationship}" - must be alphanumeric`);
    }

    // Use Cypher to find related nodes with their properties
    const cypherQuery = relationship
      ? `MATCH (a)-[r:${relationship}*1..${depth}]->(b:Message) WHERE a.id = $id RETURN DISTINCT b`
      : `MATCH (a)-[r*1..${depth}]->(b:Message) WHERE a.id = $id RETURN DISTINCT b`;

    let result: { columns: string[]; rows: unknown[][] };
    try {
      result = await this.graph.cypher(cypherQuery, { id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: findRelated query failed for id ${id}: ${msg}`);
    }

    // Build SearchResult from graph node properties
    const results: SearchResult[] = [];
    for (const row of result.rows) {
      const node = row[0] as Record<string, unknown> | null;
      if (!node || typeof node !== "object") continue;

      // Extract document from node properties
      const nodeId = node.id as string | undefined;
      const content = node.content as string | undefined;
      if (!nodeId || !content) continue;

      results.push({
        document: {
          id: nodeId,
          content,
          vector: [], // Don't return vector to save memory
          direction: (node.direction as "inbound" | "outbound") ?? "inbound",
          channel: (node.channel as string) ?? "unknown",
          user: node.user as string | undefined,
          conversationId: node.conversationId as string | undefined,
          sessionKey: node.sessionKey as string | undefined,
          agentId: node.agentId as string | undefined,
          timestamp: (node.timestamp as number) ?? 0,
          metadata: node.metadata as Record<string, unknown> | undefined,
        },
        score: 1.0 / (depth + 1), // Score decreases with depth
      });
    }

    return results;
  }

  private findRelatedInMemory(
    id: string,
    relationship?: string,
    depth: number = 1,
  ): SearchResult[] {
    const visited = new Set<string>();
    const results: SearchResult[] = [];

    const traverse = (currentId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      const edges = this.inMemoryEdges.get(currentId) ?? [];
      for (const edge of edges) {
        if (relationship && edge.relationship !== relationship) continue;

        const doc = this.inMemoryStore.get(edge.targetId);
        if (doc && !visited.has(edge.targetId)) {
          results.push({
            document: { ...doc, vector: [] },
            score: 1.0 / (currentDepth + 1),
          });
          traverse(edge.targetId, currentDepth + 1);
        }
      }
    };

    traverse(id, 0);
    return results;
  }

  /**
   * Execute a Cypher graph query.
   *
   * @param cypherQuery - Cypher query string
   * @returns Query result with columns and rows
   */
  async graphQuery(cypherQuery: string): Promise<CypherResult> {
    await this.ensureInitialized();

    if (this.useInMemory || !this.graph) {
      // In-memory fallback: return empty result
      return { columns: [], rows: [] };
    }

    try {
      return await this.graph.cypher(cypherQuery);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ruvector: graphQuery failed: ${msg}`);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a ruvector database instance from config.
 */
export function createDatabase(config: RuvectorConfig): RuvectorDB {
  return new RuvectorDatabase(config.dbPath, {
    dimension: config.dimension,
    metric: config.metric,
  });
}
