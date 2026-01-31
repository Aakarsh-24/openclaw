/**
 * Agent settings configuration content component
 * Right panel - Agent default parameters + session model management
 */
import { html, nothing } from "lit";
import type { AgentDefaults } from "../views/model-config";
import type { SessionRow, SessionsListResult } from "../controllers/model-config";
import { t } from "../i18n";

// ─────────────────────────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────────────────────────

const icons = {
  agent: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path><circle cx="8" cy="14" r="1"></circle><circle cx="16" cy="14" r="1"></circle></svg>`,
  settings: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  sessions: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  refresh: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type AgentContentProps = {
  agentDefaults: AgentDefaults;
  availableModels: Array<{ id: string; name: string; provider: string }>;
  onAgentDefaultsUpdate: (path: string[], value: unknown) => void;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  onSessionsRefresh: () => void;
  onSessionModelChange: (sessionKey: string, model: string | null) => void;
  onSessionNavigate: (sessionKey: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format timestamp to relative time
 */
function formatAgo(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { count: days });
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a single session row
 */
function renderSessionRow(
  session: SessionRow,
  availableModels: AgentContentProps["availableModels"],
  defaultModel: { provider: string | null; model: string | null },
  onModelChange: (sessionKey: string, model: string | null) => void,
  onNavigate: (sessionKey: string) => void,
) {
  const displayName = session.displayName ?? session.label ?? session.key;
  const currentModel = session.model
    ? `${session.modelProvider ?? ""}/${session.model}`.replace(/^\//, "")
    : "";
  const defaultModelId = defaultModel.model
    ? `${defaultModel.provider ?? ""}/${defaultModel.model}`.replace(/^\//, "")
    : "";

  return html`
    <div class="session-row">
      <div class="session-row__key" title=${session.key}>
        <a
          class="session-row__link"
          href="javascript:void(0)"
          @click=${(e: Event) => {
            e.preventDefault();
            onNavigate(session.key);
          }}
        >${displayName}</a>
        ${session.kind !== "direct"
          ? html`<span class="session-row__kind">${session.kind}</span>`
          : nothing}
      </div>
      <div class="session-row__model">
        <select
          class="mc-select mc-select--sm"
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onModelChange(session.key, value || null);
          }}
        >
          <option value="" ?selected=${!currentModel}>${t('agent.inheritDefault')}${defaultModelId ? ` (${defaultModelId})` : ""}</option>
          ${availableModels.map(
            (m) => html`<option value=${m.id} ?selected=${m.id === currentModel}>${m.name} (${m.provider})</option>`,
          )}
        </select>
      </div>
      <div class="session-row__updated">
        ${session.updatedAt ? formatAgo(session.updatedAt) : "-"}
      </div>
    </div>
  `;
}

/**
 * Render sessions list
 */
function renderSessionsList(props: AgentContentProps) {
  const sessions = props.sessionsResult?.sessions ?? [];
  const defaults = props.sessionsResult?.defaults ?? { modelProvider: null, model: null };

  return html`
    <div class="mc-section">
      <div class="mc-section__header">
        <div class="mc-section__icon">${icons.sessions}</div>
        <div class="mc-section__titles">
          <h3 class="mc-section__title">${t('agent.sessions.title')}</h3>
          <p class="mc-section__desc">${t('agent.sessions.desc')}</p>
        </div>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.sessionsLoading}
          @click=${props.onSessionsRefresh}
          title=${t('action.refresh')}
        >
          ${icons.refresh}
          ${props.sessionsLoading ? t('label.loading') : t('action.refresh')}
        </button>
      </div>

      ${props.sessionsError
        ? html`<div class="mc-error">${props.sessionsError}</div>`
        : nothing}

      <div class="sessions-list">
        ${sessions.length > 0
          ? html`
              <div class="sessions-list__header">
                <div class="sessions-list__col sessions-list__col--key">${t('agent.sessionKey')}</div>
                <div class="sessions-list__col sessions-list__col--model">${t('agent.sessionModel')}</div>
                <div class="sessions-list__col sessions-list__col--updated">${t('agent.lastUpdated')}</div>
              </div>
              <div class="sessions-list__body">
                ${sessions.map((session) =>
                  renderSessionRow(session, props.availableModels, defaults, props.onSessionModelChange, props.onSessionNavigate),
                )}
              </div>
            `
          : html`<div class="mc-empty">${props.sessionsLoading ? t('label.loading') : t('agent.noSessions')}</div>`}
      </div>
    </div>
  `;
}

/**
 * Render default parameters settings
 */
function renderDefaultsSection(props: AgentContentProps) {
  const defaults = props.agentDefaults;

  return html`
    <div class="mc-section">
      <div class="mc-section__header">
        <div class="mc-section__icon">${icons.settings}</div>
        <div class="mc-section__titles">
          <h3 class="mc-section__title">${t('agent.defaults.title')}</h3>
          <p class="mc-section__desc">${t('agent.defaults.desc')}</p>
        </div>
      </div>
      <div class="mc-card">
        <div class="mc-card__content">
          <!-- Model and workspace -->
          <div class="mc-form-row mc-form-row--2col">
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.primaryModel')}</span>
              <select
                class="mc-select"
                @change=${(e: Event) =>
                  props.onAgentDefaultsUpdate(
                    ["model", "primary"],
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                <option value="" ?selected=${!defaults.model?.primary}>-- ${t('agent.selectModel')} --</option>
                ${props.availableModels.map(
                  (m) => html`<option value=${m.id} ?selected=${m.id === defaults.model?.primary}>${m.name} (${m.provider})</option>`,
                )}
              </select>
            </label>
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.workspace')}</span>
              <input
                type="text"
                class="mc-input"
                .value=${defaults.workspace ?? ""}
                placeholder="/path/to/workspace"
                @input=${(e: Event) =>
                  props.onAgentDefaultsUpdate(["workspace"], (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
          <!-- Concurrency settings -->
          <div class="mc-form-row mc-form-row--2col">
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.maxConcurrent')}</span>
              <input
                type="number"
                class="mc-input"
                .value=${String(defaults.maxConcurrent ?? 4)}
                min="1"
                max="32"
                @input=${(e: Event) =>
                  props.onAgentDefaultsUpdate(
                    ["maxConcurrent"],
                    Number((e.target as HTMLInputElement).value),
                  )}
              />
            </label>
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.subagentsConcurrent')}</span>
              <input
                type="number"
                class="mc-input"
                .value=${String(defaults.subagents?.maxConcurrent ?? 8)}
                min="1"
                max="32"
                @input=${(e: Event) =>
                  props.onAgentDefaultsUpdate(
                    ["subagents", "maxConcurrent"],
                    Number((e.target as HTMLInputElement).value),
                  )}
              />
            </label>
          </div>
          <!-- Context management -->
          <div class="mc-form-row mc-form-row--2col">
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.contextPruning')}</span>
              <select
                class="mc-select"
                .value=${defaults.contextPruning?.mode ?? "cache-ttl"}
                @change=${(e: Event) =>
                  props.onAgentDefaultsUpdate(
                    ["contextPruning", "mode"],
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                <option value="cache-ttl">${t('agent.pruneCacheTtl')}</option>
                <option value="token-limit">${t('agent.pruneTokenLimit')}</option>
              </select>
            </label>
            <label class="mc-field">
              <span class="mc-field__label">${t('agent.compaction')}</span>
              <select
                class="mc-select"
                .value=${defaults.compaction?.mode ?? "safeguard"}
                @change=${(e: Event) =>
                  props.onAgentDefaultsUpdate(
                    ["compaction", "mode"],
                    (e.target as HTMLSelectElement).value,
                  )}
              >
                <option value="safeguard">${t('agent.compactSafeguard')}</option>
                <option value="aggressive">${t('agent.compactAggressive')}</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Render Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render Agent settings content
 */
export function renderAgentContent(props: AgentContentProps) {
  return html`
    <div class="config-content">
      <div class="config-content__header">
        <div class="config-content__icon">${icons.agent}</div>
        <div class="config-content__titles">
          <h2 class="config-content__title">${t('agent.title')}</h2>
          <p class="config-content__desc">${t('agent.desc')}</p>
        </div>
      </div>
      <div class="config-content__body">
        <!-- Default settings section -->
        ${renderDefaultsSection(props)}

        <!-- Session model management -->
        ${renderSessionsList(props)}
      </div>
    </div>
  `;
}
