/**
 * Smart Router Configuration Types and Defaults
 * 
 * Config-driven routing with prefix overrides, rules engine,
 * category detection, and usage limits.
 */

export interface PrefixOverride {
  prefix: string;
  model: string;
}

export interface UsageLimit {
  dailyLimit: number;
  warningAt?: number;
}

export interface CategoryConfig {
  patterns: string[];
  tier: RoutingTier;
}

export interface RuleConfig {
  name: string;
  pattern?: string;
  flags?: string;
  maxLength?: number;
  minLength?: number;
  tier?: RoutingTier;
  directAnswer?: string;
  skip?: boolean;
}

export interface TierConfig {
  model: string | null;
  ack: string | null;
  fallback: string[];
}

export interface EscalationConfig {
  enabled: boolean;
  failuresBeforeEscalate: number;
  escalationPath: Record<string, RoutingTier>;
}

export interface AckBehavior {
  editInPlace: string[];
  separateMessages: string[];
}

export type RoutingTier = 
  | "TIER0_TRIVIAL"
  | "TIER1_ROUTINE" 
  | "TIER2_STANDARD"
  | "TIER3_COMPLEX"
  | "TIER4_CRITICAL"
  | "TIER_RESEARCH"
  | "OVERRIDE";

export interface RoutingConfig {
  version: string;
  prefixOverrides: Record<string, string>;
  usageLimits: Record<string, UsageLimit>;
  categories: Record<string, CategoryConfig>;
  rules: RuleConfig[];
  tiers: Record<RoutingTier, TierConfig>;
  escalation: EscalationConfig;
  ackBehavior: AckBehavior;
}

export interface RouterResult {
  tier: RoutingTier;
  model: string;
  ack: string | null;
  directAnswer?: string;
  cleanQuery?: string;
  category?: string;
  source: string;
  skip?: boolean;
  error?: string;
  /** Indicates the primary model was at quota and a fallback was used */
  usedFallback?: boolean;
}

