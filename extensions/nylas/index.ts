import { NylasConfigSchema, parseNylasConfig, validateNylasConfig, type NylasConfig } from "./src/config.js";
import { NylasClient, NylasApiError } from "./src/client.js";
import { nylasTools } from "./src/tools/index.js";
import { registerNylasCli } from "./src/cli.js";

const nylasConfigSchema = {
  parse(value: unknown): NylasConfig {
    return parseNylasConfig(value);
  },
  uiHints: {
    apiKey: {
      label: "API Key",
      help: "Nylas API key from dashboard.nylas.com",
      sensitive: true,
    },
    apiUri: {
      label: "API URI",
      help: "Use https://api.us.nylas.com (US) or https://api.eu.nylas.com (EU)",
      placeholder: "https://api.us.nylas.com",
    },
    defaultGrantId: {
      label: "Default Grant ID",
      help: "Primary email account's grant ID from Nylas dashboard",
    },
    defaultTimezone: {
      label: "Default Timezone",
      help: "Timezone for date/time operations (e.g., America/New_York)",
      placeholder: "America/New_York",
    },
    grants: {
      label: "Named Grants",
      help: "Map of named grants for multi-account access",
      advanced: true,
    },
  },
};

const nylasPlugin = {
  id: "nylas",
  name: "Nylas",
  description: "Email, calendar, and contacts integration via Nylas API v3",
  configSchema: nylasConfigSchema,
  register(api) {
    const config = nylasConfigSchema.parse(api.pluginConfig);
    const validation = validateNylasConfig(config);

    // Capture validation errors early for use in getClient closure
    const validationErrors = !validation.valid ? validation.errors : null;

    // Create client lazily
    let client: NylasClient | null = null;

    const getClient = () => {
      if (!client) {
        if (!config.enabled) {
          throw new Error("Nylas plugin is disabled");
        }
        if (validationErrors) {
          throw new Error(`Nylas configuration error: ${validationErrors.join("; ")}`);
        }
        client = new NylasClient({
          config,
          logger: api.logger,
        });
      }
      return client;
    };

    // Register all tools
    for (const toolDef of nylasTools) {
      api.registerTool({
        name: toolDef.name,
        label: toolDef.label,
        description: toolDef.description,
        parameters: toolDef.parameters,
        async execute(_toolCallId, params) {
          const json = (payload: unknown) => ({
            content: [
              { type: "text", text: JSON.stringify(payload, null, 2) },
            ],
            details: payload,
          });

          try {
            const result = await toolDef.execute(getClient(), params);
            return json(result);
          } catch (err) {
            if (err instanceof NylasApiError) {
              return json({
                error: err.message,
                status_code: err.statusCode,
                error_type: err.errorType,
                request_id: err.requestId,
              });
            }
            return json({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        },
      });
    }

    // Register CLI commands
    api.registerCli(
      ({ program, logger }) =>
        registerNylasCli({
          program,
          config,
          logger,
        }),
      { commands: ["nylas"] },
    );

    // Register gateway methods for programmatic access
    api.registerGatewayMethod("nylas.discoverGrants", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.listGrants(params ?? {});
        respond(true, {
          grants: result.data.map((g) => ({
            id: g.id,
            email: g.email,
            provider: g.provider,
            status: g.grant_status,
            scopes: g.scope,
          })),
        });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.listEmails", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.listMessages(params ?? {});
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.getMessage", async ({ params, respond }) => {
      try {
        const c = getClient();
        const messageId = typeof params?.messageId === "string" ? params.messageId : "";
        const grant = typeof params?.grant === "string" ? params.grant : undefined;
        if (!messageId) {
          respond(false, { error: "messageId required" });
          return;
        }
        const result = await c.getMessage(messageId, grant);
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.sendMessage", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.sendMessage(params ?? {});
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.listCalendars", async ({ params, respond }) => {
      try {
        const c = getClient();
        const grant = typeof params?.grant === "string" ? params.grant : undefined;
        const result = await c.listCalendars(grant);
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.listEvents", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.listEvents(params ?? {});
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.createEvent", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.createEvent(params as Parameters<NylasClient["createEvent"]>[0]);
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("nylas.listContacts", async ({ params, respond }) => {
      try {
        const c = getClient();
        const result = await c.listContacts(params ?? {});
        respond(true, result);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });
  },
};

export default nylasPlugin;
