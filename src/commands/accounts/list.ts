/**
 * Multi-Account List Command
 */

import type { RuntimeEnv } from "../../runtime.js";
import { ensureAuthProfileStore, listProfilesForProvider } from "../../agents/auth-profiles.js";
import { resolveClawdbotAgentDir } from "../../agents/agent-paths.js";
import { loadConfig } from "../../config/config.js";
import { isMultiAccountEnabled } from "../../agents/multi-account/index.js";

export interface AccountsListOptions {
  provider?: string;
  json?: boolean;
}

export async function accountsListCommand(
  runtime: RuntimeEnv,
  options: AccountsListOptions
): Promise<void> {
  const cfg = loadConfig();
  const agentDir = resolveClawdbotAgentDir();
  const authStore = ensureAuthProfileStore(agentDir);
  const provider = options.provider ?? "google-antigravity";

  const profiles = listProfilesForProvider(authStore, provider);

  if (profiles.length === 0) {
    runtime.log(`No accounts found for provider: ${provider}`);
    return;
  }

  const multiAccountEnabled = isMultiAccountEnabled(provider, cfg);

  if (options.json) {
    const data = profiles.map((profileId) => {
      const profile = authStore.profiles[profileId];
      return {
        profileId,
        email: profile?.email ?? profileId,
        type: profile?.type,
        provider: profile?.provider,
      };
    });
    runtime.log(JSON.stringify(data, null, 2));
    return;
  }

  runtime.log(`\n📋 Accounts for ${provider}`);
  runtime.log(`${"─".repeat(40)}`);
  runtime.log(`Total: ${profiles.length}`);
  runtime.log(`Multi-account: ${multiAccountEnabled ? "✅ Enabled" : "❌ Disabled"}`);
  runtime.log("");

  for (const profileId of profiles) {
    const profile = authStore.profiles[profileId];
    const email = profile?.email ?? profileId;
    const type = profile?.type ?? "unknown";
    runtime.log(`  • ${email} (${type})`);
  }
}
