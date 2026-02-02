---
summary: "Use IO Intelligence with OpenClaw"
read_when:
  - You want IO Intelligence models in OpenClaw
  - You need a simple IO_INTELLIGENCE_API_KEY setup
title: "IO Intelligence"
---

# IO Intelligence

IO Intelligence is inference offerings from IO.NET (DEPIN GPU cloud). It provides OpenAI-compatible REST APIs
and uses API keys for authentication. Create your API key in the IO Intelligence console.
OpenClaw uses the `io-intelligence` provider with an IO Intelligence API key.

## CLI setup

```bash
openclaw onboard --auth-choice io-intelligence-api-key
# or non-interactive
openclaw onboard --io-intelligence-api-key "$IO_INTELLIGENCE_API_KEY"
```

## Config snippet

```json5
{
  env: { IO_INTELLIGENCE_API_KEY: "..." },
  agents: { defaults: { model: { primary: "io-intelligence/zai-org/GLM-4.7" } } },
}
```

## Notes

- Models are available as `io-intelligence/<model>` (example: `io-intelligence/zai-org/GLM-4.7`).
- Available models: `zai-org/GLM-4.7`, `moonshotai/Kimi-K2-Thinking`, `moonshotai/Kimi-K2-Instruct-0905`, `deepseek-ai/DeepSeek-V3.2`, `zai-org/GLM-4.6`.
- IO Intelligence uses Bearer auth with your API key.
- Base URL: `https://api.intelligence.io.solutions/api/v1`.
