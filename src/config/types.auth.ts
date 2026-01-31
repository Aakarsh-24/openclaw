export type AuthProfileConfig = {
  provider: string;
  /**
   * Credential type expected in auth-profiles.json for this profile id.
   * - api_key: static provider API key
   * - oauth: refreshable OAuth credentials (access+refresh+expires)
   * - token: static bearer-style token (optionally expiring; no refresh)
   */
  mode: "api_key" | "oauth" | "token";
  email?: string;
};

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  cooldowns?: {
    /** Default billing backoff (hours). Default: 5. */
    billingBackoffHours?: number;
    /** Optional per-provider billing backoff (hours). */
    billingBackoffHoursByProvider?: Record<string, number>;
    /** Billing backoff cap (hours). Default: 24. */
    billingMaxHours?: number;
    /**
     * Failure window for backoff counters (hours). If no failures occur within
     * this window, counters reset. Default: 24.
     */
    failureWindowHours?: number;
  };
  otpVerification?: {
    enabled?: boolean;
    /** Base32-encoded TOTP secret */
    secret?: string;
    /** User's account identifier (for authenticator app display) */
    accountName?: string;
    /** Service name (e.g., "OpenClaw") */
    issuer?: string;
    /** Verification interval in hours (1-168). Default: 24. */
    intervalHours?: number;
    /** If true, block all access when verification expires. Default: false. */
    strictMode?: boolean;
    /** Grace period in minutes after expiration (5-60). Default: 15. */
    gracePeriodMinutes?: number;
    /** Optional per-channel configuration */
    channels?: {
      slack?: boolean;
      discord?: boolean;
      telegram?: boolean;
      whatsapp?: boolean;
    };
    /** Optional settings for advanced use cases */
    settings?: {
      vaultPath?: string;
      itemReference?: string;
      verifyBeforeCommands?: string[];
      timeWindow?: number;
    };
  };
};
