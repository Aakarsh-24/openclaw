import { CONFIG_PATH_CLAWDBOT } from "../../config/config.js";
import { resolveStorePath } from "../../config/sessions.js";
import type { RuntimeEnv } from "../../runtime.js";
import { resolveModelTarget, updateConfig } from "./shared.js";

export async function modelsSetCommand(modelRaw: string, runtime: RuntimeEnv) {
  const updated = await updateConfig((cfg) => {
    const resolved = resolveModelTarget({ raw: modelRaw, cfg });
    const key = `${resolved.provider}/${resolved.model}`;
    const nextModels = { ...cfg.agents?.defaults?.models };
    if (!nextModels[key]) nextModels[key] = {};
    const existingModel = cfg.agents?.defaults?.model as
      | { primary?: string; fallbacks?: string[] }
      | undefined;
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: {
            ...(existingModel?.fallbacks
              ? { fallbacks: existingModel.fallbacks }
              : undefined),
            primary: key,
          },
          models: nextModels,
        },
      },
    };
  });

  runtime.log(`Updated ${CONFIG_PATH_CLAWDBOT}`);
  runtime.log(
    `Default model: ${updated.agents?.defaults?.model?.primary ?? modelRaw}`,
  );

  // Clear session model/provider overrides so new default takes effect
  try {
    const { loadSessionStore, saveSessionStore } = await import(
      "../../config/sessions.js"
    );
    const storePath = resolveStorePath(updated.session?.store, {});
    const sessionStore = loadSessionStore(storePath);
    let cleared = 0;
    for (const [_key, entry] of Object.entries(sessionStore)) {
      if (entry.modelOverride || entry.providerOverride) {
        delete entry.modelOverride;
        delete entry.providerOverride;
        entry.updatedAt = Date.now();
        cleared++;
      }
    }
    if (cleared > 0) {
      await saveSessionStore(storePath, sessionStore);
      runtime.log(`Cleared model overrides in ${cleared} session(s)`);
    }
  } catch (err) {
    runtime.log(`Warning: Failed to clear session overrides: ${String(err)}`);
  }
}
