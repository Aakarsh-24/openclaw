import { Type } from "@sinclair/typebox";

import type { ClawdbotConfig } from "../../config/config.js";
import { formatCliCommand } from "../../cli/command-format.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringArrayParam, readStringParam } from "./common.js";
import {
  CacheEntry,
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache,
} from "./web-shared.js";

const SEARCH_PROVIDERS = ["brave", "perplexity"] as const;
const DEFAULT_SEARCH_COUNT = 5;
const MAX_SEARCH_COUNT = 10;

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const PERPLEXITY_SEARCH_ENDPOINT = "https://api.perplexity.ai/search";

const SEARCH_CACHE = new Map<string, CacheEntry<Record<string, unknown>>>();
const BRAVE_FRESHNESS_SHORTCUTS = new Set(["pd", "pw", "pm", "py"]);
const BRAVE_FRESHNESS_RANGE = /^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/;
const PERPLEXITY_RECENCY_VALUES = new Set(["day", "week", "month", "year"]);

function createWebSearchSchema(provider: (typeof SEARCH_PROVIDERS)[number]) {
  const baseSchema = {
    query: Type.String({ description: "Search query string." }),
    count: Type.Optional(
      Type.Number({
        description: "Number of results to return (1-10).",
        minimum: 1,
        maximum: MAX_SEARCH_COUNT,
      }),
    ),
    country: Type.Optional(
      Type.String({
        description:
          "2-letter country code for region-specific results (e.g., 'DE', 'US', 'ALL'). Default: 'US'.",
      }),
    ),
  } as const;

  if (provider === "brave") {
    return Type.Object({
      ...baseSchema,
      search_lang: Type.Optional(
        Type.String({
          description: "ISO language code for search results (e.g., 'de', 'en', 'fr').",
        }),
      ),
      ui_lang: Type.Optional(
        Type.String({
          description: "ISO language code for UI elements.",
        }),
      ),
      freshness: Type.Optional(
        Type.String({
          description:
            "Filter results by discovery time. Values: 'pd' (past 24h), 'pw' (past week), 'pm' (past month), 'py' (past year), or date range 'YYYY-MM-DDtoYYYY-MM-DD'.",
        }),
      ),
    });
  }

  // Perplexity provider schema
  return Type.Object({
    ...baseSchema,
    recency: Type.Optional(
      Type.String({
        description: "Filter by time period: 'day', 'week', 'month', or 'year'.",
      }),
    ),
    domain_filter: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Domain filter (max 20). Allowlist: ['nature.com'] or denylist: ['-reddit.com']. Cannot mix.",
      }),
    ),
    language_filter: Type.Optional(
      Type.Array(Type.String(), {
        description: "ISO 639-1 language codes (max 10). Example: ['en', 'de'].",
      }),
    ),
  });
}

type WebSearchConfig = NonNullable<ClawdbotConfig["tools"]>["web"] extends infer Web
  ? Web extends { search?: infer Search }
    ? Search
    : undefined
  : undefined;

type BraveSearchResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
};

type BraveSearchResponse = {
  web?: {
    results?: BraveSearchResult[];
  };
};

type PerplexityConfig = {
  apiKey?: string;
};

type PerplexityApiKeySource = "config" | "perplexity_env" | "none";

type PerplexitySearchApiResult = {
  title?: string;
  url?: string;
  snippet?: string;
  date?: string;
  last_updated?: string;
};

type PerplexitySearchApiResponse = {
  results?: PerplexitySearchApiResult[];
  id?: string;
};

function resolveSearchConfig(cfg?: ClawdbotConfig): WebSearchConfig {
  const search = cfg?.tools?.web?.search;
  if (!search || typeof search !== "object") return undefined;
  return search as WebSearchConfig;
}

function resolveSearchEnabled(params: { search?: WebSearchConfig; sandboxed?: boolean }): boolean {
  if (typeof params.search?.enabled === "boolean") return params.search.enabled;
  if (params.sandboxed) return true;
  return true;
}

function resolveSearchApiKey(search?: WebSearchConfig): string | undefined {
  const fromConfig =
    search && "apiKey" in search && typeof search.apiKey === "string" ? search.apiKey.trim() : "";
  const fromEnv = (process.env.BRAVE_API_KEY ?? "").trim();
  return fromConfig || fromEnv || undefined;
}

function missingSearchKeyPayload(provider: (typeof SEARCH_PROVIDERS)[number]) {
  if (provider === "perplexity") {
    return {
      error: "missing_perplexity_api_key",
      message:
        "web_search (perplexity) needs an API key. Set PERPLEXITY_API_KEY in the Gateway environment, or configure tools.web.search.perplexity.apiKey.",
      docs: "https://docs.clawd.bot/tools/web",
    };
  }
  return {
    error: "missing_brave_api_key",
    message: `web_search needs a Brave Search API key. Run \`${formatCliCommand("clawdbot configure --section web")}\` to store it, or set BRAVE_API_KEY in the Gateway environment.`,
    docs: "https://docs.clawd.bot/tools/web",
  };
}

