import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { telegramUserPlugin } from "./src/channel.js";
import { setTelegramUserRuntime } from "./src/runtime.js";

const plugin = {
  id: "telegram-user",
  name: "Telegram User",
  description: "Telegram MTProto user channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setTelegramUserRuntime(api.runtime);
    api.registerChannel({ plugin: telegramUserPlugin });
  },
};

export default plugin;
