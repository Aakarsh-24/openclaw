import type { GatewayBrowserClient } from "../gateway";
import type { ClisStatusReport, MiseRegistrySearchResult } from "../types";

export type ClisState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  clisLoading: boolean;
  clisReport: ClisStatusReport | null;
  clisError: string | null;
  clisBusyKey: string | null;
  clisSearchQuery: string;
  clisSearchResults: MiseRegistrySearchResult | null;
  clisSearchLoading: boolean;
  clisInstallForm: {
    shortName: string;
    description: string;
    examples: string;
  } | null;
};

export async function loadClisStatus(state: ClisState) {
  if (!state.client || !state.connected) return;
  if (state.clisLoading) return;
  state.clisLoading = true;
  state.clisError = null;
  try {
    const res = (await state.client.request("clis.status", {})) as
      | ClisStatusReport
      | undefined;
    if (res) state.clisReport = res;
  } catch (err) {
    state.clisError = String(err);
  } finally {
    state.clisLoading = false;
  }
}

export async function searchClisRegistry(
  state: ClisState,
  query: string,
) {
  if (!state.client || !state.connected) return;
  state.clisSearchQuery = query;
  state.clisSearchLoading = true;
  state.clisError = null;
  try {
    const res = (await state.client.request("clis.registry.search", {
      query,
      limit: 50,
    })) as MiseRegistrySearchResult | undefined;
    if (res) state.clisSearchResults = res;
  } catch (err) {
    state.clisError = String(err);
  } finally {
    state.clisSearchLoading = false;
  }
}

export function openInstallForm(state: ClisState, shortName: string) {
  state.clisInstallForm = {
    shortName,
    description: "",
    examples: "",
  };
}

export function closeInstallForm(state: ClisState) {
  state.clisInstallForm = null;
}

export function updateInstallForm(
  state: ClisState,
  field: "description" | "examples",
  value: string,
) {
  if (!state.clisInstallForm) return;
  state.clisInstallForm = {
    ...state.clisInstallForm,
    [field]: value,
  };
}

export async function installCli(state: ClisState) {
  if (!state.client || !state.connected) return;
  if (!state.clisInstallForm) return;

  const { shortName, description, examples } = state.clisInstallForm;
  if (!description.trim()) {
    state.clisError = "Description is required";
    return;
  }

  state.clisBusyKey = shortName;
  state.clisError = null;

  try {
    const examplesArray = examples
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);

    await state.client.request("clis.install", {
      shortName,
      description: description.trim(),
      examples: examplesArray.length > 0 ? examplesArray : undefined,
    });

    state.clisInstallForm = null;
    await loadClisStatus(state);
  } catch (err) {
    state.clisError = String(err);
  } finally {
    state.clisBusyKey = null;
  }
}

export async function uninstallCli(state: ClisState, shortName: string) {
  if (!state.client || !state.connected) return;

  state.clisBusyKey = shortName;
  state.clisError = null;

  try {
    await state.client.request("clis.uninstall", { shortName });
    await loadClisStatus(state);
  } catch (err) {
    state.clisError = String(err);
  } finally {
    state.clisBusyKey = null;
  }
}

export async function toggleCliEnabled(
  state: ClisState,
  shortName: string,
  enabled: boolean,
) {
  if (!state.client || !state.connected) return;

  state.clisBusyKey = shortName;
  state.clisError = null;

  try {
    await state.client.request("clis.update", { shortName, enabled });
    await loadClisStatus(state);
  } catch (err) {
    state.clisError = String(err);
  } finally {
    state.clisBusyKey = null;
  }
}
