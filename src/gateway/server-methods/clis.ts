import {
  installMiseTool,
  isMiseAvailable,
  listMiseInstalledTools,
  searchMiseRegistry,
  uninstallMiseTool,
} from "../../agents/mise-registry.js";
import type { ClawdbotConfig, ExternalCliEntry } from "../../config/config.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateClisInstalledParams,
  validateClisInstallParams,
  validateClisRegistrySearchParams,
  validateClisStatusParams,
  validateClisUninstallParams,
  validateClisUpdateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export type CliStatusEntry = {
  /** Short name (e.g., "jq"). */
  shortName: string;
  /** mise package identifier. */
  misePackage: string;
  /** Installed version (if installed via mise). */
  installedVersion?: string;
  /** Description for when to use this CLI. */
  description: string;
  /** Example usage patterns. */
  examples?: string[];
  /** Whether enabled for the agent. */
  enabled: boolean;
  /** Whether installed via mise. */
  isInstalled: boolean;
  /** Whether configured in clawdbot config (has description). */
  isConfigured: boolean;
};

export type ClisStatusReport = {
  /** Whether mise is available on the system. */
  miseAvailable: boolean;
  /** Configured CLIs with their status. */
  clis: CliStatusEntry[];
};

export const clisHandlers: GatewayRequestHandlers = {
  /**
   * Search the mise registry for available CLIs.
   */
  "clis.registry.search": async ({ params, respond }) => {
    if (!validateClisRegistrySearchParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.registry.search params: ${formatValidationErrors(validateClisRegistrySearchParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      query?: string;
      limit?: number;
      offset?: number;
    };

    const miseAvailable = await isMiseAvailable();
    if (!miseAvailable) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "mise is not installed. Install it from https://mise.jdx.dev",
        ),
      );
      return;
    }

    const result = await searchMiseRegistry(p.query ?? "", {
      limit: p.limit,
      offset: p.offset,
    });

    respond(true, result, undefined);
  },

  /**
   * List CLIs installed via mise.
   */
  "clis.installed": async ({ params, respond }) => {
    if (!validateClisInstalledParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.installed params: ${formatValidationErrors(validateClisInstalledParams.errors)}`,
        ),
      );
      return;
    }

    const miseAvailable = await isMiseAvailable();
    if (!miseAvailable) {
      respond(true, { tools: [], miseAvailable: false }, undefined);
      return;
    }

    const tools = await listMiseInstalledTools();
    respond(true, { tools, miseAvailable: true }, undefined);
  },

  /**
   * Install a CLI via mise and save its configuration.
   */
  "clis.install": async ({ params, respond }) => {
    if (!validateClisInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.install params: ${formatValidationErrors(validateClisInstallParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      shortName: string;
      version?: string;
      description: string;
      examples?: string[];
    };

    const miseAvailable = await isMiseAvailable();
    if (!miseAvailable) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "mise is not installed. Install it from https://mise.jdx.dev",
        ),
      );
      return;
    }

    // Check if already installed
    const installedTools = await listMiseInstalledTools();
    const alreadyInstalled = installedTools.some((t) => t.name === p.shortName);

    // Install via mise if not already installed
    if (!alreadyInstalled) {
      const installResult = await installMiseTool(p.shortName, p.version);
      if (!installResult.success) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            `Failed to install ${p.shortName}: ${installResult.error}`,
          ),
        );
        return;
      }
    }

    // Save to config
    const cfg = loadConfig();
    const clis = cfg.clis ? { ...cfg.clis } : {};
    const entries = clis.entries ? { ...clis.entries } : {};

    const entry: ExternalCliEntry = {
      misePackage: p.shortName,
      version: p.version,
      description: p.description,
      examples: p.examples,
      enabled: true,
    };

    entries[p.shortName] = entry;
    clis.entries = entries;

    const nextConfig: ClawdbotConfig = {
      ...cfg,
      clis,
    };

    await writeConfigFile(nextConfig);

    respond(
      true,
      {
        ok: true,
        shortName: p.shortName,
        version: p.version ?? "latest",
        entry,
      },
      undefined,
    );
  },

  /**
   * Uninstall a CLI via mise and remove its configuration.
   */
  "clis.uninstall": async ({ params, respond }) => {
    if (!validateClisUninstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.uninstall params: ${formatValidationErrors(validateClisUninstallParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      shortName: string;
      version?: string;
    };

    // Uninstall via mise (best effort)
    await uninstallMiseTool(p.shortName, p.version);

    // Remove from config
    const cfg = loadConfig();
    const clis = cfg.clis ? { ...cfg.clis } : {};
    const entries = clis.entries ? { ...clis.entries } : {};

    delete entries[p.shortName];
    clis.entries = entries;

    const nextConfig: ClawdbotConfig = {
      ...cfg,
      clis,
    };

    await writeConfigFile(nextConfig);

    respond(true, { ok: true, shortName: p.shortName }, undefined);
  },

  /**
   * Update a CLI's configuration (description, examples, enabled).
   */
  "clis.update": async ({ params, respond }) => {
    if (!validateClisUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.update params: ${formatValidationErrors(validateClisUpdateParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as {
      shortName: string;
      description?: string;
      examples?: string[];
      enabled?: boolean;
    };

    const cfg = loadConfig();
    const clis = cfg.clis ? { ...cfg.clis } : {};
    const entries = clis.entries ? { ...clis.entries } : {};
    const current = entries[p.shortName];

    if (!current) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `CLI "${p.shortName}" not found in configuration`,
        ),
      );
      return;
    }

    const updated: ExternalCliEntry = { ...current };

    if (typeof p.description === "string") {
      updated.description = p.description;
    }
    if (Array.isArray(p.examples)) {
      updated.examples = p.examples;
    }
    if (typeof p.enabled === "boolean") {
      updated.enabled = p.enabled;
    }

    entries[p.shortName] = updated;
    clis.entries = entries;

    const nextConfig: ClawdbotConfig = {
      ...cfg,
      clis,
    };

    await writeConfigFile(nextConfig);

    respond(
      true,
      { ok: true, shortName: p.shortName, entry: updated },
      undefined,
    );
  },

  /**
   * Get the status of all configured CLIs plus mise-installed CLIs.
   */
  "clis.status": async ({ params, respond }) => {
    if (!validateClisStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid clis.status params: ${formatValidationErrors(validateClisStatusParams.errors)}`,
        ),
      );
      return;
    }

    const miseAvailable = await isMiseAvailable();
    const installedTools = miseAvailable ? await listMiseInstalledTools() : [];

    // Build a map of installed tools for quick lookup
    const installedMap = new Map<string, string>();
    for (const tool of installedTools) {
      // Keep the latest/active version
      if (!installedMap.has(tool.name) || tool.active) {
        installedMap.set(tool.name, tool.version);
      }
    }

    const cfg = loadConfig();
    const entries = cfg.clis?.entries ?? {};

    // Start with configured CLIs
    const clis: CliStatusEntry[] = Object.entries(entries).map(
      ([shortName, entry]) => ({
        shortName,
        misePackage: entry.misePackage,
        installedVersion: installedMap.get(shortName),
        description: entry.description,
        examples: entry.examples,
        enabled: entry.enabled ?? true,
        isInstalled: installedMap.has(shortName),
        isConfigured: true,
      }),
    );

    // Add mise-installed CLIs that aren't in config yet
    const configuredNames = new Set(Object.keys(entries));
    for (const [name, version] of installedMap) {
      if (!configuredNames.has(name)) {
        clis.push({
          shortName: name,
          misePackage: name,
          installedVersion: version,
          description: "",
          examples: undefined,
          enabled: false,
          isInstalled: true,
          isConfigured: false,
        });
      }
    }

    // Sort: configured first, then by name
    clis.sort((a, b) => {
      if (a.isConfigured !== b.isConfigured) {
        return a.isConfigured ? -1 : 1;
      }
      return a.shortName.localeCompare(b.shortName);
    });

    const report: ClisStatusReport = {
      miseAvailable,
      clis,
    };

    respond(true, report, undefined);
  },
};
