import { dispatchInboundMessage } from "../auto-reply/dispatch.js";
import { finalizeInboundContext } from "../auto-reply/reply/inbound-context.js";
import { createReplyDispatcherWithTyping } from "../auto-reply/reply/reply-dispatcher.js";
import { resolveAgentRoute } from "../routing/resolve-route.js";
import type { MsgContext } from "../auto-reply/templating.js";
import type { ZoomMonitorContext } from "./context.js";
import { danger } from "../globals.js";

type ZoomMessage = {
  userJid: string;
  userName: string;
  cmd: string;
  accountId: string;
  toJid: string;
  timestamp: number;
};

export async function handleZoomMessage(params: {
  ctx: ZoomMonitorContext;
  message: ZoomMessage;
  sendReply: (message: string) => Promise<void>;
}): Promise<void> {
  const { ctx, message, sendReply } = params;
  const { cfg, runtime, account } = ctx;

  // Resolve agent route
  const route = resolveAgentRoute({
    cfg,
    channel: "zoom",
    accountId: account.accountId,
  });

  // Build message context (like Slack's prepareSlackMessage)
  const msgCtx: MsgContext = {
    // Required fields
    From: message.userJid,
    SenderName: message.userName,
    Body: message.cmd,

    // Computed fields
    SessionKey: route.sessionKey,
    AccountId: route.accountId,

    // Optional fields
    RawBody: message.cmd,
    CommandBody: message.cmd,
    BodyForAgent: message.cmd,
    BodyForCommands: message.cmd,
    ChatType: "direct",
    Provider: "zoom",
    Timestamp: message.timestamp,
  };

  // Finalize context (normalizes fields, adds computed properties)
  const ctxPayload = finalizeInboundContext(msgCtx);

  // Create reply dispatcher (like Slack's dispatchPreparedSlackMessage)
  const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping({
    deliver: async (payload) => {
      // Deliver reply back to Zoom
      const text = payload.text || "";

      if (text) {
        await sendReply(text);
      }
    },
    onError: (err, info) => {
      runtime.error?.(danger(`zoom ${info.kind} reply failed: ${String(err)}`));
    },
  });

  // Dispatch to clawdbot's core system (THE KEY CALL!)
  const { queuedFinal, counts } = await dispatchInboundMessage({
    ctx: ctxPayload,
    cfg,
    dispatcher,
    replyOptions,
  });

  markDispatchIdle();

  const anyReplyDelivered = queuedFinal || (counts.block ?? 0) > 0 || (counts.final ?? 0) > 0;

  if (anyReplyDelivered) {
    runtime.log(`zoom: Delivered ${counts.final ?? 0} reply(ies) to ${message.userName}`);
  }
}
