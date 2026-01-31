---
summary: "Connect a Telegram user account via MTProto (DMs + groups)"
read_when:
  - Working on telegram user plugin
---
# Telegram User (MTProto)

Telegram User logs OpenClaw in as a real Telegram user via MTProto. It keeps full group visibility and the same media limits as the mobile app. Run it on a **dedicated automation account** (not your primary account).

## Comparison with the Bot API

| Topic | Telegram (Bot API) | Telegram User (MTProto) |
| --- | --- | --- |
| Identity | Bot you create with @BotFather. | Logged-in user session (dedicated account recommended). |
| Setup | Built-in; only needs bot token. | Plugin; needs API ID/API hash + QR/phone login. |
| Group visibility | Limited if privacy mode is on or bot isn’t admin. | Sees everything the user sees, incl. forum topics. |
| Media cap | 50 MB via hosted Bot API. | App limits: up to 2 GB (4 GB with Premium). |
| Commands | Native bot menu supported. | No bot commands; rely on pairing/allowlists. |

## What it is
- MTProto user session driven by `@mtcute/node` (no Bot API token needed).
- Supports DMs, groups, supergroups, and forum topics; channels/broadcast posts are ignored.
- No native bot commands; pairing and allowlists gate who can talk to it.

## Requirements
- Telegram API ID + API hash from [my.telegram.org](https://my.telegram.org).
- `telegram-user` plugin available in the workspace.

## Install and add an account
- If your build already bundles the plugin (default in this repo), skip install.
- From this repo checkout:
  ```bash
  openclaw plugins install ./extensions/telegram-user
  ```
  (Use an absolute path if running outside the repo root.)
- If a packaged release is published later, you can install that spec instead (not on npm today).
- Get the API ID + API hash (per Telegram’s developer portal):
  1. Sign in at https://my.telegram.org with the automation account you’ll use.
  2. Open “API Development Tools”.
  3. Create an app (any name; platform can be “Other”).
  4. Copy the **App api_id** and **App api_hash**; keep them secret.
- Add credentials (default account):
  ```bash
  openclaw channels add --channel telegram-user --api-id 123456 --api-hash your_api_hash
  ```
- Env shortcut (default account only):
  ```bash
  export TELEGRAM_USER_API_ID="123456"
  export TELEGRAM_USER_API_HASH="your_api_hash"
  openclaw channels add --channel telegram-user --use-env
  ```
- Multi-account: append `--account team-bot` to the `channels add` and `channels login` commands; each account stores its own session file.

## Link the account (QR or phone)
- QR (default, interactive):
  ```bash
  openclaw channels login --channel telegram-user
  ```
- Phone/SMS or in-app code (set before running login):
  ```bash
  export TELEGRAM_USER_PHONE="+15551234567"
  # optional helpers
  export TELEGRAM_USER_CODE="12345"        # one-time code
  export TELEGRAM_USER_PASSWORD="hunter2"  # 2FA password
  openclaw channels login --channel telegram-user
  ```
- Sessions are stored at `$STATE_DIR/telegram-user/session-<account>.sqlite` (default `~/.openclaw/...`).
- Logout/clear credentials: `openclaw channels logout --channel telegram-user [--account <id>]`.

## Defaults and access control
- DMs: `dmPolicy: "pairing"` with `allowFrom: []`. Unknown senders get a pairing code; approve via `openclaw pairing approve telegram-user <code>` (see [Pairing](/start/pairing)).
- Groups: `groupPolicy: "allowlist"` with `groupAllowFrom` falling back to `allowFrom`. If both are empty, group messages are dropped. Set `groupAllowFrom` or switch `groupPolicy` to `open` if you intentionally want anyone in allowed groups.
- Mentions: groups default to require a mention. Override per group/topic with `requireMention: false` when you want always-on replies.
- Chunking: text chunks at 4000 chars; media limit defaults to 5 MB unless you raise `channels.telegram-user.mediaMaxMb`.
- Reply threading: `replyToMode: "first"` by default; `"all"` threads every chunk, `"off"` disables threaded replies.

Example allowlist config (per-account):
```json5
{
  channels: {
    "telegram-user": {
      dmPolicy: "pairing",
      allowFrom: [123456789],
      groupPolicy: "allowlist",
      groupAllowFrom: [123456789, "@teammate"],
      groups: {
        "-1001234567890": { requireMention: false }
      }
    }
  }
}
```

## Groups and topics
- `channels.telegram-user.groups.<chatId>` controls mention gating, allowlists, skills, system prompts, and optional tool limits (`tools`).
- Forum topics inherit their parent group settings; override under `groups.<chatId>.topics.<threadId>`.
- Disable specific groups or topics with `enabled: false`.

## Sending, polls, and limits
- Targets: numeric chat ID or `@username`; forum topics add `:topic:<threadId>` (or pass `threadId` in tool params). Example: `-1001234567890:topic:42`.
- Text: markdown-safe chunking at 4000 chars. `replyToId` is honored when supplied.
- Media: URLs are downloaded and sent; default cap 5 MB (`mediaMaxMb`). Audio can be sent as voice notes when `audioAsVoice` is true and the file is OGG/OPUS; Telegram falls back to a file if voice notes are blocked.
- Polls: `poll` action is enabled; 2–10 options, `maxSelections` ≤ option count. Telegram rejects polls in DMs—use a group or supergroup ID.

## Benefits
- Full group/topic visibility without privacy-mode gaps.
- Higher media ceilings than the Bot API (up to app limits).

## Ban / risk notes
- MTProto automation can be rate-limited or banned if abused. Use a dedicated automation account, keep traffic human-scale, and avoid spammy broadcast behavior.
- Losing the session file or rotating API credentials will require re-login.

## Limitations
- No broadcast channel handling.
- No inline buttons or native bot commands.
- Calls are not supported.
