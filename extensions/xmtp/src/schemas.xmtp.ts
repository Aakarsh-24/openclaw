/**
 * XMTP Channel Zod Schemas
 *
 * Zod validation schemas for XMTP channel configuration.
 * These schemas provide runtime validation and type inference.
 */

import { z } from "zod";

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * XMTP network environment schema.
 */
export const XmtpEnvSchema = z.enum(["dev", "production"]);

/**
 * DM policy schema for XMTP channel.
 */
export const XmtpDmPolicySchema = z.enum(["pairing", "allowlist", "open"]);

/**
 * Markdown table mode schema.
 */
export const XmtpMarkdownTableModeSchema = z.enum(["off", "bullets", "code"]);

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * Markdown configuration schema.
 */
export const XmtpMarkdownConfigSchema = z.object({
  tables: XmtpMarkdownTableModeSchema.optional(),
});

/**
 * Action configuration schema.
 */
export const XmtpActionConfigSchema = z.object({
  reactions: z.boolean().optional(),
  sendMessage: z.boolean().optional(),
});

/**
 * Retry configuration schema.
 */
export const XmtpRetryConfigSchema = z.object({
  attempts: z.number().int().min(0).max(10).optional(),
  minDelayMs: z.number().int().min(0).max(60000).optional(),
  maxDelayMs: z.number().int().min(0).max(300000).optional(),
  jitter: z.number().min(0).max(1).optional(),
});

/**
 * Ethereum wallet key schema.
 * Validates 0x-prefixed 64-character hex string.
 */
export const WalletKeySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Must be 0x-prefixed 64-character hex string")
  .optional();

/**
 * Ethereum address schema.
 * Validates 0x-prefixed 40-character hex string.
 */
export const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/i, "Must be 0x-prefixed 40-character hex address")
  .transform((addr) => addr.toLowerCase());

/**
 * Per-account XMTP configuration schema.
 */
export const XmtpAccountConfigSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  walletKey: WalletKeySchema,
  env: XmtpEnvSchema.default("dev"),
  dbPath: z.string().default(".xmtp/db"),
  encryptionKey: z.string().optional(),
  dmPolicy: XmtpDmPolicySchema.default("pairing"),
  allowFrom: z.array(z.string()).default([]),
  markdown: XmtpMarkdownConfigSchema.optional(),
  textChunkLimit: z.number().int().min(100).max(10000).default(4000),
  chunkMode: z.enum(["length", "newline"]).default("length"),
  actions: XmtpActionConfigSchema.optional(),
  retry: XmtpRetryConfigSchema.optional(),
  reactionNotifications: z.enum(["off", "own", "all"]).default("off"),
  reactionLevel: z.enum(["off", "ack", "minimal", "extensive"]).default("ack"),
});

/**
 * Top-level XMTP channel configuration schema.
 * Supports both single-account and multi-account setups.
 */
export const XmtpConfigSchema = XmtpAccountConfigSchema.extend({
  accounts: z.record(z.string(), XmtpAccountConfigSchema).optional(),
});

/**
 * Simplified config schema for buildChannelConfigSchema.
 * This is the schema passed to clawdbot's config builder.
 */
export const XmtpChannelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  walletKey: z.string().optional(),
  env: XmtpEnvSchema.default("dev"),
  dbPath: z.string().default(".xmtp/db"),
  encryptionKey: z.string().optional(),
  dmPolicy: XmtpDmPolicySchema.default("pairing"),
  allowFrom: z.array(z.string()).default([]),
});

// ============================================================================
// Type Inference
// ============================================================================

/** Inferred type from XmtpEnvSchema */
export type XmtpEnvInferred = z.infer<typeof XmtpEnvSchema>;

/** Inferred type from XmtpDmPolicySchema */
export type XmtpDmPolicyInferred = z.infer<typeof XmtpDmPolicySchema>;

/** Inferred type from XmtpAccountConfigSchema */
export type XmtpAccountConfigInferred = z.infer<typeof XmtpAccountConfigSchema>;

/** Inferred type from XmtpConfigSchema */
export type XmtpConfigInferred = z.infer<typeof XmtpConfigSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate an Ethereum address.
 * Returns lowercase normalized address or throws.
 */
export function validateEthereumAddress(address: string): string {
  const result = EthereumAddressSchema.safeParse(address);
  if (!result.success) {
    throw new Error(`Invalid Ethereum address: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validate a wallet key.
 * Returns the key or throws.
 */
export function validateWalletKey(key: string): string {
  const result = WalletKeySchema.safeParse(key);
  if (!result.success) {
    throw new Error(`Invalid wallet key: ${result.error.message}`);
  }
  return key;
}

/**
 * Validate XMTP account configuration.
 * Returns validated config with defaults applied.
 */
export function validateAccountConfig(
  config: unknown
): XmtpAccountConfigInferred {
  return XmtpAccountConfigSchema.parse(config);
}

/**
 * Safely validate XMTP account configuration.
 * Returns result object with success flag.
 */
export function safeValidateAccountConfig(config: unknown) {
  return XmtpAccountConfigSchema.safeParse(config);
}
