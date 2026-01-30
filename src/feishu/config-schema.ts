/**
 * Feishu configuration schema
 * @module feishu/config-schema
 */

import { z } from "zod";

/**
 * Group-specific configuration schema
 */
export const FeishuGroupConfigSchema = z.object({
  enabled: z.boolean().optional(),
  allowFrom: z.array(z.string()).optional(),
  requireMention: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

/**
 * Account configuration schema
 */
export const FeishuAccountConfigSchema = z.object({
  enabled: z.boolean().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  appIdFile: z.string().optional(),
  appSecretFile: z.string().optional(),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  name: z.string().optional(),
  allowFrom: z.array(z.string()).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  dmPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  requireMention: z.boolean().optional(),
  mediaMaxMb: z.number().optional(),
  webhookPath: z.string().optional(),
  useLongConnection: z.boolean().optional(),
  groups: z.record(FeishuGroupConfigSchema).optional(),
});

/**
 * Main Feishu configuration schema
 */
export const FeishuConfigSchema = z.object({
  enabled: z.boolean().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  appIdFile: z.string().optional(),
  appSecretFile: z.string().optional(),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  name: z.string().optional(),
  allowFrom: z.array(z.string()).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  dmPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  requireMention: z.boolean().optional(),
  mediaMaxMb: z.number().optional(),
  webhookPath: z.string().optional(),
  useLongConnection: z.boolean().optional(),
  accounts: z.record(FeishuAccountConfigSchema).optional(),
  groups: z.record(FeishuGroupConfigSchema).optional(),
});

export type FeishuConfigSchemaType = z.infer<typeof FeishuConfigSchema>;
export type FeishuAccountConfigSchemaType = z.infer<typeof FeishuAccountConfigSchema>;
export type FeishuGroupConfigSchemaType = z.infer<typeof FeishuGroupConfigSchema>;
