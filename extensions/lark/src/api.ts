/**
 * 飞书 API 实现
 */
import type {
  LarkConfig,
  LarkAccountConfig,
  ResolvedLarkAccount,
  LarkApiResponse,
  LarkTenantAccessToken,
  LarkSendMessageRequest,
  LarkMessageEvent,
  LarkMessageType,
} from "./types.js";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";

// 飞书开放平台 API 基础 URL
const LARK_API_BASE = "https://open.feishu.cn/open-apis";
const LARK_AUTH_BASE = "https://open.feishu.cn/open-apis/auth/v3";

// 缓存 access token
const tokenCache = new Map<
  string,
  { token: string; expireAt: number }
>();

/**
 * 规范化账号 ID
 */
export function normalizeLarkAccountId(accountId: string | null | undefined): string {
  if (!accountId || accountId === DEFAULT_ACCOUNT_ID) {
    return DEFAULT_ACCOUNT_ID;
  }
  return accountId.trim();
}

/**
 * 列出所有账号 ID
 */
export function listLarkAccountIds(cfg: { channels?: Record<string, unknown> }): string[] {
  const larkConfig = cfg.channels?.lark as LarkConfig | undefined;
  const ids: string[] = [];

  // 默认账号
  if (larkConfig?.appId) {
    ids.push(DEFAULT_ACCOUNT_ID);
  }

  // 多账号
  if (larkConfig?.accounts) {
    for (const id of Object.keys(larkConfig.accounts)) {
      if (larkConfig.accounts[id]?.appId) {
        ids.push(id);
      }
    }
  }

  return ids;
}

/**
 * 获取默认账号 ID
 */
export function resolveDefaultLarkAccountId(cfg: { channels?: Record<string, unknown> }): string | null {
  const ids = listLarkAccountIds(cfg);
  return ids.length > 0 ? ids[0] : null;
}

/**
 * 解析账号配置
 */
export function resolveLarkAccount({
  cfg,
  accountId,
}: {
  cfg: { channels?: Record<string, unknown> };
  accountId?: string | null;
}): ResolvedLarkAccount {
  const resolvedId = normalizeLarkAccountId(accountId);
  const larkConfig = (cfg.channels?.lark ?? {}) as LarkConfig;

  // 环境变量
  const envAppId = process.env.LARK_APP_ID?.trim() ?? "";
  const envAppSecret = process.env.LARK_APP_SECRET?.trim() ?? "";
  const envEncryptKey = process.env.LARK_ENCRYPT_KEY?.trim() ?? "";
  const envVerificationToken = process.env.LARK_VERIFICATION_TOKEN?.trim() ?? "";

  // 获取账号配置
  let accountConfig: LarkAccountConfig;
  let tokenSource: "env" | "config" | "none" = "none";

  if (resolvedId === DEFAULT_ACCOUNT_ID) {
    accountConfig = {
      appId: larkConfig.appId ?? "",
      appSecret: larkConfig.appSecret ?? "",
      encryptKey: larkConfig.encryptKey ?? "",
      verificationToken: larkConfig.verificationToken ?? "",
      enabled: larkConfig.enabled ?? true,
      name: larkConfig.name ?? null,
      allowFrom: larkConfig.allowFrom ?? [],
      groupAllowFrom: larkConfig.groupAllowFrom ?? [],
      dmPolicy: larkConfig.dmPolicy ?? "pairing",
      groupPolicy: larkConfig.groupPolicy ?? "allowlist",
      webhookPath: larkConfig.webhookPath,
      groups: larkConfig.groups,
    };

    if (envAppId && envAppSecret) {
      accountConfig.appId = envAppId;
      accountConfig.appSecret = envAppSecret;
      if (envEncryptKey) accountConfig.encryptKey = envEncryptKey;
      if (envVerificationToken) accountConfig.verificationToken = envVerificationToken;
      tokenSource = "env";
    } else if (accountConfig.appId && accountConfig.appSecret) {
      tokenSource = "config";
    }
  } else {
    const acc = larkConfig.accounts?.[resolvedId];
    accountConfig = {
      appId: acc?.appId ?? "",
      appSecret: acc?.appSecret ?? "",
      encryptKey: acc?.encryptKey ?? "",
      verificationToken: acc?.verificationToken ?? "",
      enabled: acc?.enabled ?? true,
      name: acc?.name ?? null,
      allowFrom: acc?.allowFrom ?? [],
      groupAllowFrom: acc?.groupAllowFrom ?? [],
      dmPolicy: acc?.dmPolicy ?? "pairing",
      groupPolicy: acc?.groupPolicy ?? "allowlist",
      webhookPath: acc?.webhookPath,
      groups: acc?.groups,
    };

    if (accountConfig.appId && accountConfig.appSecret) {
      tokenSource = "config";
    }
  }

  return {
    accountId: resolvedId,
    name: accountConfig.name ?? null,
    enabled: accountConfig.enabled ?? true,
    appId: accountConfig.appId,
    appSecret: accountConfig.appSecret,
    encryptKey: accountConfig.encryptKey ?? null,
    verificationToken: accountConfig.verificationToken ?? null,
    tokenSource,
    config: accountConfig,
  };
}

