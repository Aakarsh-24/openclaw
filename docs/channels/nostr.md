---
summary: "Nostr DM channel via NIP-04 encrypted messages"
read_when:
  - You want Clawdbot to receive DMs via Nostr
  - You're setting up decentralized messaging
---
# Nostr

**Status:** Optional plugin (disabled by default).

Nostr is a decentralized protocol for social networking. This channel enables Clawdbot to receive and respond to encrypted direct messages (DMs) via NIP-04.

## Plugin setup

Nostr is bundled with Clawdbot. Its dependencies are automatically installed on first load
when you enable the plugin.

To enable, add `nostr` to your plugins allow list:

```json5
{
  plugins: {
    allow: ["nostr"]
  }
}
```

The onboarding wizard (`clawdbot onboard`) and `clawdbot channels add` also offer to enable
Nostr when you select it.

Alternatively, install explicitly from npm:

```bash
clawdbot plugins install @clawdbot/nostr
```

Restart the Gateway after enabling plugins.

## Quick setup

1) Generate a Nostr keypair (if needed):

```bash
# Using nak
nak key generate
```

2) Add to config:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3) Export the key:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4) Restart the Gateway.

## Configuration reference

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `privateKey` | string | required | Private key in `nsec` or hex format |
| `relays` | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | Relay URLs (WebSocket) |
| `dmPolicy` | string | `pairing` | DM access policy |
| `allowFrom` | string[] | `[]` | Allowed sender pubkeys |
| `enabled` | boolean | `true` | Enable/disable channel |
| `name` | string | - | Display name |
| `profile` | object | - | NIP-01 profile metadata |

## Profile metadata

Profile data is published as a NIP-01 `kind:0` event. You can manage it from the Control UI (Channels -> Nostr -> Profile) or set it directly in config.

Example:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "clawdbot",
        "displayName": "Clawdbot",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "clawdbot@example.com",
        "lud16": "clawdbot@example.com"
      }
    }
  }
}
```

Notes:

- Profile URLs must use `https://`.
- Importing from relays merges fields and preserves local overrides.

## Access control

### DM policies

- **pairing** (default): unknown senders get a pairing code.
- **allowlist**: only pubkeys in `allowFrom` can DM.
- **open**: public inbound DMs (requires `allowFrom: ["*"]`).
- **disabled**: ignore inbound DMs.

### Allowlist example

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## Key formats

Accepted formats:

- **Private key:** `nsec...` or 64-char hex
- **Pubkeys (`allowFrom`):** `npub...` or hex

## Relays

Defaults: `relay.damus.io` and `nos.lol`.

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": [
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://nostr.wine"
      ]
    }
  }
}
```

Tips:

- Use 2-3 relays for redundancy.
- Avoid too many relays (latency, duplication).
- Paid relays can improve reliability.
- Local relays are fine for testing (`ws://localhost:7777`).

## Protocol support

| NIP | Status | Description |
| --- | --- | --- |
| NIP-01 | Supported | Basic event format + profile metadata |
| NIP-04 | Supported | Encrypted DMs (`kind:4`) |
| NIP-17 | Planned | Gift-wrapped DMs |
| NIP-44 | Planned | Versioned encryption |

## Testing

### Local relay

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### Manual test

1) Note the bot pubkey (npub) from logs.
2) Open a Nostr client (Damus, Amethyst, etc.).
3) DM the bot pubkey.
4) Verify the response.

## Troubleshooting

### Not receiving messages

- Verify the private key is valid.
- Ensure relay URLs are reachable and use `wss://` (or `ws://` for local).
- Confirm `enabled` is not `false`.
- Check Gateway logs for relay connection errors.

### Not sending responses

- Check relay accepts writes.
- Verify outbound connectivity.
- Watch for relay rate limits.

### Duplicate responses

- Expected when using multiple relays.
- Messages are deduplicated by event ID; only the first delivery triggers a response.

## Security

- Never commit private keys.
- Use environment variables for keys.
- Consider `allowlist` for production bots.

## Limitations (MVP)

- Direct messages only (no group chats).
- No media attachments.
- NIP-04 only (NIP-17 gift-wrap planned).