function resolveSearchProvider(search?: WebSearchConfig): (typeof SEARCH_PROVIDERS)[number] {
  const raw =
    search && "provider" in search && typeof search.provider === "string"
      ? search.provider.trim().toLowerCase()
      : "";
  if (raw === "perplexity") return "perplexity";
  if (raw === "brave") return "brave";
  return "brave";
}

function resolvePerplexityConfig(search?: WebSearchConfig): PerplexityConfig {
  if (!search || typeof search !== "object") return {};
  const perplexity = "perplexity" in search ? search.perplexity : undefined;
  if (!perplexity || typeof perplexity !== "object") return {};
  return perplexity as PerplexityConfig;
}

function resolvePerplexityApiKey(perplexity?: PerplexityConfig): {
  apiKey?: string;
  source: PerplexityApiKeySource;
} {
  const fromConfig = normalizeApiKey(perplexity?.apiKey);
  if (fromConfig) {
    return { apiKey: fromConfig, source: "config" };
  }

  const fromEnvPerplexity = normalizeApiKey(process.env.PERPLEXITY_API_KEY);
  if (fromEnvPerplexity) {
    return { apiKey: fromEnvPerplexity, source: "perplexity_env" };
  }

  return { apiKey: undefined, source: "none" };
}

function normalizeApiKey(key: unknown): string {
  return typeof key === "string" ? key.trim() : "";
}

function resolveSearchCount(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamped = Math.max(1, Math.min(MAX_SEARCH_COUNT, Math.floor(parsed)));
  return clamped;
}

