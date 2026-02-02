import { html, nothing } from "lit";
import type { WizardResult, WizardStep } from "../controllers/wizard";

export function renderSetup(state: {
  connected: boolean;
  wizardLoading: boolean;
  wizardSessionId: string | null;
  wizardStep: WizardStep | null;
  wizardError: string | null;
  wizardDone: boolean;
  wizardAnswer: unknown;
  onStart: () => void;
  onCancel: () => void;
  onNext: () => void;
  onAnswer: (value: unknown) => void;

  toolsBusy: boolean;
  toolsError: string | null;
  toolsMessage: string | null;
  doctorBusy: boolean;
  doctorOutput: string | null;
  doctorError: string | null;
  onDownloadConfig: () => void;
  onImportConfig: (file: File) => void;
  onRunDoctor: () => void;
}) {
  const step = state.wizardStep;

  return html`
    <div class="panel">
      <div class="panel__header">
        <div>
          <div class="h2">Configure Wizard</div>
          <div class="muted">Replaces scary CLI prompts with a guided UI.</div>
        </div>
        <div class="row">
          <button class="btn" ?disabled=${!state.connected || state.wizardLoading} @click=${state.onStart}>
            ${state.wizardSessionId ? "Restart" : "Start"}
          </button>
          <button class="btn btn--secondary" ?disabled=${!state.wizardSessionId || state.wizardLoading} @click=${state.onCancel}>
            Cancel
          </button>
        </div>
      </div>

      ${state.wizardError ? html`<div class="pill danger">${state.wizardError}</div>` : nothing}

      ${state.wizardDone
        ? html`<div class="card"><div class="h3">Done</div><div class="muted">Config saved.</div></div>`
        : nothing}

      ${step
        ? html`<div class="card">
            ${step.title ? html`<div class="h3">${step.title}</div>` : nothing}
            ${step.message ? html`<div class="muted" style="white-space: pre-wrap">${step.message}</div>` : nothing}

            <div style="margin-top: 12px">
              ${renderStepInput(step, state.wizardAnswer, state.onAnswer)}
            </div>

            <div class="row" style="margin-top: 12px">
              <button class="btn" ?disabled=${state.wizardLoading} @click=${state.onNext}>Next</button>
            </div>
          </div>`
        : html`<div class="card"><div class="muted">Start the wizard to configure OpenClaw.</div></div>`}

      <div class="card">
        <div class="panel__header" style="padding: 0; margin-bottom: 12px">
          <div>
            <div class="h3">Config tools</div>
            <div class="muted">Export/import config and run doctor.</div>
          </div>
          <div class="row">
            <button class="btn" ?disabled=${!state.connected || state.toolsBusy} @click=${state.onDownloadConfig}>
              Download openclaw.json
            </button>
            <label class="btn btn--secondary" style="cursor:pointer">
              Import openclaw.json
              <input
                type="file"
                accept="application/json,.json,.json5,text/plain"
                style="display:none"
                @change=${(e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) state.onImportConfig(file);
                  (e.target as HTMLInputElement).value = "";
                }}
              />
            </label>
          </div>
        </div>

        ${state.toolsError ? html`<div class="pill danger">${state.toolsError}</div>` : nothing}
        ${state.toolsMessage ? html`<div class="pill">${state.toolsMessage}</div>` : nothing}

        <div class="row" style="margin-top: 10px">
          <button class="btn" ?disabled=${!state.connected || state.doctorBusy} @click=${state.onRunDoctor}>
            Run doctor (non-interactive)
          </button>
        </div>

        ${state.doctorError ? html`<div class="pill danger" style="margin-top: 10px">${state.doctorError}</div>` : nothing}

        ${state.doctorOutput
          ? html`<pre class="code" style="margin-top: 10px; max-height: 340px; overflow:auto; white-space: pre-wrap">${state.doctorOutput}</pre>`
          : html`<div class="muted" style="margin-top: 10px">Doctor output will appear here.</div>`}
      </div>
    </div>
  `;
}

function renderStepInput(step: WizardStep, value: unknown, onAnswer: (v: unknown) => void) {
  if (step.type === "note") {
    return html`<div class="muted">(Read and click Next)</div>`;
  }

  if (step.type === "confirm") {
    const checked = Boolean(value ?? step.initialValue);
    return html`<label class="row" style="gap: 10px">
      <input type="checkbox" .checked=${checked} @change=${(e: Event) => onAnswer((e.target as HTMLInputElement).checked)} />
      <span>${step.message ?? "Confirm"}</span>
    </label>`;
  }

  if (step.type === "text") {
    const str = String(value ?? step.initialValue ?? "");
    return html`<input
      class="input"
      type=${step.sensitive ? "password" : "text"}
      .value=${str}
      placeholder=${step.placeholder ?? ""}
      @input=${(e: Event) => onAnswer((e.target as HTMLInputElement).value)}
    />`;
  }

  if (step.type === "select") {
    const options = step.options ?? [];
    const selected = value ?? step.initialValue ?? options[0]?.value;
    return html`<select class="input" @change=${(e: Event) => onAnswer((e.target as HTMLSelectElement).value)}>
      ${options.map((opt) => {
        const isSel = String(opt.value) === String(selected);
        return html`<option value=${String(opt.value)} ?selected=${isSel}>${opt.label}</option>`;
      })}
    </select>`;
  }

  if (step.type === "multiselect") {
    const options = step.options ?? [];
    const selectedSet = new Set(Array.isArray(value) ? value.map(String) : (Array.isArray(step.initialValue) ? (step.initialValue as any[]).map(String) : []));
    return html`<div class="col" style="gap: 8px">
      ${options.map((opt) => {
        const key = String(opt.value);
        const checked = selectedSet.has(key);
        return html`<label class="row" style="gap: 10px">
          <input
            type="checkbox"
            .checked=${checked}
            @change=${(e: Event) => {
              const next = new Set(selectedSet);
              const on = (e.target as HTMLInputElement).checked;
              if (on) next.add(key);
              else next.delete(key);
              onAnswer([...next.values()]);
            }}
          />
          <span>${opt.label}</span>
          ${opt.hint ? html`<span class="muted">${opt.hint}</span>` : nothing}
        </label>`;
      })}
    </div>`;
  }

  return html`<div class="muted">Unsupported step: ${step.type}</div>`;
}
