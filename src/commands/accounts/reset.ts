/**
 * Multi-Account Reset Command
 */

import type { RuntimeEnv } from "../../runtime.js";
import { resetManagerState, getManager } from "../../agents/multi-account/index.js";

export interface AccountsResetOptions {
  provider?: string;
}

export async function accountsResetCommand(
  runtime: RuntimeEnv,
  options: AccountsResetOptions
): Promise<void> {
  const provider = options.provider ?? "google-antigravity";

  const manager = getManager(provider);
  if (!manager) {
    runtime.log(`No active multi-account manager for ${provider}.`);
    runtime.log(`The manager is created when the first request is made.`);
    return;
  }

  resetManagerState(provider);
  runtime.log(`✅ Reset rate limits for ${provider}`);
  runtime.log(`All accounts are now available for selection.`);
}
