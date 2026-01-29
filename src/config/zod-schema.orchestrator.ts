import { z } from "zod";

export const OpenCodeAgentSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: z.string().optional(),
    mode: z.union([z.literal("cli"), z.literal("serve")]).optional(),
    binary: z.string().optional(),
    timeoutMs: z.number().int().nonnegative().optional(),
    servePort: z.number().int().min(1).max(65535).optional(),
  })
  .strict()
  .optional();

export const ResearchAgentSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: z.string().optional(),
  })
  .strict()
  .optional();

export const EmbeddedAgentSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: z.string().nullable().optional(),
  })
  .strict()
  .optional();

export const OrchestratorSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: z.string().optional(),
    fallbacks: z.array(z.string()).optional(),
    agents: z
      .object({
        opencode: OpenCodeAgentSchema,
        research: ResearchAgentSchema,
        embedded: EmbeddedAgentSchema,
      })
      .strict()
      .optional(),
    parallelExecution: z.boolean().optional(),
    maxParallelAgents: z.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();
