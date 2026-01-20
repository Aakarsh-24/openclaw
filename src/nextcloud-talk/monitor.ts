import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { loadConfig, type ClawdbotConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveNextcloudTalkAccount } from "./accounts.js";
import { extractNextcloudTalkHeaders, verifyNextcloudTalkSignature } from "./signature.js";
import type {
  NextcloudTalkInboundMessage,
  NextcloudTalkWebhookPayload,
  NextcloudTalkWebhookServerOptions,
} from "./types.js";

const DEFAULT_WEBHOOK_PORT = 8788;
const DEFAULT_WEBHOOK_HOST = "0.0.0.0";
const DEFAULT_WEBHOOK_PATH = "/nextcloud-talk-webhook";
const HEALTH_PATH = "/healthz";

function parseWebhookPayload(body: string): NextcloudTalkWebhookPayload | null {
  try {
    const data = JSON.parse(body);
    // Validate required fields
    if (
      !data.type ||
      !data.actor?.type ||
      !data.actor?.id ||
      !data.object?.type ||
      !data.object?.id ||
      !data.target?.type ||
      !data.target?.id
    ) {
      return null;
    }
    return data as NextcloudTalkWebhookPayload;
  } catch {
    return null;
  }
}

function payloadToInboundMessage(
  payload: NextcloudTalkWebhookPayload,
): NextcloudTalkInboundMessage {
  // Determine if it's a group chat based on room type or naming
  // For now, we consider any room with more than one participant as a group
  // This could be refined based on Nextcloud Talk's room type information
  const isGroupChat = true; // Default to true; DMs will be identified by room type if available

  return {
    messageId: String(payload.object.id),
    roomToken: payload.target.id,
    roomName: payload.target.name,
    senderId: payload.actor.id,
    senderName: payload.actor.name,
    text: payload.object.content || payload.object.name || "",
    mediaType: payload.object.mediaType || "text/plain",
    timestamp: Date.now(),
    isGroupChat,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export function createNextcloudTalkWebhookServer(opts: NextcloudTalkWebhookServerOptions): {
  server: Server;
  start: () => Promise<void>;
  stop: () => void;
} {
  const { port, host, path, secret, onMessage, onError, abortSignal } = opts;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check endpoint
    if (req.url === HEALTH_PATH) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    // Only accept POST to the webhook path
    if (req.url !== path || req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      // Read request body
      const body = await readBody(req);

      // Extract and verify signature
      const headers = extractNextcloudTalkHeaders(
        req.headers as Record<string, string | string[] | undefined>,
      );
      if (!headers) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing signature headers" }));
        return;
      }

      const isValid = verifyNextcloudTalkSignature({
        signature: headers.signature,
        random: headers.random,
        body,
        secret,
      });

      if (!isValid) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid signature" }));
        return;
      }

      // Parse payload
      const payload = parseWebhookPayload(body);
      if (!payload) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid payload format" }));
        return;
      }

      // Only process Create events (new messages)
      if (payload.type !== "Create") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Convert to inbound message and dispatch
      const message = payloadToInboundMessage(payload);

      // Acknowledge receipt immediately
      res.writeHead(200);
      res.end();

      // Process message asynchronously
      try {
        await onMessage(message);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(formatErrorMessage(err)));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(formatErrorMessage(err));
      onError?.(error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  const start = (): Promise<void> => {
    return new Promise((resolve) => {
      server.listen(port, host, () => resolve());
    });
  };

  const stop = () => {
    server.close();
  };

  if (abortSignal) {
    abortSignal.addEventListener("abort", stop, { once: true });
  }

  return { server, start, stop };
}

export type NextcloudTalkMonitorOptions = {
  accountId?: string;
  config?: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  onMessage?: (message: NextcloudTalkInboundMessage) => void | Promise<void>;
};

export async function monitorNextcloudTalkProvider(
  opts: NextcloudTalkMonitorOptions,
): Promise<{ stop: () => void }> {
  const runtime = opts.runtime ?? defaultRuntime;
  const cfg = opts.config ?? loadConfig();
  const account = resolveNextcloudTalkAccount({
    cfg,
    accountId: opts.accountId,
  });

  if (!account.secret) {
    throw new Error(`Nextcloud Talk bot secret not configured for account "${account.accountId}"`);
  }

  const port = account.config.webhookPort ?? DEFAULT_WEBHOOK_PORT;
  const host = account.config.webhookHost ?? DEFAULT_WEBHOOK_HOST;
  const path = account.config.webhookPath ?? DEFAULT_WEBHOOK_PATH;

  const { server, start, stop } = createNextcloudTalkWebhookServer({
    port,
    host,
    path,
    secret: account.secret,
    onMessage: async (message) => {
      if (opts.onMessage) {
        await opts.onMessage(message);
      }
    },
    onError: (error) => {
      runtime.log?.(`[nextcloud-talk:${account.accountId}] webhook error: ${error.message}`);
    },
    abortSignal: opts.abortSignal,
  });

  await start();

  const publicUrl =
    account.config.webhookPublicUrl ??
    `http://${host === "0.0.0.0" ? "localhost" : host}:${port}${path}`;
  runtime.log?.(`[nextcloud-talk:${account.accountId}] webhook listening on ${publicUrl}`);

  return { stop };
}
