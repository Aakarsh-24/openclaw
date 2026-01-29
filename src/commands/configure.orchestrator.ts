import { confirm, intro, outro, text } from "./configure.shared.js";
import { loadConfig, writeConfigFile } from "../config/io.js";
import type { RuntimeEnv } from "../runtime.js";
import { ORCHESTRATOR_DEFAULT_MODEL } from "../agents/orchestrator/config.js";

export async function runOrchestratorWizard(_runtime: RuntimeEnv) {
  intro("Orchestrator Configuration");

  const cfg = loadConfig();
  const orchestrator = cfg.orchestrator ?? {};

  const enabled = await confirm({
    message: "Enable smart orchestrator? (Intercepts messages and routes to best agent)",
    initialValue: orchestrator.enabled ?? false,
  });

  if (typeof enabled === "symbol") return;

  const model = await text({
    message: "Orchestrator Model",
    placeholder: ORCHESTRATOR_DEFAULT_MODEL,
    initialValue: orchestrator.model ?? ORCHESTRATOR_DEFAULT_MODEL,
  });

  if (typeof model === "symbol") return;

  const opencodeEnabled = await confirm({
    message: "Enable OpenCode Agent delegation?",
    initialValue: orchestrator.agents?.opencode?.enabled ?? true,
  });

  if (typeof opencodeEnabled === "symbol") return;

  const nextCfg = {
    ...cfg,
    orchestrator: {
      ...orchestrator,
      enabled,
      model,
      agents: {
        ...orchestrator.agents,
        opencode: {
          ...orchestrator.agents?.opencode,
          enabled: opencodeEnabled,
        },
      },
    },
  };

  await writeConfigFile(nextCfg);
  outro("Orchestrator configuration updated.");
}