function normalizeFreshness(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (BRAVE_FRESHNESS_SHORTCUTS.has(lower)) return lower;

  const match = trimmed.match(BRAVE_FRESHNESS_RANGE);
  if (!match) return undefined;

  const [, start, end] = match;
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return undefined;
  if (start > end) return undefined;

  return `${start}to${end}`;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function resolveSiteName(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function runPerplexitySearchApi(params: {
  query: string;
  apiKey: string;
  count: number;
  timeoutSeconds: number;
  country?: string;
  searchDomainFilter?: string[];
  searchRecencyFilter?: string;
  searchLanguageFilter?: string[];
}): Promise<
  Array<{ title: string; url: string; description: string; published?: string; siteName?: string }>
> {
  const body: Record<string, unknown> = {
    query: params.query,
    max_results: params.count,
  };

  if (params.country) {
    body.country = params.country;
  }
  if (params.searchDomainFilter && params.searchDomainFilter.length > 0) {
    body.search_domain_filter = params.searchDomainFilter;
  }
  if (params.searchRecencyFilter) {
    body.search_recency_filter = params.searchRecencyFilter;
  }
  if (params.searchLanguageFilter && params.searchLanguageFilter.length > 0) {
    body.search_language_filter = params.searchLanguageFilter;
  }

  const res = await fetch(PERPLEXITY_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: withTimeout(undefined, params.timeoutSeconds * 1000),
  });

  if (!res.ok) {
    const detail = await readResponseText(res);
    throw new Error(`Perplexity Search API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = (await res.json()) as PerplexitySearchApiResponse;
  const results = Array.isArray(data.results) ? data.results : [];

  // Map to match Brave's format
  return results.map((entry) => ({
    title: entry.title ?? "",
    url: entry.url ?? "",
    description: entry.snippet ?? "",
    published: entry.date ?? undefined,
    siteName: resolveSiteName(entry.url ?? ""),
  }));
}

async function runWebSearch(params: {
  query: string;
  count: number;
  apiKey: string;
  timeoutSeconds: number;
  cacheTtlMs: number;
  provider: (typeof SEARCH_PROVIDERS)[number];
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  freshness?: string;
  searchDomainFilter?: string[];
  searchRecencyFilter?: string;
  searchLanguageFilter?: string[];
}): Promise<Record<string, unknown>> {
  const cacheKey = normalizeCacheKey(
    params.provider === "brave"
      ? `${params.provider}:${params.query}:${params.count}:${params.country || "default"}:${params.search_lang || "default"}:${params.ui_lang || "default"}:${params.freshness || "default"}`
      : `${params.provider}:${params.query}:${params.count}:${params.country || "default"}:${params.searchDomainFilter?.join(",") || "default"}:${params.searchRecencyFilter || "default"}:${params.searchLanguageFilter?.join(",") || "default"}`,
  );
  const cached = readCache(SEARCH_CACHE, cacheKey);
  if (cached) return { ...cached.value, cached: true };

  const start = Date.now();

  if (params.provider === "perplexity") {
    const results = await runPerplexitySearchApi({
      query: params.query,
      apiKey: params.apiKey,
      count: params.count,
      timeoutSeconds: params.timeoutSeconds,
      country: params.country,
      searchDomainFilter: params.searchDomainFilter,
      searchRecencyFilter: params.searchRecencyFilter,
      searchLanguageFilter: params.searchLanguageFilter,
    });

    const payload = {
      query: params.query,
      provider: params.provider,
      count: results.length,
      tookMs: Date.now() - start,
      results,
    };
    writeCache(SEARCH_CACHE, cacheKey, payload, params.cacheTtlMs);
    return payload;
  }

  if (params.provider !== "brave") {
    throw new Error("Unsupported web search provider.");
  }

  const url = new URL(BRAVE_SEARCH_ENDPOINT);
  url.searchParams.set("q", params.query);
  url.searchParams.set("count", String(params.count));
  if (params.country) {
    url.searchParams.set("country", params.country);
  }
  if (params.search_lang) {
    url.searchParams.set("search_lang", params.search_lang);
  }
  if (params.ui_lang) {
    url.searchParams.set("ui_lang", params.ui_lang);
  }
  if (params.freshness) {
    url.searchParams.set("freshness", params.freshness);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": params.apiKey,
    },
    signal: withTimeout(undefined, params.timeoutSeconds * 1000),
  });

  if (!res.ok) {
    const detail = await readResponseText(res);
    throw new Error(`Brave Search API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = (await res.json()) as BraveSearchResponse;
  const results = Array.isArray(data.web?.results) ? (data.web?.results ?? []) : [];
  const mapped = results.map((entry) => ({
    title: entry.title ?? "",
    url: entry.url ?? "",
    description: entry.description ?? "",
    published: entry.age ?? undefined,
    siteName: resolveSiteName(entry.url ?? ""),
  }));

  const payload = {
    query: params.query,
    provider: params.provider,
    count: mapped.length,
    tookMs: Date.now() - start,
    results: mapped,
  };
  writeCache(SEARCH_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}

export function createWebSearchTool(options?: {
  config?: ClawdbotConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  const search = resolveSearchConfig(options?.config);
  if (!resolveSearchEnabled({ search, sandboxed: options?.sandboxed })) return null;

  const provider = resolveSearchProvider(search);
  const perplexityConfig = resolvePerplexityConfig(search);

  const description =
    provider === "perplexity"
      ? "Search the web using Perplexity Search API. Returns structured results (title, URL, snippet). Supports recency filter, domain filtering, and language filtering."
      : "Search the web using Brave Search API. Supports region-specific and localized search via country and language parameters. Returns titles, URLs, and snippets for fast research.";

  return {
    label: "Web Search",
    name: "web_search",
    description,
    parameters: createWebSearchSchema(provider),
    execute: async (_toolCallId, args) => {
      const perplexityAuth =
        provider === "perplexity" ? resolvePerplexityApiKey(perplexityConfig) : undefined;
      const apiKey =
        provider === "perplexity" ? perplexityAuth?.apiKey : resolveSearchApiKey(search);

      if (!apiKey) {
        return jsonResult(missingSearchKeyPayload(provider));
      }
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const count =
        readNumberParam(params, "count", { integer: true }) ?? search?.maxResults ?? undefined;
      const country = readStringParam(params, "country");
      const search_lang = readStringParam(params, "search_lang");
      const ui_lang = readStringParam(params, "ui_lang");
      const rawFreshness = readStringParam(params, "freshness");
      const freshness = rawFreshness ? normalizeFreshness(rawFreshness) : undefined;
      if (rawFreshness && !freshness) {
        return jsonResult({
          error: "invalid_freshness",
          message:
            "freshness must be one of pd, pw, pm, py, or a range like YYYY-MM-DDtoYYYY-MM-DD.",
          docs: "https://docs.clawd.bot/tools/web",
        });
      }
      const rawRecency = readStringParam(params, "recency");
      const recency =
        rawRecency && PERPLEXITY_RECENCY_VALUES.has(rawRecency.toLowerCase())
          ? rawRecency.toLowerCase()
          : undefined;
      if (rawRecency && !recency) {
        return jsonResult({
          error: "invalid_recency",
          message: "recency must be one of: day, week, month, year.",
          docs: "https://docs.clawd.bot/tools/web",
        });
      }
      const domainFilter = readStringArrayParam(params, "domain_filter");
      const languageFilter = readStringArrayParam(params, "language_filter");

      const result = await runWebSearch({
        query,
        count: resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
        apiKey,
        timeoutSeconds: resolveTimeoutSeconds(search?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS),
        cacheTtlMs: resolveCacheTtlMs(search?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES),
        provider,
        country,
        search_lang,
        ui_lang,
        freshness,
        searchDomainFilter: domainFilter,
        searchRecencyFilter: recency,
        searchLanguageFilter: languageFilter,
      });
      return jsonResult(result);
    },
  };
}

export const __testing = {
  normalizeFreshness,
  SEARCH_CACHE,
  PERPLEXITY_RECENCY_VALUES,
} as const;
