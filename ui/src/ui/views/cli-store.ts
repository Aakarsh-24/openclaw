import { html, nothing } from "lit";

import type {
  CliStatusEntry,
  ClisStatusReport,
  MiseRegistryEntry,
  MiseRegistrySearchResult,
} from "../types";

export type CliInstallFormState = {
  shortName: string;
  description: string;
  examples: string;
} | null;

export type CliStoreProps = {
  loading: boolean;
  report: ClisStatusReport | null;
  error: string | null;
  searchQuery: string;
  searchResults: MiseRegistrySearchResult | null;
  searchLoading: boolean;
  busyKey: string | null;
  installForm: CliInstallFormState;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onOpenInstall: (shortName: string) => void;
  onCloseInstall: () => void;
  onUpdateInstallForm: (field: "description" | "examples", value: string) => void;
  onInstall: () => void;
  onUninstall: (shortName: string) => void;
  onToggle: (shortName: string, enabled: boolean) => void;
};

export function renderCliStore(props: CliStoreProps) {
  const clis = props.report?.clis ?? [];
  const miseAvailable = props.report?.miseAvailable ?? false;

  return html`
    ${props.installForm ? renderInstallModal(props) : nothing}

    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">CLIs</div>
          <div class="card-sub">
            Install CLIs via mise and describe when Clawdbot should use them.
          </div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${!miseAvailable && props.report
        ? html`
            <div class="callout warning" style="margin-top: 12px;">
              mise is not installed. Install it from
              <a href="https://mise.jdx.dev" target="_blank">mise.jdx.dev</a>
              to use the CLI Store.
            </div>
          `
        : nothing}

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}
    </section>

    ${miseAvailable || !props.report ? renderSearchSection(props) : nothing}
    ${renderInstalledSection(props, clis)}
  `;
}

function renderSearchSection(props: CliStoreProps) {
  const results = props.searchResults?.entries ?? [];
  const total = props.searchResults?.total ?? 0;

  return html`
    <section class="card">
      <div class="card-title">Search Registry</div>
      <div class="card-sub">
        Search ${total > 0 ? `${total}+` : "1000+"} CLIs available in the mise registry.
      </div>

      <div class="field" style="margin-top: 14px;">
        <span>Search</span>
        <input
          type="text"
          .value=${props.searchQuery}
          @input=${(e: Event) =>
            props.onSearch((e.target as HTMLInputElement).value)}
          placeholder="e.g., jq, ripgrep, uv..."
        />
      </div>

      ${props.searchLoading
        ? html`<div class="muted" style="margin-top: 12px;">Searching...</div>`
        : nothing}

      ${results.length > 0
        ? html`
            <div class="list" style="margin-top: 16px;">
              ${results.map((entry) => renderRegistryEntry(entry, props))}
            </div>
            ${total > results.length
              ? html`<div class="muted" style="margin-top: 8px;">
                  Showing ${results.length} of ${total} results
                </div>`
              : nothing}
          `
        : props.searchQuery && !props.searchLoading
          ? html`<div class="muted" style="margin-top: 12px;">No results found.</div>`
          : nothing}
    </section>
  `;
}

