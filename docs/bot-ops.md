# Bot Ops (Make Targets)

These targets control the **macOS menubar app**, which hosts the gateway and
providers (Telegram/WhatsApp/Discord). They do **not** start ad-hoc gateway
processes; they launch/stop the app.

## Prereqs
- Clawdis.app exists at `/Applications/Clawdis.app` or `dist/Clawdis.app`.
  - Override with `CLAWDIS_APP_BUNDLE=/path/to/Clawdis.app`.
- Telegram bot token is set in `~/.clawdis/clawdis.json` (the app does not read
  the repo `.env`):
  ```json
  {
    "telegram": {
      "botToken": "<YOUR_TOKEN>",
      "allowFrom": ["<YOUR_TELEGRAM_ID>"]
    }
  }
  ```

## Commands
- `make bot-start`  
  Launch the menubar app (gateway + providers).

- `make bot-stop`  
  Stop the menubar app and its gateway child process.

- `make bot-restart`  
  Rebuild, package, and relaunch the app (`scripts/restart-mac.sh`).
  - Requires a Swift toolchain that supports `.macOS(.v15)` in
    `apps/macos/Package.swift` (Xcode 16 / updated Command Line Tools).

- `make bot-status`  
  Local status summary (does not require gateway connectivity).

- `make bot-health`  
  Probes the running gateway + providers (fails if the gateway is down).

## Notes
- If `make bot-health` reports `gateway closed (1006)`, the app/gateway is not
  running. Start it and retry.
- For logs: `/tmp/clawdis/clawdis-YYYY-MM-DD.log` or `./scripts/clawlog.sh`.
