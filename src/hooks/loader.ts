import path from "node:path";
import { pathToFileURL } from "node:url";
import type { OpenClawConfig } from "../config/config.js";
import type { InternalHookHandler } from "./internal-hooks.js";
import { resolveHookConfig } from "./config.js";
import { shouldIncludeHook } from "./config.js";
import { registerInternalHook } from "./internal-hooks.js";
import { loadWorkspaceHookEntries } from "./workspace.js";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function loadInternalHooks(
  cfg: OpenClawConfig,
  workspaceDir: string,
): Promise<number> {
  if (!cfg.hooks?.internal?.enabled) {
    return 0;
  }

  let loadedCount = 0;

  try {
    const hookEntries = loadWorkspaceHookEntries(workspaceDir, { config: cfg });

    const eligible = hookEntries.filter((entry) => shouldIncludeHook({ entry, config: cfg }));

    for (const entry of eligible) {
      const hookConfig = resolveHookConfig(cfg, entry.hook.name);

      if (hookConfig?.enabled === false) {
        continue;
      }
      try {
        const handlerRealPath = realpathSync(entry.hook.handlerPath);
        const workspaceRealPath = realpathSync(workspaceDir);
        const rel = path.relative(workspaceRealPath, handlerRealPath);
        if (rel.startsWith("..") || path.isAbsolute(rel) || rel === "") {
          console.error(
            `Hook error: Refusing to load handler outside workspace: ${entry.hook.handlerPath}`,
          );
          continue;
        }
        const url = pathToFileURL(handlerRealPath).href;
        const cacheBustedUrl = `${url}?t=${Date.now()}`;
        const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

        const exportName = entry.metadata?.export ?? "default";
        const handler = mod[exportName];

        if (typeof handler !== "function") {
          console.error(
            `Hook error: Handler '${exportName}' from ${entry.hook.name} is not a function`,
          );
          continue;
        }

        const events = entry.metadata?.events ?? [];
        if (events.length === 0) {
          console.warn(`Hook warning: Hook '${entry.hook.name}' has no events defined in metadata`);
          continue;
        }
// 🔒 VOTAL.AI Security Fix: Untrusted Dynamic Import Allows Arbitrary Code Execution via Hook Handler Path [CWE-94] - CRITICAL

        for (const event of events) {
          registerInternalHook(event, handler as InternalHookHandler);
        }

        console.log(
          `Registered hook: ${entry.hook.name} -> ${events.join(", ")}${exportName !== "default" ? ` (export: ${exportName})` : ""}`,
        );
        loadedCount++;
      } catch (err) {
        console.error(
          `Failed to load hook ${entry.hook.name}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to load directory-based hooks:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const handlers = Array.isArray(cfg.hooks?.internal?.handlers) ? cfg.hooks.internal.handlers : [];
  for (const handlerConfig of handlers) {
    try {
      if (
        typeof handlerConfig.module !== "string" ||
        handlerConfig.module.startsWith(".") ||
        handlerConfig.module.startsWith("/") ||
        handlerConfig.module.includes("\\") ||
        handlerConfig.module.includes("/")
      ) {
        console.error(
          `Hook error: Refusing to load handler from non-package module: ${handlerConfig.module}`,
        );
        continue;
      }
      const modulePath = require.resolve(handlerConfig.module);

      const url = pathToFileURL(modulePath).href;
      const cacheBustedUrl = `${url}?t=${Date.now()}`;
      const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

      const exportName = handlerConfig.export ?? "default";
      const handler = mod[exportName];

      if (typeof handler !== "function") {
        console.error(
          `Hook error: Handler '${exportName}' from ${modulePath} is not a function`,
        );
        continue;
      }

      registerInternalHook(handlerConfig.event, handler as InternalHookHandler);
      console.log(
        `Registered hook (legacy): ${handlerConfig.event} -> ${modulePath}${exportName !== "default" ? `#${exportName}` : ""}`,
      );
      loadedCount++;
    } catch (err) {
      console.error(
        `Failed to load hook handler from ${handlerConfig.module}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return loadedCount;
}