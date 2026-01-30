/**
 * Feishu bot core logic
 * @module feishu/bot
 */

import * as lark from "@larksuiteoapi/node-sdk";

import type { OpenClawConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";

import { resolveFeishuAccount } from "./accounts.js";
import { handleFeishuWebhookEvents } from "./bot-handlers.js";
import type { FeishuInboundContext, ResolvedFeishuAccount } from "./types.js";

export interface FeishuBotOptions {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  accountId?: string;
  runtime?: RuntimeEnv;
  config?: OpenClawConfig;
  mediaMaxMb?: number;
  /** Use long connection mode instead of webhook */
  useLongConnection?: boolean;
  onMessage?: (ctx: FeishuInboundContext) => Promise<void>;
}

export interface FeishuBot {
  /** Lark SDK client for API calls */
  client: lark.Client;
  /** Event dispatcher for webhook events */
  eventDispatcher: lark.EventDispatcher;
  /** Resolved account configuration */
  account: ResolvedFeishuAccount;
  /** Start long connection mode (if enabled) */
  startLongConnection?: () => Promise<void>;
}

/**
 * Create a Feishu bot instance
 */
export function createFeishuBot(opts: FeishuBotOptions): FeishuBot {
  const runtime: RuntimeEnv = opts.runtime ?? {
    log: console.log,
    error: console.error,
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };

  const cfg = opts.config ?? loadConfig();

  // Resolve account (will use opts credentials if provided)
  const account = resolveFeishuAccount({
    cfg: {
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: {
          ...cfg.channels?.feishu,
          appId: opts.appId,
          appSecret: opts.appSecret,
          encryptKey: opts.encryptKey,
          verificationToken: opts.verificationToken,
        },
      },
    },
    accountId: opts.accountId,
  });

  const mediaMaxBytes = (opts.mediaMaxMb ?? account.config.mediaMaxMb ?? 10) * 1024 * 1024;

  // Create Lark SDK client
  const client = new lark.Client({
    appId: account.appId,
    appSecret: account.appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu, // Use Feishu domain (not Lark)
  });

  // Default message processor
  const processMessage =
    opts.onMessage ??
    (async () => {
      logVerbose("feishu: no message handler configured");
    });

  // Create event dispatcher
  const eventDispatcher = new lark.EventDispatcher({
    encryptKey: account.encryptKey,
    verificationToken: account.verificationToken,
  });

  // Register message receive event handler
  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      logVerbose(`feishu: received message event: ${data.message.message_id}`);

      await handleFeishuWebhookEvents(
        {
          event: data as any,
          eventType: "im.message.receive_v1",
        },
        {
          cfg,
          account,
          runtime,
          client,
          mediaMaxBytes,
          processMessage,
        },
      );
    },
  });

  const bot: FeishuBot = {
    client,
    eventDispatcher,
    account,
  };

  // Add long connection support if enabled
  if (opts.useLongConnection ?? account.config.useLongConnection) {
    bot.startLongConnection = async () => {
      logVerbose("feishu: starting long connection mode...");

      const wsClient = new lark.WSClient({
        appId: account.appId,
        appSecret: account.appSecret,
        loggerLevel: lark.LoggerLevel.info,
      });

      await wsClient.start({ eventDispatcher });
      logVerbose("feishu: long connection established");
    };
  }

  return bot;
}

/**
 * Create Feishu bot from resolved account
 */
export function createFeishuBotFromAccount(
  account: ResolvedFeishuAccount,
  opts?: {
    runtime?: RuntimeEnv;
    config?: OpenClawConfig;
    onMessage?: (ctx: FeishuInboundContext) => Promise<void>;
  },
): FeishuBot {
  return createFeishuBot({
    appId: account.appId,
    appSecret: account.appSecret,
    encryptKey: account.encryptKey,
    verificationToken: account.verificationToken,
    accountId: account.accountId,
    runtime: opts?.runtime,
    config: opts?.config,
    useLongConnection: account.config.useLongConnection,
    onMessage: opts?.onMessage,
  });
}