export const DEFAULT_CONFIG: RoutingConfig = {
  version: "2.0",

  prefixOverrides: {
    "!flash": "google/gemini-2.0-flash-lite",
    "flash:": "google/gemini-2.0-flash-lite",
    "!pro": "google/gemini-2.5-flash",
    "pro:": "google/gemini-2.5-flash",
    "!sonnet": "anthropic/claude-sonnet-4-5",
    "sonnet:": "anthropic/claude-sonnet-4-5",
    "!opus": "anthropic/claude-opus-4-5",
    "opus:": "anthropic/claude-opus-4-5",
    "!haiku": "anthropic/claude-haiku-4-5",
    "haiku:": "anthropic/claude-haiku-4-5",
    "!research": "perplexity/sonar-pro",
    "research:": "perplexity/sonar-pro",
  },

  usageLimits: {
    "google/gemini-2.5-flash": { dailyLimit: 500, warningAt: 400 },
    "anthropic/claude-opus-4-5": { dailyLimit: 50, warningAt: 40 },
    "anthropic/claude-sonnet-4-5": { dailyLimit: 200, warningAt: 150 },
    "perplexity/sonar-pro": { dailyLimit: 100, warningAt: 80 },
  },

  categories: {
    frontend: {
      patterns: ["css", "html", "react", "vue", "svelte", "ui", "frontend", "dom", "tailwind", "component", "layout", "responsive"],
      tier: "TIER2_STANDARD",
    },
    backend: {
      patterns: ["python", "node", "express", "api", "sql", "database", "backend", "server", "endpoint", "rest", "graphql", "auth"],
      tier: "TIER3_COMPLEX",
    },
    architecture: {
      patterns: ["architecture", "design pattern", "system design", "scale", "microservice", "infrastructure", "devops"],
      tier: "TIER4_CRITICAL",
    },
    debugging: {
      patterns: ["debug", "debugging", "fix", "fixing", "bug", "bugs", "issue", "issues", "crash", "crashing", "crashed", "exception", "error", "errors", "trace", "stack", "broken", "not working", "fails", "failing", "failed"],
      tier: "TIER3_COMPLEX",
    },
    creative: {
      patterns: ["write", "story", "creative", "poem", "letter", "essay", "draft", "compose", "novel", "script", "speech"],
      tier: "TIER4_CRITICAL",
    },
    coding: {
      patterns: ["code", "function", "implement", "refactor", "class", "method", "algorithm", "script", "program"],
      tier: "TIER3_COMPLEX",
    },
    research: {
      patterns: ["latest", "recent", "current", "news", "today", "yesterday", "this week", "what happened", "search for", "look up", "find out"],
      tier: "TIER_RESEARCH",
    },
    simple: {
      patterns: ["translate", "weather", "time", "date", "convert", "calculate", "what is", "define", "meaning of"],
      tier: "TIER1_ROUTINE",
    },
  },

  rules: [
    {
      name: "greetings",
      pattern: "^(hi|hello|hey|morning|evening|good morning|good evening)\\s*[!.,]?$",
      flags: "i",
      tier: "TIER0_TRIVIAL",
      directAnswer: "Hey! 👋",
    },
    {
      name: "thanks",
      pattern: "^(thanks|thank you|thx|ty|cheers|appreciate it)\\s*[!.,]?$",
      flags: "i",
      tier: "TIER0_TRIVIAL",
      directAnswer: "You're welcome!",
    },
    {
      name: "affirmations",
      pattern: "^(ok|okay|sure|yep|yes|no|cool|nice|great|got it|sounds good|perfect|👍|✅|❤️)\\s*[!.,]?$",
      flags: "i",
      tier: "TIER0_TRIVIAL",
      directAnswer: "👍",
    },
    {
      name: "slash-commands",
      pattern: "^/",
      skip: true,
    },
    {
      name: "very-short",
      maxLength: 3,
      tier: "TIER0_TRIVIAL",
    },
    {
      name: "long-complex",
      minLength: 500,
      tier: "TIER3_COMPLEX",
    },
    {
      name: "very-long",
      minLength: 2000,
      tier: "TIER4_CRITICAL",
    },
  ],

  tiers: {
    TIER0_TRIVIAL: {
      model: "google/gemini-2.0-flash-lite",
      ack: null,
      fallback: [],
    },
    TIER1_ROUTINE: {
      model: "google/gemini-2.0-flash-lite",
      ack: "One sec...",
      fallback: ["google/gemini-2.5-flash"],
    },
    TIER2_STANDARD: {
      model: "google/gemini-2.5-flash",
      ack: "Looking into that...",
      fallback: ["anthropic/claude-haiku-4-5", "google/gemini-2.0-flash-lite"],
    },
    TIER3_COMPLEX: {
      model: "anthropic/claude-sonnet-4-5",
      ack: "Working on it...",
      fallback: ["google/gemini-2.5-flash", "anthropic/claude-haiku-4-5"],
    },
    TIER4_CRITICAL: {
      model: "anthropic/claude-opus-4-5",
      ack: "Let me think about this...",
      fallback: ["anthropic/claude-sonnet-4-5", "google/gemini-2.5-flash"],
    },
    TIER_RESEARCH: {
      model: "perplexity/sonar-pro",
      ack: "Searching...",
      fallback: ["google/gemini-2.5-flash"],
    },
    OVERRIDE: {
      model: null,
      ack: null,
      fallback: [],
    },
  },

  escalation: {
    enabled: true,
    failuresBeforeEscalate: 2,
    escalationPath: {
      TIER1_ROUTINE: "TIER2_STANDARD",
      TIER2_STANDARD: "TIER3_COMPLEX",
      TIER3_COMPLEX: "TIER4_CRITICAL",
      TIER_RESEARCH: "TIER3_COMPLEX",
    },
  },

  ackBehavior: {
    editInPlace: ["telegram", "discord", "slack"],
    separateMessages: ["imessage", "whatsapp", "signal"],
  },
};
