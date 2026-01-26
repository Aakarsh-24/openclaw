import { z } from "zod";

export const NylasConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  apiUri: z.string().default("https://api.us.nylas.com"),
  defaultGrantId: z.string().optional(),
  defaultTimezone: z.string().default("UTC"),
  grants: z.record(z.string(), z.string()).default({}),
});

export type NylasConfig = z.infer<typeof NylasConfigSchema>;

export function parseNylasConfig(value: unknown): NylasConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return NylasConfigSchema.parse({
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
    apiUri: typeof raw.apiUri === "string" ? raw.apiUri : "https://api.us.nylas.com",
    defaultGrantId: typeof raw.defaultGrantId === "string" ? raw.defaultGrantId : undefined,
    defaultTimezone: typeof raw.defaultTimezone === "string" ? raw.defaultTimezone : "UTC",
    grants: raw.grants && typeof raw.grants === "object" ? (raw.grants as Record<string, string>) : {},
  });
}

export type NylasConfigValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

export function validateNylasConfig(config: NylasConfig): NylasConfigValidation {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push("apiKey is required");
  }

  if (!config.defaultGrantId && Object.keys(config.grants).length === 0) {
    errors.push("defaultGrantId or at least one named grant is required");
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
