import type { ClawdbotConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

export async function setupInternalHooks(
  cfg: ClawdbotConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<ClawdbotConfig> {
  await prompter.note(
    [
      "Internal hooks let you automate actions when agent commands are issued.",
      "Example: Save session context to memory when you issue /new.",
      "",
      "Learn more: https://docs.clawd.bot/internal-hooks",
    ].join("\n"),
    "Internal Hooks",
  );

  const shouldConfigure = await prompter.confirm({
    message: "Enable session memory hook? (saves context on /new)",
    initialValue: true,
  });

  if (!shouldConfigure) {
    return cfg;
  }

  // Enable the session-memory hook
  const next: ClawdbotConfig = {
    ...cfg,
    hooks: {
      ...cfg.hooks,
      internal: {
        enabled: true,
        handlers: [
          {
            event: "command:new",
            module: "./hooks/handlers/session-memory.ts",
          },
        ],
      },
    },
  };

  await prompter.note(
    [
      "Session memory hook enabled.",
      "When you issue /new, session context will be saved to:",
      "  ~/.clawdbot/memory/sessions/<session-key>_<timestamp>.json",
      "",
      "You can disable or customize this later in your config:",
      "  hooks.internal.enabled = false",
    ].join("\n"),
    "Hook configured",
  );

  return next;
}
