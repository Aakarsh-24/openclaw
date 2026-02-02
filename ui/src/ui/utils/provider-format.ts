/**
 * Format provider ID to display name.
 * Shared utility used by model picker and chat views.
 */
export function formatProviderName(provider: string): string {
  const names: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    "google-antigravity": "Google AG",
    "github-copilot": "GitHub Copilot",
    deepseek: "DeepSeek",
    groq: "Groq",
    mistral: "Mistral",
    zai: "Z.AI",
    xai: "xAI",
    other: "Other",
  };
  return names[provider.toLowerCase()] || provider;
}
