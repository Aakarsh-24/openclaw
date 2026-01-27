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

export type MultiAccountConfig = {
  /** Enable multi-account load balancing. Default: false */
  enabled?: boolean;
  /**
   * Selection strategy:
   * - hybrid: health + quota + LRU weighted scoring (default)
   * - sticky: prefer same account per model (cache-friendly)
   * - round-robin: even distribution across accounts
   */
  strategy?: "hybrid" | "sticky" | "round-robin";
  /** Providers to enable multi-account for. Default: ["google-antigravity"] */
  providers?: string[];
  /** Default cooldown when rate-limited (ms). Default: 10000 */
  defaultCooldownMs?: number;
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
  /** Multi-account load balancing configuration */
  multiAccount?: MultiAccountConfig;
};
