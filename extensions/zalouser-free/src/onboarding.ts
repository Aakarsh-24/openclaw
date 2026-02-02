/**
 * Onboarding Adapter for zalouser-free
 */

import type { ZaloUserFreeAccountConfig } from "./types.js";
import { DEFAULT_ACCOUNT_ID } from "./accounts.js";

export interface OnboardingStatus {
    ready: boolean;
    authenticated: boolean;
    warnings: string[];
    errors: string[];
}

export interface OnboardingAdapter {
    id: string;
    displayName: string;
    getStatus: (cfg: any, accountId?: string) => Promise<OnboardingStatus>;
    getPrompts: () => Array<{
        key: string;
        label: string;
        type: "text" | "select" | "boolean";
        options?: string[];
        required?: boolean;
    }>;
    applyConfig: (cfg: any, accountId: string, input: Record<string, any>) => any;
}

export const zalouserFreeOnboardingAdapter: OnboardingAdapter = {
    id: "zalouser-free",
    displayName: "Zalo (Free, Zalo Personal, zca-js)",

    getStatus: async (cfg: any, accountId?: string): Promise<OnboardingStatus> => {
        const id = accountId ?? DEFAULT_ACCOUNT_ID;
        const channelConfig = cfg?.channels?.["zalouser-free"];
        const accountConfig = channelConfig?.accounts?.[id];

        const authenticated = Boolean(accountConfig?.enabled);

        return {
            ready: authenticated,
            authenticated,
            warnings: authenticated ? [] : ["Not logged in. Run: openclaw zalouser-free login"],
            errors: [],
        };
    },

    getPrompts: () => [
        {
            key: "dmAccess",
            label: "DM Access Policy",
            type: "select" as const,
            options: ["whitelist", "open"],
            required: false,
        },
        {
            key: "groupAccess",
            label: "Group Access Policy",
            type: "select" as const,
            options: ["mention", "whitelist", "open"],
            required: false,
        },
    ],

    applyConfig: (cfg: any, accountId: string, input: Record<string, any>) => {
        const id = accountId ?? DEFAULT_ACCOUNT_ID;

        const accountConfig: Partial<ZaloUserFreeAccountConfig> = {
            enabled: true,
            dmAccess: input.dmAccess || "whitelist",
            groupAccess: input.groupAccess || "mention",
            allowedUsers: input.allowedUsers || [],
            allowedGroups: input.allowedGroups || [],
        };

        return {
            ...cfg,
            channels: {
                ...cfg.channels,
                "zalouser-free": {
                    ...cfg.channels?.["zalouser-free"],
                    enabled: true,
                    accounts: {
                        ...cfg.channels?.["zalouser-free"]?.accounts,
                        [id]: {
                            ...cfg.channels?.["zalouser-free"]?.accounts?.[id],
                            ...accountConfig,
                        },
                    },
                },
            },
        };
    },
};
