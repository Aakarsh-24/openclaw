/**
 * Account resolution and configuration utilities
 */

import type { ZaloUserFreeAccountConfig, ZaloUserFreeChannelConfig } from "./types.js";

const DEFAULT_ACCOUNT_ID = "default";

function normalizeAccountId(accountId?: string | null): string {
    const trimmed = accountId?.trim();
    if (!trimmed) return DEFAULT_ACCOUNT_ID;
    return trimmed;
}

export function listAccountIds(cfg: any): string[] {
    const channelConfig = cfg?.channels?.["zalouser-free"] as ZaloUserFreeChannelConfig | undefined;
    const accounts = channelConfig?.accounts;
    if (!accounts || typeof accounts !== "object") {
        return [DEFAULT_ACCOUNT_ID];
    }
    const ids = Object.keys(accounts).filter(Boolean);
    return ids.length > 0 ? ids.sort() : [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultAccountId(cfg: any): string {
    const channelConfig = cfg?.channels?.["zalouser-free"] as ZaloUserFreeChannelConfig | undefined;
    if (channelConfig?.defaultAccount?.trim()) {
        return channelConfig.defaultAccount.trim();
    }
    const ids = listAccountIds(cfg);
    if (ids.includes(DEFAULT_ACCOUNT_ID)) {
        return DEFAULT_ACCOUNT_ID;
    }
    return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export interface ResolvedAccount {
    accountId: string;
    enabled: boolean;
    config: ZaloUserFreeAccountConfig;
}

export function resolveAccount(cfg: any, accountId?: string | null): ResolvedAccount {
    const id = normalizeAccountId(accountId);
    const channelConfig = cfg?.channels?.["zalouser-free"] as ZaloUserFreeChannelConfig | undefined;
    const baseEnabled = channelConfig?.enabled !== false;
    const accountCfg = channelConfig?.accounts?.[id];
    const accountEnabled = accountCfg?.enabled !== false;

    const defaultConfig: ZaloUserFreeAccountConfig = {
        accountId: id,
        enabled: baseEnabled && accountEnabled,
        dmAccess: "whitelist",
        groupAccess: "mention",
        allowedUsers: [],
        allowedGroups: [],
    };

    return {
        accountId: id,
        enabled: baseEnabled && accountEnabled,
        config: { ...defaultConfig, ...accountCfg },
    };
}

export { DEFAULT_ACCOUNT_ID, normalizeAccountId };
