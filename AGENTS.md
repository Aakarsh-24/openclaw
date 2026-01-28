# PipBot Setup - SIMPLE

## Goal

Get MoltBot running locally from a fresh fork. Run from source, no global installs.

**Product name:** Pip  
**Upstream repo:** https://github.com/moltbot/moltbot  
**New fork:** https://github.com/bloom-street/pipbot

---

## Step 1: Fork MoltBot

1. Go to https://github.com/moltbot/moltbot
2. Click "Fork" (top right)
3. Name it `pipbot`
4. Create under bloom-street org (or your account)

---

## Step 2: Clone Your Fork

```bash
cd ~/Projects
git clone https://github.com/bloom-street/pipbot
cd pipbot
```

---

## Step 3: Install & Build

```bash
npm install
npm run build
```

If there are errors, fix them before proceeding.

---

## Step 4: Run the Onboarding Wizard

```bash
npx . onboard
```

This will prompt for:
- LLM provider (choose Anthropic)
- API key (your Anthropic key)
- Other config options

Don't use `--install-daemon` yet - just testing manually.

---

## Step 5: Start the Gateway

```bash
npx . gateway --port 18789 --verbose
```

---

## Step 6: Test It

In another terminal:

```bash
# Check if gateway is running
curl http://127.0.0.1:18789/

# Or send a test message via CLI
cd ~/Projects/pipbot
npx . agent --message "Hello, what can you do?"
```

---

## What Success Looks Like

- PipBot gateway is running in a terminal
- Listening on port 18789
- Can send a message and get a response

---

## NOT doing yet

- DMG packaging
- Tauri integration  
- UI for setup
- Auto-start
- Permissions

---

## Useful Commands

```bash
# All commands run from ~/Projects/pipbot

# Check status
npx . gateway status

# Stop gateway
npx . gateway stop

# Run doctor to check setup
npx . doctor

# Update config
npx . configure
```
