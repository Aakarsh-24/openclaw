# Telegram Provider Investigation

## Summary
- Telegram is not "up" because the gateway is not reachable (no active listener on the gateway port).
- The Telegram bot token is available via repo `.env`, but the gateway process that should run outside the repo does not appear to load it, and the user config does not set `telegram.botToken`.

## Evidence
- `pnpm clawdis status --deep` fails with `gateway closed (1006)`, which indicates the CLI could not establish a gateway WebSocket session.
- No gateway listener is present on port `18789` (no process bound to the port).
- `launchctl print gui/$UID | rg clawdis` returns nothing, so the menubar app/gateway is not running.
- Stray `pnpm clawdis gateway --port 18789 --verbose --allow-unconfigured` processes are present but have no open sockets, suggesting they are hung or failed to bind.
- `/tmp/clawdis/clawdis-2025-12-30.log` shows only deprecation warnings and no gateway/telegram startup logs.
- `~/.clawdis/clawdis.json` includes `telegram.allowFrom` but **does not** include `telegram.botToken`.
- `.env` in the repo contains `TELEGRAM_BOT_TOKEN=[REDACTED]`, but this environment is only loaded when running the CLI from this repo.
- `printenv TELEGRAM_BOT_TOKEN` is empty in the current shell.

## Probable Causes
- The gateway (menubar app) is not running, so Telegram monitoring never starts.
- Even if the gateway is restarted, it will not see `TELEGRAM_BOT_TOKEN` unless the menubar app loads that env var or the token is set in `~/.clawdis/clawdis.json`.

## Recommended Actions
1. Restart the Clawdis menubar app (or `scripts/restart-mac.sh`) and verify the gateway is listening on `127.0.0.1:18789`.
2. Add `telegram.botToken` to `~/.clawdis/clawdis.json` or ensure the menubar app has `TELEGRAM_BOT_TOKEN` in its environment.
3. Re-run `pnpm clawdis status --deep` to confirm Telegram probe success.
4. Clean up any stale `pnpm clawdis gateway ...` processes that are not binding to the port.