function renderRegistryEntry(entry: MiseRegistryEntry, props: CliStoreProps) {
  const busy = props.busyKey === entry.short;
  const isInstalled = props.report?.clis.some(
    (c) => c.shortName === entry.short,
  );

  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.short}</div>
        <div class="list-sub muted">${entry.backends.slice(0, 2).join(", ")}</div>
      </div>
      <div class="list-meta">
        ${isInstalled
          ? html`<span class="chip chip-ok">Installed</span>`
          : html`
              <button
                class="btn primary"
                ?disabled=${busy}
                @click=${() => props.onOpenInstall(entry.short)}
              >
                Install
              </button>
            `}
      </div>
    </div>
  `;
}

function renderInstalledSection(props: CliStoreProps, clis: CliStatusEntry[]) {
  const configured = clis.filter((c) => c.isConfigured);
  const unconfigured = clis.filter((c) => !c.isConfigured);

  return html`
    ${configured.length > 0
      ? html`
          <section class="card">
            <div class="card-title">Configured CLIs</div>
            <div class="card-sub">
              These CLIs are available to the agent with their descriptions.
            </div>
            <div class="list" style="margin-top: 16px;">
              ${configured.map((cli) => renderInstalledCli(cli, props))}
            </div>
          </section>
        `
      : nothing}

    ${unconfigured.length > 0
      ? html`
          <section class="card">
            <div class="card-title">Installed (not configured)</div>
            <div class="card-sub">
              These CLIs are installed via mise but need a description for the agent to use them.
            </div>
            <div class="list" style="margin-top: 16px;">
              ${unconfigured.map((cli) => renderUnconfiguredCli(cli, props))}
            </div>
          </section>
        `
      : nothing}

    ${configured.length === 0 && unconfigured.length === 0
      ? html`
          <section class="card">
            <div class="card-title">Installed CLIs</div>
            <div class="muted" style="margin-top: 8px;">
              No CLIs installed yet. Search and install CLIs above.
            </div>
          </section>
        `
      : nothing}
  `;
}

function renderUnconfiguredCli(cli: CliStatusEntry, props: CliStoreProps) {
  const busy = props.busyKey === cli.shortName;

  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${cli.shortName}</div>
        <div class="list-sub muted">Installed but needs a description</div>
        <div class="chip-row" style="margin-top: 6px;">
          ${cli.installedVersion
            ? html`<span class="chip">v${cli.installedVersion}</span>`
            : nothing}
          <span class="chip chip-warn">not configured</span>
        </div>
      </div>
      <div class="list-meta">
        <button
          class="btn primary"
          ?disabled=${busy}
          @click=${() => props.onOpenInstall(cli.shortName)}
        >
          Configure
        </button>
      </div>
    </div>
  `;
}

function renderInstalledCli(cli: CliStatusEntry, props: CliStoreProps) {
  const busy = props.busyKey === cli.shortName;

  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${cli.shortName}</div>
        <div class="list-sub">${cli.description}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${cli.misePackage}</span>
          ${cli.installedVersion
            ? html`<span class="chip">v${cli.installedVersion}</span>`
            : nothing}
          <span class="chip ${cli.enabled ? "chip-ok" : "chip-warn"}">
            ${cli.enabled ? "enabled" : "disabled"}
          </span>
          ${!cli.isInstalled
            ? html`<span class="chip chip-warn">not installed</span>`
            : nothing}
        </div>
        ${cli.examples && cli.examples.length > 0
          ? html`
              <div class="muted" style="margin-top: 6px; font-family: monospace; font-size: 12px;">
                ${cli.examples[0]}
              </div>
            `
          : nothing}
      </div>
      <div class="list-meta">
        <div class="row" style="gap: 8px;">
          <button
            class="btn"
            ?disabled=${busy}
            @click=${() => props.onToggle(cli.shortName, !cli.enabled)}
          >
            ${cli.enabled ? "Disable" : "Enable"}
          </button>
          <button
            class="btn"
            ?disabled=${busy}
            @click=${() => props.onUninstall(cli.shortName)}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderInstallModal(props: CliStoreProps) {
  const form = props.installForm;
  if (!form) return nothing;

  return html`
    <div class="modal-overlay" @click=${props.onCloseInstall}>
      <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
        <div class="modal-header">
          <div class="card-title">Install ${form.shortName}</div>
          <button class="btn" @click=${props.onCloseInstall}>Close</button>
        </div>

        <div class="modal-body">
          <p class="muted" style="margin-bottom: 16px;">
            Describe when Clawdbot should use this CLI. This helps the agent
            understand when to reach for this tool.
          </p>

          <label class="field">
            <span>Description *</span>
            <textarea
              rows="3"
              .value=${form.description}
              @input=${(e: Event) =>
                props.onUpdateInstallForm(
                  "description",
                  (e.target as HTMLTextAreaElement).value,
                )}
              placeholder="e.g., Use for JSON parsing and transformation"
            ></textarea>
          </label>

          <label class="field" style="margin-top: 12px;">
            <span>Examples (one per line)</span>
            <textarea
              rows="3"
              .value=${form.examples}
              @input=${(e: Event) =>
                props.onUpdateInstallForm(
                  "examples",
                  (e.target as HTMLTextAreaElement).value,
                )}
              placeholder="jq '.users[] | .name' data.json"
            ></textarea>
          </label>
        </div>

        <div class="modal-footer">
          <button class="btn" @click=${props.onCloseInstall}>Cancel</button>
          <button
            class="btn primary"
            ?disabled=${!form.description.trim() || props.busyKey === form.shortName}
            @click=${props.onInstall}
          >
            ${props.busyKey === form.shortName ? "Installing..." : "Install"}
          </button>
        </div>
      </div>
    </div>
  `;
}
