/**
 * Accounts CLI - Multi-account management commands
 */

import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  accountsListCommand,
  accountsStatusCommand,
  accountsResetCommand,
} from "../commands/accounts/index.js";

function runAccountsCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerAccountsCli(program: Command) {
  const accounts = program
    .command("accounts")
    .description("Manage multi-account load balancing")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Multi-account distributes requests across multiple OAuth accounts for higher throughput.")}\n`
    );

  accounts
    .command("list")
    .description("List all accounts for a provider")
    .option("-p, --provider <provider>", "Provider name", "google-antigravity")
    .option("--json", "Output as JSON")
    .action((options) =>
      runAccountsCommand(() => accountsListCommand(defaultRuntime, options))
    );

  accounts
    .command("status")
    .description("Show multi-account status (health scores, rate limits)")
    .option("-p, --provider <provider>", "Provider name", "google-antigravity")
    .option("--json", "Output as JSON")
    .action((options) =>
      runAccountsCommand(() => accountsStatusCommand(defaultRuntime, options))
    );

  accounts
    .command("reset")
    .description("Reset rate limits for all accounts")
    .option("-p, --provider <provider>", "Provider name", "google-antigravity")
    .action((options) =>
      runAccountsCommand(() => accountsResetCommand(defaultRuntime, options))
    );

  return accounts;
}
