import { html, nothing } from "lit";

import { t } from "../../i18n";
import { formatAgo } from "../format";
import type { DiscordStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">Discord</div>
      <div class="card-sub">${t("channels.discord.desc")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${discord?.configured ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${discord?.running ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("channels.discord.lastStart")}</span>
          <span>${discord?.lastStartAt ? formatAgo(discord.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.discord.lastProbe")}</span>
          <span>${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${discord?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${discord.lastError}
          </div>`
        : nothing}

      ${discord?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.discord.probe")} ${discord.probe.ok ? t("channels.discord.probeOk") : t("channels.discord.probeFailed")} ·
            ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "discord", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.discord.probe")}
        </button>
      </div>
    </div>
  `;
}
