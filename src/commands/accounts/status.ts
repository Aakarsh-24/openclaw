/**
 * Multi-Account Status Command
 */

import type { RuntimeEnv } from "../../runtime.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { resolveClawdbotAgentDir } from "../../agents/agent-paths.js";
import {
  getMultiAccountStatus,
  getOrCreateManager,
  isMultiAccountEnabled,
} from "../../agents/multi-account/index.js";
import { loadConfig } from "../../config/config.js";

export interface AccountsStatusOptions {
  provider?: string;
  json?: boolean;
}

export async function accountsStatusCommand(
  runtime: RuntimeEnv,
  options: AccountsStatusOptions
): Promise<void> {
  const cfg = loadConfig();
  const agentDir = resolveClawdbotAgentDir();
  const authStore = ensureAuthProfileStore(agentDir);
  const provider = options.provider ?? "google-antigravity";

  if (!isMultiAccountEnabled(provider, cfg)) {
    runtime.log(
      `Multi-account is not enabled for ${provider}.\n` +
        `Enable it in config:\n` +
        `  auth:\n` +
        `    multiAccount:\n` +
        `      enabled: true\n` +
        `      providers:\n` +
        `        - ${provider}`
    );
    return;
  }

  // Initialize manager to get status
  await getOrCreateManager(provider, authStore, cfg);
  const status = getMultiAccountStatus();
  const providerStatus = status[provider];

  if (!providerStatus) {
    runtime.log(`No multi-account data for ${provider}.`);
    return;
  }

  if (options.json) {
    runtime.log(JSON.stringify(providerStatus, null, 2));
    return;
  }

  // Pretty print
  runtime.log(`\n📊 Multi-Account Status: ${provider}`);
  runtime.log(`${"─".repeat(40)}`);
  runtime.log(`Accounts: ${providerStatus.summary}`);
  runtime.log(`  Available: ${providerStatus.available}`);
  runtime.log(`  Rate-limited: ${providerStatus.rateLimited}`);
  runtime.log(`  Invalid: ${providerStatus.invalid}`);
  runtime.log("");

  if (providerStatus.accounts.length > 0) {
    runtime.log("Account Details:");
    for (const acc of providerStatus.accounts) {
      const status = acc.isInvalid
        ? `❌ Invalid (${acc.invalidReason})`
        : `✅ Health: ${acc.healthScore}`;
      const lastUsed = acc.lastUsed
        ? new Date(acc.lastUsed).toLocaleTimeString()
        : "never";
      runtime.log(`  • ${acc.email}`);
      runtime.log(`    Status: ${status}`);
      runtime.log(`    Last used: ${lastUsed}`);
    }
  }
}
