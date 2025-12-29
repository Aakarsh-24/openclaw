---
summary: "Manual end-to-end smoke tests (Telegram-focused) for verifying a local setup works"
read_when:
  - Validating provider + gateway + agent end-to-end
---
# Manual E2E Smoke Tests

These are **manual** smoke tests (not Vitest) to confirm the full pipeline works:

```
Telegram DM ─▶ Gateway ─▶ Agent (LLM + tools) ─▶ Telegram reply
        ▲            ▲
        └── CLI send/agent commands (via Gateway)
```

## Prerequisites

1) Secrets in `.env` (repo root):
- `TELEGRAM_BOT_TOKEN=...`
- LLM provider auth (see `docs/configuration.md#models-custom-providers--base-urls`)

2) Allowlist in `~/.clawdis/clawdis.json` for Telegram DMs:

```json5
{
  telegram: { allowFrom: ["<TELEGRAM_ID>"] }
}
```

3) Gateway running (leave it running in a dedicated terminal):

```bash
pnpm clawdis gateway --port 18789 --verbose --allow-unconfigured
```

## Telegram E2E (agent turn delivered to Telegram)

Run an agent turn and deliver the final reply to Telegram:

```bash
pnpm clawdis agent --message "тест" --provider telegram --to <TELEGRAM_ID> --deliver
```

Expected result:
- You see a reply message in Telegram.

## Telegram E2E (send-only sanity check)

If you want to verify the Telegram transport without running the LLM:

```bash
pnpm clawdis send --provider telegram --to <TELEGRAM_ID> --message "ping"
```

## Debug checklist

- Gateway logs: `/tmp/clawdis/clawdis-YYYY-MM-DD.log`
- Look for allowlist gating: `Blocked unauthorized telegram sender ... (not in allowFrom)`
- Look for provider/model auth failures: `401 ... Authorization Failure`

