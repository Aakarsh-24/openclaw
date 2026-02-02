import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  processTextMessage,
  type ChannelPlugin,
  type ChannelStatusIssue,
  type OpenClawConfig,
  type LarkConfig,
  type ResolvedLarkAccount,
  type LarkChannelData,
  type LarkMessageEvent,
} from "openclaw/plugin-sdk";
import { getLarkRuntime } from "./runtime.js";
import { LarkConfigSchema } from "./config-schema.js";
import {
  normalizeLarkAccountId,
  resolveLarkAccount,
  resolveDefaultLarkAccountId,
  listLarkAccountIds,
  getLarkTenantAccessToken,
  sendLarkMessage,
  probeLarkBot,
  startLarkWebhookServer,
} from "./api.js";

// 飞书频道元数据
const meta = {
  id: "lark",
  label: "Lark (飞书)",
  selectionLabel: "Lark (飞书 Bot)",
  detailLabel: "飞书机器人",
  docsPath: "/channels/lark",
  docsLabel: "lark",
  blurb: "飞书机器人集成，支持单聊、群聊、富文本消息和卡片消息。",
  systemImage: "message.fill",
};

export const larkPlugin: ChannelPlugin<ResolvedLarkAccount> = {
  id: "lark",
  meta: {
    ...meta,
    quickstartAllowFrom: true,
  },

  // 配对配置
  pairing: {
    idLabel: "larkOpenId",
    normalizeAllowEntry: (entry) => {
      // 飞书 OpenID 规范化：移除前缀
      return entry.replace(/^lark:/i, "").trim();
    },
    notifyApproval: async ({ cfg, id }) => {
      const runtime = getLarkRuntime();
      const account = runtime.channel.lark.resolveLarkAccount({ cfg });
      if (!account.appId || !account.appSecret) {
        throw new Error("飞书应用凭证未配置");
      }
      const token = await getLarkTenantAccessToken(account.appId, account.appSecret);
      await sendLarkMessage(
        token,
        id,
        "text",
        JSON.stringify({ text: "OpenClaw: 您的访问已获批准。" }),
      );
    },
  },

  // 能力声明
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: true,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },

  // 重载配置
  reload: { configPrefixes: ["channels.lark"] },

  // 配置 Schema
  configSchema: buildChannelConfigSchema(LarkConfigSchema),

  // 配置操作
  config: {
    listAccountIds: (cfg) => listLarkAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveLarkAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultLarkAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            lark: {
              ...larkConfig,
              enabled,
            },
          },
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          lark: {
            ...larkConfig,
            accounts: {
              ...larkConfig.accounts,
              [accountId]: {
                ...larkConfig.accounts?.[accountId],
                enabled,
              },
            },
          },
        },
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        const { appId, appSecret, encryptKey, verificationToken, ...rest } = larkConfig;
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            lark: rest,
          },
        };
      }
      const accounts = { ...larkConfig.accounts };
      delete accounts[accountId];
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          lark: {
            ...larkConfig,
            accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
          },
        },
      };
    },
    isConfigured: (account) => Boolean(account.appId?.trim() && account.appSecret?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.appId?.trim() && account.appSecret?.trim()),
      tokenSource: account.tokenSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveLarkAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^lark:/i, "")),
  },

  // 安全配置
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg.channels?.lark as LarkConfig | undefined)?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.lark.accounts.${resolvedAccountId}.`
        : "channels.lark.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve lark <code>",
        normalizeEntry: (raw) => raw.replace(/^lark:/i, "").trim(),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = (cfg.channels?.defaults as { groupPolicy?: string } | undefined)
        ?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- 飞书群组: groupPolicy="open" 允许所有群成员触发。建议设置 channels.lark.groupPolicy="allowlist" + channels.lark.groupAllowFrom 限制发送者。`,
      ];
    },
  },

  // 群组配置
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      const account = resolveLarkAccount({ cfg, accountId });
      const groups = account.config.groups;
      if (!groups) {
        return false;
      }
      const groupConfig = groups[groupId] ?? groups["*"];
      return groupConfig?.requireMention ?? false;
    },
  },

  // 消息目标解析
  messaging: {
    normalizeTarget: (target) => {
      const trimmed = target.trim();
      if (!trimmed) {
        return null;
      }
      return trimmed.replace(/^lark:/i, "");
    },
    targetResolver: {
      looksLikeId: (id) => {
        const trimmed = id?.trim();
        if (!trimmed) {
          return false;
        }
        // 飞书 OpenID 通常是 32 位字符串
        // 群组 ID 是 32 位字符串
        return /^[a-zA-Z0-9_-]{20,}$/.test(trimmed) || /^lark:/i.test(trimmed);
      },
      hint: "<openId|chatId>",
    },
  },

  // 目录（联系人）
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  // 设置向导
  setup: {
    resolveAccountId: ({ accountId }) => normalizeLarkAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => {
      const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            lark: {
              ...larkConfig,
              name,
            },
          },
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          lark: {
            ...larkConfig,
            accounts: {
              ...larkConfig.accounts,
              [accountId]: {
                ...larkConfig.accounts?.[accountId],
                name,
              },
            },
          },
        },
      };
    },
    validateInput: ({ accountId, input }) => {
      const typedInput = input as {
        useEnv?: boolean;
        appId?: string;
        appSecret?: string;
      };
      if (typedInput.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "LARK_APP_ID/LARK_APP_SECRET 只能用于默认账号。";
      }
      if (!typedInput.useEnv && (!typedInput.appId || !typedInput.appSecret)) {
        return "飞书需要 appId 和 appSecret（或使用 --use-env）。";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const typedInput = input as {
        name?: string;
        useEnv?: boolean;
        appId?: string;
        appSecret?: string;
        encryptKey?: string;
        verificationToken?: string;
      };
      const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;

      const baseConfig = {
        ...(typedInput.name ? { name: typedInput.name } : {}),
        ...(typedInput.useEnv
          ? {}
          : {
              ...(typedInput.appId ? { appId: typedInput.appId } : {}),
              ...(typedInput.appSecret ? { appSecret: typedInput.appSecret } : {}),
              ...(typedInput.encryptKey ? { encryptKey: typedInput.encryptKey } : {}),
              ...(typedInput.verificationToken
                ? { verificationToken: typedInput.verificationToken }
                : {}),
            }),
      };

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            lark: {
              ...larkConfig,
              enabled: true,
              ...baseConfig,
            },
          },
        };
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          lark: {
            ...larkConfig,
            enabled: true,
            accounts: {
              ...larkConfig.accounts,
              [accountId]: {
                ...larkConfig.accounts?.[accountId],
                enabled: true,
                ...baseConfig,
              },
            },
          },
        },
      };
    },
  },

  // 出站消息发送
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => {
      const runtime = getLarkRuntime();
      return runtime.channel.text.chunkMarkdownText(text, limit);
    },
    textChunkLimit: 2000, // 飞书单条消息限制约 2000 字符
    sendPayload: async ({ to, payload, accountId, cfg }) => {
      const runtime = getLarkRuntime();
      const account = resolveLarkAccount({ cfg, accountId: accountId ?? DEFAULT_ACCOUNT_ID });
      const token = await getLarkTenantAccessToken(account.appId, account.appSecret);

      const larkData = (payload.channelData?.lark as LarkChannelData | undefined) ?? {};
      const quickReplies = larkData.quickReplies ?? [];

      let lastResult: { messageId: string; chatId: string } | null = null;

      // 处理文本内容
      const processed = payload.text
        ? processTextMessage(payload.text)
        : { text: "", richContent: null };

      // 发送卡片消息（如果有）
      if (larkData.card) {
        const result = await sendLarkMessage(token, to, "interactive_card", JSON.stringify(larkData.card));
        lastResult = { messageId: result.messageId, chatId: to };
      }

      // 发送媒体
      const mediaUrls = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
      for (const url of mediaUrls) {
        // 飞书图片消息
        // 需要先上传图片获取 image_key
        // 简化处理：发送文本链接
        const result = await sendLarkMessage(
          token,
          to,
          "text",
          JSON.stringify({ text: `📎 [媒体文件](${url})` }),
        );
        lastResult = { messageId: result.messageId, chatId: to };
      }

      // 分块发送文本
      if (processed.text) {
        const chunkLimit = 2000;
        const chunks = runtime.channel.text.chunkMarkdownText(processed.text, chunkLimit);

        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          const content = chunks[i];

          // 最后一条消息附加快捷回复
          if (isLast && quickReplies.length > 0) {
            // 飞书不支持原生 quickReplies，转换为选项列表
            const textWithOptions = `${content}\n\n💡 选项: ${quickReplies.join(" | ")}`;
            const result = await sendLarkMessage(
              token,
              to,
              "text",
              JSON.stringify({ text: textWithOptions }),
            );
            lastResult = { messageId: result.messageId, chatId: to };
          } else {
            const result = await sendLarkMessage(
              token,
              to,
              "text",
              JSON.stringify({ text: content }),
            );
            lastResult = { messageId: result.messageId, chatId: to };
          }
        }
      }

      if (lastResult) {
        return { channel: "lark", ...lastResult };
      }
      return { channel: "lark", messageId: "empty", chatId: to };
    },
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveLarkAccount({ cfg, accountId: accountId ?? DEFAULT_ACCOUNT_ID });
      const token = await getLarkTenantAccessToken(account.appId, account.appSecret);
      const result = await sendLarkMessage(token, to, "text", JSON.stringify({ text }));
      return { channel: "lark", ...result };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
      const account = resolveLarkAccount({ cfg, accountId: accountId ?? DEFAULT_ACCOUNT_ID });
      const token = await getLarkTenantAccessToken(account.appId, account.appSecret);
      // 简化处理：发送带链接的文本
      const content = text ? `${text}\n\n📎 [媒体文件](${mediaUrl})` : `📎 [媒体文件](${mediaUrl})`;
      const result = await sendLarkMessage(token, to, "text", JSON.stringify({ text: content }));
      return { channel: "lark", ...result };
    },
  },

  // 状态管理
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) => {
      const issues: ChannelStatusIssue[] = [];
      for (const account of accounts) {
        const accountId = account.accountId ?? DEFAULT_ACCOUNT_ID;
        if (!account.appId?.trim()) {
          issues.push({
            channel: "lark",
            accountId,
            kind: "config",
            message: "飞书 appId 未配置",
          });
        }
        if (!account.appSecret?.trim()) {
          issues.push({
            channel: "lark",
            accountId,
            kind: "config",
            message: "飞书 appSecret 未配置",
          });
        }
      }
      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      mode: snapshot.mode ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      return probeLarkBot(account.appId, account.appSecret, timeoutMs);
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const configured = Boolean(account.appId?.trim() && account.appSecret?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: account.tokenSource,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        mode: "webhook",
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },

  // 网关集成
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const appId = account.appId.trim();
      const appSecret = account.appSecret.trim();

      ctx.log?.info(`[${account.accountId}] 启动飞书 Provider`);

      return startLarkWebhookServer({
        appId,
        appSecret,
        encryptKey: account.encryptKey ?? undefined,
        verificationToken: account.verificationToken ?? undefined,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        webhookPath: account.config.webhookPath,
        onMessage: (event: LarkMessageEvent) => {
          // 处理入站消息
          const runtime = getLarkRuntime();
          runtime.channel.lark.handleIncomingMessage(event, account.accountId);
        },
      });
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const envAppId = process.env.LARK_APP_ID?.trim() ?? "";
      const nextCfg = { ...cfg } as OpenClawConfig;
      const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;
      const nextLark = { ...larkConfig };
      let cleared = false;
      let changed = false;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        if (nextLark.appId || nextLark.appSecret || nextLark.encryptKey || nextLark.verificationToken) {
          delete nextLark.appId;
          delete nextLark.appSecret;
          delete nextLark.encryptKey;
          delete nextLark.verificationToken;
          cleared = true;
          changed = true;
        }
      }

      const accounts = nextLark.accounts ? { ...nextLark.accounts } : undefined;
      if (accounts && accountId in accounts) {
        const entry = accounts[accountId];
        if (entry && typeof entry === "object") {
          const nextEntry = { ...entry } as Record<string, unknown>;
          if ("appId" in nextEntry || "appSecret" in nextEntry) {
            cleared = true;
            delete nextEntry.appId;
            delete nextEntry.appSecret;
            delete nextEntry.encryptKey;
            delete nextEntry.verificationToken;
            changed = true;
          }
          if (Object.keys(nextEntry).length === 0) {
            delete accounts[accountId];
            changed = true;
          } else {
            accounts[accountId] = nextEntry as typeof entry;
          }
        }
      }

      if (accounts) {
        if (Object.keys(accounts).length === 0) {
          delete nextLark.accounts;
          changed = true;
        } else {
          nextLark.accounts = accounts;
        }
      }

      if (changed) {
        if (Object.keys(nextLark).length > 0) {
          nextCfg.channels = { ...nextCfg.channels, lark: nextLark };
        } else {
          const nextChannels = { ...nextCfg.channels };
          delete (nextChannels as Record<string, unknown>).lark;
          if (Object.keys(nextChannels).length > 0) {
            nextCfg.channels = nextChannels;
          } else {
            delete nextCfg.channels;
          }
        }
        await getLarkRuntime().config.writeConfigFile(nextCfg);
      }

      const resolved = resolveLarkAccount({
        cfg: changed ? nextCfg : cfg,
        accountId,
      });
      const loggedOut = resolved.tokenSource === "none";

      return { cleared, envToken: Boolean(envAppId), loggedOut };
    },
  },

  // Agent 提示
  agentPrompt: {
    messageToolHints: () => [
      "",
      "### 飞书消息格式",
      "飞书支持富文本和卡片消息。可使用以下指令：",
      "",
      "**卡片消息**:",
      "  使用 [[card: ...]] 发送交互式卡片",
      "",
      "**@提及**: 在群聊中可通过 @ 触发机器人",
      "",
      "飞书消息限制：",
      "- 文本消息最多 2000 字符",
      "- 支持 Markdown 格式（部分）",
      "- 图片需先上传获取 image_key",
    ],
  },
};
