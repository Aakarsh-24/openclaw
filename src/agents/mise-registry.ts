import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MiseRegistryEntry = {
  /** Short name (e.g., "jq", "ripgrep"). */
  short: string;
  /** Full backend references (e.g., ["aqua:jqlang/jq", "ubi:jqlang/jq"]). */
  backends: string[];
};

export type MiseInstalledTool = {
  /** Tool short name. */
  name: string;
  /** Installed version. */
  version: string;
  /** Requested version (e.g., "latest", "1.7.1"). */
  requestedVersion?: string;
  /** Installation path. */
  installPath: string;
  /** Whether currently active in PATH. */
  active: boolean;
};

export type MiseRegistrySearchResult = {
  entries: MiseRegistryEntry[];
  total: number;
};

// ---------------------------------------------------------------------------
// Registry cache
// ---------------------------------------------------------------------------

let registryCache: MiseRegistryEntry[] | null = null;
let registryCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkMiseInstalled(): Promise<boolean> {
  try {
    await execAsync("mise --version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function parseRegistryOutput(output: string): MiseRegistryEntry[] {
  const entries: MiseRegistryEntry[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: "short_name    backend1 backend2 backend3"
    // Split on 2+ whitespace to separate short name from backends
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length < 2) continue;

    const short = parts[0].trim();
    const backends = parts[1].split(/\s+/).filter(Boolean);

    if (short && backends.length > 0) {
      entries.push({ short, backends });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if mise is available on the system.
 */
export async function isMiseAvailable(): Promise<boolean> {
  return checkMiseInstalled();
}

/**
 * Load the full mise registry.
 * Results are cached for 1 hour.
 */
export async function loadMiseRegistry(
  forceRefresh = false,
): Promise<MiseRegistryEntry[]> {
  const now = Date.now();

  if (
    !forceRefresh &&
    registryCache &&
    now - registryCacheTime < CACHE_TTL_MS
  ) {
    return registryCache;
  }

  const available = await checkMiseInstalled();
  if (!available) {
    return [];
  }

  try {
    const { stdout } = await execAsync("mise registry --hide-aliased", {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB for large registry
    });

    registryCache = parseRegistryOutput(stdout);
    registryCacheTime = now;

    return registryCache;
  } catch (error) {
    console.error("Failed to load mise registry:", error);
    return registryCache ?? [];
  }
}

/**
 * Search the mise registry by query.
 * Matches against short name (case-insensitive, substring match).
 */
export async function searchMiseRegistry(
  query: string,
  opts?: { limit?: number; offset?: number },
): Promise<MiseRegistrySearchResult> {
  const registry = await loadMiseRegistry();
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const queryLower = query.toLowerCase().trim();

  const filtered = queryLower
    ? registry.filter((entry) => entry.short.toLowerCase().includes(queryLower))
    : registry;

  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

/**
 * Get a specific registry entry by short name.
 */
export async function getMiseRegistryEntry(
  shortName: string,
): Promise<MiseRegistryEntry | null> {
  const registry = await loadMiseRegistry();
  return registry.find((e) => e.short === shortName) ?? null;
}

/**
 * List all tools installed via mise.
 */
export async function listMiseInstalledTools(): Promise<MiseInstalledTool[]> {
  const available = await checkMiseInstalled();
  if (!available) {
    return [];
  }

  try {
    const { stdout } = await execAsync("mise ls --json", {
      timeout: 30000,
    });

    const data = JSON.parse(stdout) as Record<
      string,
      Array<{
        version: string;
        requested_version?: string;
        install_path: string;
        active?: boolean;
      }>
    >;

    const tools: MiseInstalledTool[] = [];

    for (const [name, versions] of Object.entries(data)) {
      for (const v of versions) {
        tools.push({
          name,
          version: v.version,
          requestedVersion: v.requested_version,
          installPath: v.install_path,
          active: v.active ?? false,
        });
      }
    }

    return tools;
  } catch (error) {
    console.error("Failed to list mise installed tools:", error);
    return [];
  }
}

/**
 * Install a tool via mise.
 */
export async function installMiseTool(
  shortName: string,
  version = "latest",
): Promise<{ success: boolean; error?: string }> {
  const available = await checkMiseInstalled();
  if (!available) {
    return { success: false, error: "mise is not installed" };
  }

  try {
    const spec = version === "latest" ? shortName : `${shortName}@${version}`;
    await execAsync(`mise install ${spec}`, {
      timeout: 5 * 60 * 1000, // 5 minutes for install
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Uninstall a tool via mise.
 */
export async function uninstallMiseTool(
  shortName: string,
  version?: string,
): Promise<{ success: boolean; error?: string }> {
  const available = await checkMiseInstalled();
  if (!available) {
    return { success: false, error: "mise is not installed" };
  }

  try {
    const spec = version ? `${shortName}@${version}` : shortName;
    await execAsync(`mise uninstall ${spec}`, {
      timeout: 60000,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Clear the registry cache.
 */
export function clearMiseRegistryCache(): void {
  registryCache = null;
  registryCacheTime = 0;
}
