import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import {
  buildModelAliasIndex,
  modelKey,
  parseModelRef,
  resolveModelRefFromString,
} from "../../agents/model-selection.js";
import {
  type ClawdbotConfig,
  readConfigFileSnapshot,
  writeConfigFile,
} from "../../config/config.js";

export const ensureFlagCompatibility = (opts: { json?: boolean; plain?: boolean }) => {
  if (opts.json && opts.plain) {
    throw new Error("Choose either --json or --plain, not both.");
  }
};

export const formatTokenK = (value?: number | null) => {
  if (!value || !Number.isFinite(value)) return "-";
  if (value < 1024) return `${Math.round(value)}`;
  return `${Math.round(value / 1024)}k`;
};

export const formatMs = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  if (!Number.isFinite(value)) return "-";
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${Math.round(value / 100) / 10}s`;
};

export async function updateConfig(
  mutator: (cfg: ClawdbotConfig) => ClawdbotConfig,
): Promise<ClawdbotConfig> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    const issues = snapshot.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`Invalid config at ${snapshot.path}\n${issues}`);
  }
  const next = mutator(snapshot.config);
  await writeConfigFile(next);
  return next;
}

export function resolveModelTarget(params: { raw: string; cfg: ClawdbotConfig }): {
  provider: string;
  model: string;
} {
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER,
  });
  const resolved = resolveModelRefFromString({
    raw: params.raw,
    defaultProvider: DEFAULT_PROVIDER,
    aliasIndex,
  });
  if (!resolved) {
    throw new Error(`Invalid model reference: ${params.raw}`);
  }
  return resolved.ref;
}

export function buildAllowlistSet(cfg: ClawdbotConfig): Set<string> {
  const allowed = new Set<string>();
  const models = cfg.agents?.defaults?.models ?? {};
  for (const raw of Object.keys(models)) {
    const parsed = parseModelRef(String(raw ?? ""), DEFAULT_PROVIDER);
    if (!parsed) continue;
    allowed.add(modelKey(parsed.provider, parsed.model));
  }
  return allowed;
}

export function normalizeAlias(alias: string): string {
  const trimmed = alias.trim();
  if (!trimmed) throw new Error("Alias cannot be empty.");
  if (!/^[A-Za-z0-9_.:-]+$/.test(trimmed)) {
    throw new Error("Alias must use letters, numbers, dots, underscores, colons, or dashes.");
  }
  return trimmed;
}

export { modelKey };
export { DEFAULT_MODEL, DEFAULT_PROVIDER };

/**
 * Model key format: "provider/model"
 *
 * The model key is displayed in `/model status` and is the internal identifier.
 *
 * When using `/model <key>` to switch models:
 * - For Anthropic: use the model ID directly (e.g., `/model claude-opus-4-5`)
 * - For OpenAI: use the model ID directly (e.g., `/model gpt-4.1`)
 * - For OpenRouter: use the model ID without provider prefix (e.g., `/model moonshotai/kimi-k2`)
 *
 * Note: The status display shows "provider/model" for clarity, but when switching,
 * omit the provider prefix for most providers. The parsing logic uses the first "/" to
 * separate provider from model ID.
 *
 * For providers with hierarchical model IDs (e.g., OpenRouter), the model ID may include
 * sub-providers (e.g., "moonshotai/kimi-k2"), resulting in a display key like "openrouter/moonshotai/kimi-k2".
 *
 * Related: See issue #1019 for OpenRouter model usage clarification.
 */
