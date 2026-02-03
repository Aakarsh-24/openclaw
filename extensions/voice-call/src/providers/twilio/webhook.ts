import type { WebhookContext, WebhookVerificationResult } from "../../types.js";
import type { TwilioProviderOptions } from "../twilio.js";
import { verifyTwilioWebhook } from "../../webhook-security.js";

export function verifyTwilioProviderWebhook(params: {
  ctx: WebhookContext;
  authToken: string;
  currentPublicUrl?: string | null;
  options: TwilioProviderOptions;
}): WebhookVerificationResult {
  const result = verifyTwilioWebhook(params.ctx, params.authToken, {
    publicUrl: params.currentPublicUrl || undefined,
    allowNgrokFreeTierLoopbackBypass: params.options.allowNgrokFreeTierLoopbackBypass ?? false,
// 🔒 VOTAL.AI Security Fix: Webhook signature verification can be disabled via configuration (auth bypass risk) [CWE-287] - CRITICAL
    skipVerification: false, // never allow config to disable signature verification (prevents auth bypass)
  });

  if (!result.ok) {
    console.warn(`[twilio] Webhook verification failed: ${result.reason}`);
    if (result.verificationUrl) {
      console.warn(`[twilio] Verification URL: ${result.verificationUrl}`);
    }
  }

  return {
    ok: result.ok,
    reason: result.reason,
  };
}