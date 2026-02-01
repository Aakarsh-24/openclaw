import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  CHANNEL_MESSAGE_ACTION_NAMES,
  type ChannelMessageActionName,
} from "../channels/plugins/types.js";
import { createOutboundSendDeps, type CliDeps } from "../cli/outbound-send-deps.js";
import { withProgress } from "../cli/progress.js";
import { loadConfig } from "../config/config.js";
import { runMessageAction } from "../infra/outbound/message-action-runner.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../utils/message-channel.js";
import { buildMessageCliJson, formatMessageCliText } from "./message-format.js";

export async function messageCommand(
  opts: Record<string, unknown>,
  deps: CliDeps,
  runtime: RuntimeEnv,
) {
  const cfg = loadConfig();
  const rawAction = typeof opts.action === "string" ? opts.action.trim() : "";
  const actionInput = rawAction || "send";
  const actionMatch = (CHANNEL_MESSAGE_ACTION_NAMES as readonly string[]).find(
    (name) => name.toLowerCase() === actionInput.toLowerCase(),
  );
  if (!actionMatch) {
    throw new Error(`Unknown message action: ${actionInput}`);
  }
  const action = actionMatch as ChannelMessageActionName;

  const outboundDeps: OutboundSendDeps = createOutboundSendDeps(deps);

  const run = async () => {
    const priorAllowAny = process.env.OPENCLAW_MEDIA_ALLOW_ANY_LOCAL;
    process.env.OPENCLAW_MEDIA_ALLOW_ANY_LOCAL = "1";
    try {
      return await runMessageAction({
        cfg,
        action,
        params: opts,
        deps: outboundDeps,
        gateway: {
          clientName: GATEWAY_CLIENT_NAMES.CLI,
          mode: GATEWAY_CLIENT_MODES.CLI,
        },
      });
    } finally {
      if (priorAllowAny === undefined) {
        delete process.env.OPENCLAW_MEDIA_ALLOW_ANY_LOCAL;
      } else {
        process.env.OPENCLAW_MEDIA_ALLOW_ANY_LOCAL = priorAllowAny;
      }
    }
  };

  const json = opts.json === true;
  const dryRun = opts.dryRun === true;
  const needsSpinner = !json && !dryRun && (action === "send" || action === "poll");

  const result = needsSpinner
    ? await withProgress(
        {
          label: action === "poll" ? "Sending poll..." : "Sending...",
          indeterminate: true,
          enabled: true,
        },
        run,
      )
    : await run();

  if (json) {
    runtime.log(JSON.stringify(buildMessageCliJson(result), null, 2));
    return;
  }

  for (const line of formatMessageCliText(result)) {
    runtime.log(line);
  }
}