/**
 * 获取租户访问令牌
 */
export async function getLarkTenantAccessToken(
  appId: string,
  appSecret: string,
): Promise<string> {
  const cacheKey = `${appId}:${appSecret}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expireAt > Date.now()) {
    return cached.token;
  }

  const response = await fetch(`${LARK_AUTH_BASE}/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`获取飞书 token 失败: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as LarkApiResponse<LarkTenantAccessToken>;

  if (data.code !== 0) {
    throw new Error(`获取飞书 token 失败: ${data.msg} (code: ${data.code})`);
  }

  if (!data.data) {
    throw new Error("获取飞书 token 失败: 响应数据为空");
  }

  const token = data.data.tenant_access_token;
  const expireIn = data.data.expire;

  // 缓存 token，提前 60 秒过期，但至少保留 1 秒
  const bufferSeconds = 60;
  const ttlSeconds = Math.max(1, expireIn - bufferSeconds);
  tokenCache.set(cacheKey, {
    token,
    expireAt: Date.now() + ttlSeconds * 1000,
  });

  return token;
}

/**
 * 发送飞书消息
 */
export async function sendLarkMessage(
  token: string,
  receiveId: string,
  msgType: LarkMessageType,
  content: string,
): Promise<{ messageId: string; chatId: string }> {
  const response = await fetch(`${LARK_API_BASE}/im/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: msgType,
      content,
    } as LarkSendMessageRequest),
  });

  if (!response.ok) {
    throw new Error(`发送飞书消息失败: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as LarkApiResponse<{ message_id: string }>;

  if (data.code !== 0) {
    throw new Error(`发送飞书消息失败: ${data.msg} (code: ${data.code})`);
  }

  return {
    messageId: data.data?.message_id ?? "unknown",
    chatId: receiveId,
  };
}

/**
 * 探测飞书 Bot 状态
 */
export async function probeLarkBot(
  appId: string,
  appSecret: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; error?: string; bot?: { appName?: string; openId?: string } }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const token = await getLarkTenantAccessToken(appId, appSecret);

    // 获取 Bot 信息
    const response = await fetch(`${LARK_API_BASE}/bot/v3/bot_info`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as LarkApiResponse<{
      app_name?: string;
      open_id?: string;
    }>;

    if (data.code !== 0) {
      return {
        ok: false,
        error: data.msg,
      };
    }

    return {
      ok: true,
      bot: {
        appName: data.data?.app_name,
        openId: data.data?.open_id,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 启动飞书 Webhook 服务
 */
export function startLarkWebhookServer({
  appId,
  appSecret,
  encryptKey,
  verificationToken,
  accountId,
  config,
  runtime,
  abortSignal,
  webhookPath,
  onMessage,
}: {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  accountId: string;
  config: unknown;
  runtime: unknown;
  abortSignal?: AbortSignal;
  webhookPath?: string;
  onMessage: (event: LarkMessageEvent) => void;
}): { stop: () => Promise<void> } {
  // 实际实现需要集成到 Gateway 的 HTTP 服务器
  // 这里返回一个占位符
  return {
    stop: async () => {
      // 清理逻辑
    },
  };
}

/**
 * 处理飞书事件回调验证（Challenge 模式）
 */
export function handleLarkChallenge(
  body: Record<string, unknown>,
  verificationToken?: string,
): { challenge: string } | null {
  // 验证 token
  if (verificationToken && body.token !== verificationToken) {
    throw new Error("飞书验证 Token 不匹配");
  }

  // 返回 challenge
  if (typeof body.challenge === "string") {
    return { challenge: body.challenge };
  }

  return null;
}

/**
 * 解析飞书消息事件
 */
export function parseLarkMessageEvent(body: Record<string, unknown>): LarkMessageEvent | null {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return null;
  }

  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;

  if (!message || !sender) {
    return null;
  }

  const senderId = sender.senderId as Record<string, string> | undefined;

  return {
    sender: {
      senderId: {
        openId: senderId?.openId ?? "",
        userId: senderId?.userId,
      },
      senderType: "user",
    },
    message: {
      messageId: String(message.messageId ?? ""),
      rootId: message.rootId ? String(message.rootId) : undefined,
      parentId: message.parentId ? String(message.parentId) : undefined,
      createTime: String(message.createTime ?? ""),
      chatId: String(message.chatId ?? ""),
      chatType: message.chatType === "p2p" ? "p2p" : "group",
      messageType: String(message.messageType ?? "text") as LarkMessageEvent["message"]["messageType"],
      content: String(message.content ?? ""),
      mentions: Array.isArray(message.mentions) ? message.mentions : undefined,
    },
  };
}
