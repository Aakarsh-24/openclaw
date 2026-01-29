import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";
import { eigenCloudProvider } from "./src/provider.js";
import { createActionLogger } from "./src/action-logger.js";
import { createReceiptStore } from "./src/receipt-store.js";
import { registerBoltbotApi } from "./src/api.js";
import { registerDashboardRoutes } from "./src/dashboard-serve.js";

export default {
  id: "boltbot",
  name: "Boltbot — Trustless Hosting",
  description: "EigenCloud verification layer for Moltbot",
  configSchema: emptyPluginConfigSchema(),

  register(api: MoltbotPluginApi) {
    api.registerProvider(eigenCloudProvider);

    const store = createReceiptStore(process.env.BOLTBOT_RECEIPT_BACKEND);
    const logger = createActionLogger(store);
    api.on("after_tool_call", logger);

    registerBoltbotApi(api, store);
    registerDashboardRoutes(api);
  },
};
