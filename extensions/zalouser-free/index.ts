/**
 * zalouser-free - Free Zalo Personal Account Plugin for OpenClaw
 * Uses zca-js library for communication
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createChannelPlugin, initSessionManager } from "./src/channel.js";
import { zalouserFreeOnboardingAdapter } from "./src/onboarding.js";
import { setZalouserFreeRuntime } from "./src/runtime.js";
import type { ZaloUserFreePluginConfig } from "./src/types.js";

const plugin = {
  id: "zalouser-free",
  name: "Zalo Personal (Free)",
  description: "Free Zalo personal account messaging via zca-js library",

  register(api: OpenClawPluginApi) {
    const logger = api.logger || console;
    logger.info?.("[zalouser-free] Registering plugin...");

    // Set runtime for dispatch access
    setZalouserFreeRuntime(api.runtime);

    // Initialize shared session manager
    const pluginConfig: ZaloUserFreePluginConfig = api.config?.plugins?.entries?.["zalouser-free"]?.config || {};
    const sessionManager = initSessionManager(pluginConfig.sessionPath, logger);
    sessionManager.setConfigProvider(() => api.config);

    // Create and register channel plugin
    const channelPlugin = createChannelPlugin(sessionManager, api);
    api.registerChannel({ plugin: channelPlugin });

    // Register onboarding adapter if available
    if (api.registerOnboarding) {
      api.registerOnboarding(zalouserFreeOnboardingAdapter);
    }

    logger.info?.("[zalouser-free] Plugin registered successfully");
  },
};

export default plugin;

// Export types and utilities
export * from "./src/types.js";
export { createChannelPlugin, getSessionManager } from "./src/channel.js";
export { zalouserFreeOnboardingAdapter } from "./src/onboarding.js";
export { ZaloSessionManager } from "./src/session-manager.js";
