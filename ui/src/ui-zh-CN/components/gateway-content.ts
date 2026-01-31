/**
 * Gateway settings configuration content component
 * Right panel - Gateway port and authentication
 */
import { html } from "lit";
import type { GatewayConfig } from "../views/model-config";
import { t } from "../i18n";

// SVG icons
const icons = {
  gateway: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
};

export type GatewayContentProps = {
  gatewayConfig: GatewayConfig;
  onGatewayUpdate: (path: string[], value: unknown) => void;
};

/**
 * Render Gateway settings content
 */
export function renderGatewayContent(props: GatewayContentProps) {
  const gateway = props.gatewayConfig;

  return html`
    <div class="config-content">
      <div class="config-content__header">
        <div class="config-content__icon">${icons.gateway}</div>
        <div class="config-content__titles">
          <h2 class="config-content__title">${t('gateway.title')}</h2>
          <p class="config-content__desc">${t('gateway.desc')}</p>
        </div>
      </div>
      <div class="config-content__body">
        <div class="mc-card">
          <div class="mc-card__content">
            <div class="mc-form-row mc-form-row--2col">
              <label class="mc-field">
                <span class="mc-field__label">${t('gateway.port')}</span>
                <input
                  type="number"
                  class="mc-input"
                  .value=${String(gateway.port ?? 18789)}
                  min="1"
                  max="65535"
                  @input=${(e: Event) =>
                    props.onGatewayUpdate(["port"], Number((e.target as HTMLInputElement).value))}
                />
              </label>
              <label class="mc-field">
                <span class="mc-field__label">${t('gateway.bind')}</span>
                <select
                  class="mc-select"
                  .value=${gateway.bind ?? "loopback"}
                  @change=${(e: Event) =>
                    props.onGatewayUpdate(["bind"], (e.target as HTMLSelectElement).value)}
                >
                  <option value="loopback">${t('gateway.bind.loopback')}</option>
                  <option value="lan">${t('gateway.bind.lan')}</option>
                  <option value="auto">${t('gateway.bind.auto')}</option>
                </select>
              </label>
            </div>
            <div class="mc-form-row mc-form-row--2col">
              <label class="mc-field">
                <span class="mc-field__label">${t('gateway.auth.mode')}</span>
                <select
                  class="mc-select"
                  .value=${gateway.auth?.mode ?? "token"}
                  @change=${(e: Event) =>
                    props.onGatewayUpdate(["auth", "mode"], (e.target as HTMLSelectElement).value)}
                >
                  <option value="token">${t('gateway.auth.token')}</option>
                  <option value="password">${t('gateway.auth.password')}</option>
                  <option value="none">${t('gateway.auth.none')}</option>
                </select>
              </label>
              <label class="mc-field">
                <span class="mc-field__label">${t('gateway.auth.credential')}</span>
                <input
                  type="password"
                  class="mc-input"
                  .value=${gateway.auth?.token ?? ""}
                  placeholder="••••••••"
                  @input=${(e: Event) =>
                    props.onGatewayUpdate(["auth", "token"], (e.target as HTMLInputElement).value)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
