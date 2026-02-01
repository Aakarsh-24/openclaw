import { ensureAuthProfileStore } from "../agents/auth-profiles.js";
import {
  loadModelCatalog,
  type ModelCatalogEntry,
  resetModelCatalogCacheForTest,
} from "../agents/model-catalog.js";
import { loadConfig } from "../config/config.js";

export type GatewayModelChoice = ModelCatalogEntry & {
  /** True if this model's provider has auth configured */
  configured?: boolean;
};

// Test-only escape hatch: model catalog is cached at module scope for the
// process lifetime, which is fine for the real gateway daemon, but makes
// isolated unit tests harder. Keep this intentionally obscure.
export function __resetModelCatalogCacheForTest() {
  resetModelCatalogCacheForTest();
}

/**
 * Get the set of provider IDs that have at least one auth profile configured.
 */
function getConfiguredProviders(): Set<string> {
  const store = ensureAuthProfileStore();
  const providers = new Set<string>();
  for (const cred of Object.values(store.profiles)) {
    if (cred?.provider) {
      providers.add(cred.provider.toLowerCase());
    }
  }
  return providers;
}

export async function loadGatewayModelCatalog(): Promise<GatewayModelChoice[]> {
  const catalog = await loadModelCatalog({ config: loadConfig() });
  const configuredProviders = getConfiguredProviders();

  // If no providers are configured, return the full catalog
  // (allows model picker to work during initial setup)
  if (configuredProviders.size === 0) {
    return catalog.map((entry) => ({
      ...entry,
      configured: false,
    }));
  }

  // Filter to only models from configured providers
  // and add the "configured" flag for UI display
  return catalog
    .filter((entry) => configuredProviders.has(entry.provider.toLowerCase()))
    .map((entry) => ({
      ...entry,
      configured: true,
    }));
}
