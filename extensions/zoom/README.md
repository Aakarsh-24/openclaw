# @moltbot/zoom

Zoom Team Chat channel plugin for Moltbot (Team Chat Bot API).

## Install (local checkout)

```bash
moltbot plugins install ./extensions/zoom
```

## Install (npm)

```bash
moltbot plugins install @moltbot/zoom
```

Onboarding: select Zoom and confirm the install prompt to fetch the plugin automatically.

## Config

```json5
{
  channels: {
    zoom: {
      enabled: true,
      clientId: "YOUR_CLIENT_ID",
      clientSecret: "YOUR_CLIENT_SECRET",
      botJid: "YOUR_BOT_JID@xmppdev.zoom.us",
      secretToken: "YOUR_SECRET_TOKEN",
      apiHost: "https://zoomdev.us",  // Use https://api.zoom.us for production
      oauthHost: "https://zoomdev.us", // Use https://zoom.us for production
      dm: {
        policy: "open"  // open | closed | allowlist
      }
    }
  }
}
```

## Setup

1. Create a Team Chat App in [Zoom App Marketplace](https://marketplace.zoom.us/develop/create)
2. Enable the **Bot** feature
3. Configure webhook URL: `https://your-domain.com/webhooks/zoom`
4. Subscribe to `bot_notification` event
5. Install app to your Zoom account
6. Add credentials to config (above)
7. Restart the gateway

The webhook server runs on port 3001 (Gateway Control UI uses 3000).

Full documentation: [https://docs.molt.bot/channels/zoom](https://docs.molt.bot/channels/zoom)