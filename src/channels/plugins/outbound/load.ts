import type { PluginRegistry } from "../../../plugins/registry.js";
import type { ChannelId, ChannelOutboundAdapter } from "../types.js";
import { getActivePluginRegistry } from "../../../plugins/runtime.js";

// Static fallback adapters for channels not registered via plugin system
import { telegramOutbound } from "./telegram.js";
import { discordOutbound } from "./discord.js";
import { slackOutbound } from "./slack.js";
import { whatsappOutbound } from "./whatsapp.js";
import { signalOutbound } from "./signal.js";
import { imessageOutbound } from "./imessage.js";

const STATIC_OUTBOUND: Partial<Record<ChannelId, ChannelOutboundAdapter>> = {
  telegram: telegramOutbound,
  discord: discordOutbound,
  slack: slackOutbound,
  whatsapp: whatsappOutbound,
  signal: signalOutbound,
  imessage: imessageOutbound,
};

// Channel docking: outbound sends should stay cheap to import.
//
// The full channel plugins (src/channels/plugins/*.ts) pull in status,
// onboarding, gateway monitors, etc. Outbound delivery only needs chunking +
// send primitives, so we keep a dedicated, lightweight loader here.
const cache = new Map<ChannelId, ChannelOutboundAdapter>();
let lastRegistry: PluginRegistry | null = null;

function ensureCacheForRegistry(registry: PluginRegistry | null) {
  if (registry === lastRegistry) {
    return;
  }
  cache.clear();
  lastRegistry = registry;
}

export async function loadChannelOutboundAdapter(
  id: ChannelId,
): Promise<ChannelOutboundAdapter | undefined> {
  const registry = getActivePluginRegistry();
  ensureCacheForRegistry(registry);
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }
  // Check plugin registry first
  const pluginEntry = registry?.channels.find((entry) => entry.plugin.id === id);
  const outbound = pluginEntry?.plugin.outbound;
  if (outbound) {
    cache.set(id, outbound);
    return outbound;
  }
  // Fall back to static adapters for built-in channels
  const staticAdapter = STATIC_OUTBOUND[id];
  if (staticAdapter) {
    cache.set(id, staticAdapter);
    return staticAdapter;
  }
  return undefined;
}
