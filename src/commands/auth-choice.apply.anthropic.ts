import { upsertAuthProfile } from "../agents/auth-profiles.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { buildTokenProfileId, validateAnthropicSetupToken } from "./auth-token.js";
import { applyAuthProfileConfig, setAnthropicApiKey } from "./onboard-auth.js";

export async function applyAuthChoiceAnthropic(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (
    params.authChoice === "setup-token" ||
    params.authChoice === "oauth" ||
    params.authChoice === "token"
  ) {
    let nextConfig = params.config;
    await params.prompter.note(
      ["Run `claude setup-token` in your terminal.", "Then paste the generated token below."].join(
        "\n",
      ),
      "Anthropic setup-token",
    );

    const tokenRaw = await params.prompter.text({
      message: "Paste Anthropic setup-token",
      validate: (value) => validateAnthropicSetupToken(String(value ?? "")),
    });
    const token = String(tokenRaw).trim();

    const profileNameRaw = await params.prompter.text({
      message: "Token name (blank = default)",
      placeholder: "default",
    });
    const provider = "anthropic";
    const namedProfileId = buildTokenProfileId({
      provider,
      name: String(profileNameRaw ?? ""),
    });

    upsertAuthProfile({
      profileId: namedProfileId,
      agentDir: params.agentDir,
      credential: {
        type: "token",
        provider,
        token,
      },
    });

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: namedProfileId,
      provider,
      mode: "token",
    });

    // setup-token only grants user:inference scope; usage tracking (/status)
    // requires user:profile which is only available via the full OAuth flow.
    // See: https://github.com/anthropics/claude-code/issues/16075
    await params.prompter.note(
      [
        "Note: `claude setup-token` does not include the user:profile scope.",
        "Usage tracking in /status will not be available with this token.",
        "To enable usage tracking, run `claude login` (full browser OAuth)",
        "on a machine with a browser, then use `openclaw models auth paste-token`",
        "to import the resulting token.",
      ].join("\n"),
      "Usage tracking limitation",
    );

    return { config: nextConfig };
  }

  if (params.authChoice === "apiKey") {
    if (params.opts?.tokenProvider && params.opts.tokenProvider !== "anthropic") {
      return null;
    }

    let nextConfig = params.config;
    let hasCredential = false;
    const envKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (params.opts?.token) {
      await setAnthropicApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential && envKey) {
      const useExisting = await params.prompter.confirm({
        message: `Use existing ANTHROPIC_API_KEY (env, ${formatApiKeyPreview(envKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setAnthropicApiKey(envKey, params.agentDir);
        hasCredential = true;
      }
    }
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "Enter Anthropic API key",
        validate: validateApiKeyInput,
      });
      await setAnthropicApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "anthropic:default",
      provider: "anthropic",
      mode: "api_key",
    });
    return { config: nextConfig };
  }

  return null;
}
