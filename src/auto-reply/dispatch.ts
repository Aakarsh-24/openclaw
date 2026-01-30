import type { MoltbotConfig } from "../config/config.js";
import type { FinalizedMsgContext, MsgContext } from "./templating.js";
import type { GetReplyOptions } from "./types.js";
import { finalizeInboundContext } from "./reply/inbound-context.js";
import type { DispatchFromConfigResult } from "./reply/dispatch-from-config.js";
import { dispatchReplyFromConfig } from "./reply/dispatch-from-config.js";
import {
  createReplyDispatcher,
  createReplyDispatcherWithTyping,
  type ReplyDispatcher,
  type ReplyDispatcherOptions,
  type ReplyDispatcherWithTypingOptions,
} from "./reply/reply-dispatcher.js";
import { processSecretsInMessage } from "../security/process-secrets.js";
import {
  generatePromptKey,
  hasPendingPrompt,
  resolvePendingPrompt,
  parsePromptResponse,
} from "../security/interactive-prompts.js";

export type DispatchInboundResult = DispatchFromConfigResult;

export async function dispatchInboundMessage(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: MoltbotConfig;
  dispatcher: ReplyDispatcher;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const finalized = finalizeInboundContext(params.ctx);

  // Check if this user has a pending security prompt
  const channel = finalized.Provider || finalized.Surface || 'unknown';
  const senderId = finalized.SenderId || 'unknown';
  const promptKey = generatePromptKey(channel, senderId);

  if (hasPendingPrompt(promptKey)) {
    // This message is a response to a security prompt
    const body = finalized.Body || '';
    const parsedAction = parsePromptResponse(body);

    if (parsedAction) {
      // Valid response - resolve the pending prompt
      resolvePendingPrompt(promptKey, parsedAction);
      // Send confirmation
      await params.dispatcher.sendText(`✓ Applying action: ${parsedAction}`);
    } else {
      // Invalid response - send help message and keep the prompt pending
      await params.dispatcher.sendText(
        `❌ Invalid response. Please reply with **1**, **2**, **3**, or **4**.`,
      );
    }

    // Don't process this message further
    return {
      handled: true,
      replies: [],
      errors: [],
    };
  }

  // Process secrets before dispatching to agent
  const secretProcessing = await processSecretsInMessage(finalized, params.cfg, params.dispatcher);

  // If the message was blocked by the user (cancelled), don't proceed
  if (secretProcessing.blocked) {
    return {
      handled: true,
      replies: [],
      errors: [],
    };
  }

  // Use the updated context (with redacted/replaced secrets if applicable)
  return await dispatchReplyFromConfig({
    ctx: secretProcessing.ctx,
    cfg: params.cfg,
    dispatcher: params.dispatcher,
    replyOptions: params.replyOptions,
    replyResolver: params.replyResolver,
  });
}

export async function dispatchInboundMessageWithBufferedDispatcher(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: MoltbotConfig;
  dispatcherOptions: ReplyDispatcherWithTypingOptions;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping(
    params.dispatcherOptions,
  );

  const result = await dispatchInboundMessage({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcher,
    replyResolver: params.replyResolver,
    replyOptions: {
      ...params.replyOptions,
      ...replyOptions,
    },
  });

  markDispatchIdle();
  return result;
}

export async function dispatchInboundMessageWithDispatcher(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: MoltbotConfig;
  dispatcherOptions: ReplyDispatcherOptions;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const dispatcher = createReplyDispatcher(params.dispatcherOptions);
  const result = await dispatchInboundMessage({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcher,
    replyResolver: params.replyResolver,
    replyOptions: params.replyOptions,
  });
  await dispatcher.waitForIdle();
  return result;
}
