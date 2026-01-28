import express from "express";
import crypto from "crypto";
import { loadConfig } from "../config/config.js";
import type { MoltbotConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { ResolvedZoomAccount } from "./config.js";
import { resolveZoomAccount } from "./config.js";
import { handleZoomMessage } from "./message-handler.js";
import type { ZoomMonitorContext } from "./context.js";
import type { SessionScope } from "../config/sessions/types.js";

export type MonitorZoomOpts = {
  accountId?: string;
  config?: MoltbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  port?: number;
};

type ZoomWebhookPayload = {
  event: string;
  payload: {
    accountId: string;
    userJid: string;
    userName: string;
    robotJid: string;
    cmd: string;
    timestamp: number;
    toJid: string;
    userId: string;
    plainToken?: string;
  };
};

let cachedBotToken: { token: string; expiresAt: number } | null = null;

function encryptToken(token: string, secretToken: string): string {
  const hash = crypto.createHmac("sha256", secretToken).update(token).digest("hex");
  return hash;
}

async function getBotToken(account: ResolvedZoomAccount): Promise<string> {
  // Use cached token if valid
  if (cachedBotToken && cachedBotToken.expiresAt > Date.now()) {
    return cachedBotToken.token;
  }

  const { clientId, clientSecret, oauthHost } = account;
  if (!clientId || !clientSecret) {
    throw new Error("Zoom clientId and clientSecret required");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${oauthHost}/oauth/token?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get bot token: ${response.status} ${error}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };

  cachedBotToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

async function sendZoomMessage(params: {
  account: ResolvedZoomAccount;
  toJid: string;
  accountId: string;
  message: string;
}): Promise<void> {
  const { account, toJid, accountId, message } = params;
  const { botJid, apiHost } = account;

  if (!botJid) {
    throw new Error("Zoom botJid required");
  }

  const accessToken = await getBotToken(account);

  const response = await fetch(`${apiHost}/v2/im/chat/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      robot_jid: botJid,
      to_jid: toJid,
      account_id: accountId,
      user_jid: toJid,
      content: {
        head: {
          text: message,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send message: ${response.status} ${error}`);
  }
}

export async function monitorZoomProvider(opts: MonitorZoomOpts = {}): Promise<void> {
  const { config, runtime, abortSignal, port = 3001 } = opts;

  // Load config and resolve account (matching Slack/Telegram pattern)
  const cfg = config ?? loadConfig();
  const account = resolveZoomAccount({
    cfg,
    accountId: opts.accountId,
  });

  if (!runtime) {
    throw new Error("Runtime required for Zoom provider");
  }

  const { secretToken } = account;
  if (!secretToken) {
    throw new Error("Zoom secretToken required for webhook verification");
  }

  // Build monitor context internally (moved from channel.ts)
  const sessionScope: SessionScope = cfg.session?.scope ?? "per-sender";

  const ctx: ZoomMonitorContext = {
    cfg,
    accountId: account.accountId,
    account,
    runtime,
    historyLimit: 10,
    channelHistories: new Map(),
    sessionScope,
    mainKey: "", // Not used for Zoom (sessions are per-user)
    dmEnabled: account.enabled,
    dmPolicy: account.config.dm?.policy ?? "open",
    allowFrom: (account.config.dm?.allowFrom ?? []).map((entry) => String(entry)),
    textLimit: 4000,
    replyToMode: "off",
    removeAckAfterReply: false,
  };

  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "zoom-webhook" });
  });

  // OAuth callback endpoint (for app installation)
  app.get("/api/zoomapp/auth", async (req, res) => {
    const code = req.query.code as string;

    if (!code) {
      runtime.log("zoom: OAuth callback missing code parameter");
      return res.status(400).send("Missing authorization code");
    }

    runtime.log(`zoom: OAuth callback received, exchanging code for tokens...`);

    try {
      // Exchange authorization code for access token
      const tokenUrl = `${account.oauthHost}/oauth/token`;
      const tokenParams = new URLSearchParams();
      tokenParams.set("grant_type", "authorization_code");
      tokenParams.set("redirect_uri", `${req.protocol}://${req.get("host")}/api/zoomapp/auth`);
      tokenParams.set("code", code);

      const authHeader = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString(
        "base64",
      );

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`,
        },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        runtime.error?.(`zoom: Token exchange failed: ${tokenResponse.status} ${error}`);
        return res.status(500).send("Failed to complete installation");
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string };
      runtime.log("zoom: Successfully exchanged code for access token");

      // Get deep link to redirect user back to Zoom app
      const deepLinkResponse = await fetch(`${account.apiHost}/v2/zoomapp/deeplink`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "go" }),
      });

      if (deepLinkResponse.ok) {
        const deepLinkData = (await deepLinkResponse.json()) as { deeplink: string };
        runtime.log("zoom: Redirecting to Zoom app");
        return res.redirect(deepLinkData.deeplink);
      }

      // Fallback: show success page if deep link fails
      runtime.log("zoom: Deep link failed, showing success page");
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Zoom App Installed</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center; }
              .success { color: #16a34a; font-size: 48px; margin-bottom: 20px; }
              h1 { color: #333; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="success">✅</div>
            <h1>Zoom App Installed Successfully!</h1>
            <p>Your bot is now active. You can close this window and start messaging your bot in Zoom Team Chat.</p>
            <p><strong>Bot Name:</strong> Jarvis 🤖</p>
            <p>Send a message to get started!</p>
          </body>
        </html>
      `);
    } catch (error) {
      runtime.error?.(`zoom: OAuth error: ${error}`);
      return res.status(500).send("Installation failed");
    }
  });

  // Webhook endpoint
  app.post("/webhooks/zoom", async (req, res) => {
    try {
      const body = req.body as ZoomWebhookPayload;

      // Handle URL validation
      if (body.event === "endpoint.url_validation") {
        const plainToken = body.payload.plainToken || "";
        const encryptedToken = encryptToken(plainToken, secretToken);

        runtime.log("zoom: URL validation successful");
        return res.json({
          plainToken,
          encryptedToken,
        });
      }

      // Handle bot notification
      if (body.event === "bot_notification") {
        const { userJid, userName, cmd, accountId, toJid, timestamp } = body.payload;

        runtime.log(`zoom: Message from ${userName}: ${cmd}`);

        // Use clawdbot's dispatch system (handles AI, history, streaming, etc.)
        await handleZoomMessage({
          ctx,
          message: {
            userJid,
            userName,
            cmd,
            accountId,
            toJid,
            timestamp,
          },
          sendReply: async (replyText: string) => {
            runtime.log(`zoom: Sending response: ${replyText.substring(0, 80)}...`);
            await sendZoomMessage({
              account,
              toJid: userJid,
              accountId,
              message: replyText,
            });
            runtime.log("zoom: Response sent successfully");
          },
        });

        return res.json({ success: true });
      }

      return res.json({ success: true });
    } catch (error) {
      runtime.error?.(`zoom: Webhook error: ${error}`);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const server = await new Promise<any>((resolve, reject) => {
    const srv = app.listen(port, () => {
      runtime.log(`zoom: Webhook server listening on port ${port}`);
      runtime.log(`zoom: Webhook URL: http://localhost:${port}/webhooks/zoom`);
      resolve(srv);
    });
    srv.on("error", reject);
  });

  // Graceful shutdown handler
  const stopServer = () => {
    runtime.log("zoom: Shutting down webhook server...");
    server.close(() => {
      runtime.log("zoom: Webhook server stopped");
    });
  };

  abortSignal?.addEventListener("abort", stopServer, { once: true });

  try {
    if (abortSignal?.aborted) return;
    // Wait for abort signal
    if (abortSignal) {
      await new Promise<void>((resolve) => {
        abortSignal.addEventListener("abort", () => resolve(), { once: true });
      });
    } else {
      // If no abort signal, wait forever (process will handle SIGINT/SIGTERM)
      await new Promise(() => {});
    }
  } finally {
    abortSignal?.removeEventListener("abort", stopServer);
    server.close();
  }
}
