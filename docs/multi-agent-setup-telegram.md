# Multi-Agent System Setup Guide (Telegram)

This guide provides a comprehensive, step-by-step walkthrough to setting up a Multi-Agent Moltbot system from scratch, using Telegram as the interface.

## 1. Prerequisites

Before you begin, ensure you have:
1.  **Node.js 18+** installed.
2.  **Moltbot** repository cloned and dependencies installed (`npm install`).
3.  **Two Telegram Bot Tokens**:
    *   Talk to [@BotFather](https://t.me/botfather) on Telegram.
    *   Create two separate bots (e.g., `my_support_bot` and `my_sales_bot`).
    *   Save their tokens.
4.  **Telegram User IDs**:
    *   Talk to [@userinfobot](https://t.me/userinfobot) to get your numeric ID (e.g., `12345678`).
    *   Get the IDs for any other users you want to allow.
5.  **LLM API Keys**:
    *   OpenAI API Key (if using GPT-4o).
    *   Google Gemini API Key (if using Gemini).

## 2. Configuration Steps

All configuration happens in your `~/.moltbot/config.json5` file (or `config.json5` in the project root).

> **Tip**: You can also edit this configuration directly in the Moltbot UI by switching to **Raw Mode** in the settings.

### Step 1: Define Global Defaults
Set up your default models so you don't have to repeat them for every agent.

```json5
agents: {
  defaults: {
    model: {
      primary: "google/gemini-3-flash-preview",
      fallbacks: ["openai/gpt-5-nano"]
    }
  }
}
```

### Step 2: Create Agents
Define the "brains" of your system. Each agent gets its own workspace and memory.

```json5
agents: {
  list: [
    { id: "agent_1", name: "User 1 Assistant" },
    { id: "agent_2", name: "User 2 Assistant" }
  ]
}
```

### Step 3: Configure Telegram Accounts
Add your bot tokens. Use `allowFrom` to restrict who can talk to which bot.

```json5
channels: {
  telegram: {
    enabled: true,
    accounts: {
      bot_one: { // Internal alias for the first bot
        botToken: "YOUR_FIRST_BOT_TOKEN",
        dmPolicy: "allowlist",
        allowFrom: ["USER_1_TELEGRAM_ID"]
      },
      bot_two: { // Internal alias for the second bot
        botToken: "YOUR_SECOND_BOT_TOKEN",
        dmPolicy: "allowlist",
        allowFrom: ["USER_2_TELEGRAM_ID"]
      }
    }
  }
}
```

### Step 4: Bind Agents to Bots
Connect the brains (Agents) to the bodies (Bots).

```json5
bindings: [
  // Route messages from "bot_one" to "agent_1"
  {
    agentId: "agent_1",
    match: { channel: "telegram", accountId: "bot_one" }
  },
  // Route messages from "bot_two" to "agent_2"
  {
    agentId: "agent_2",
    match: { channel: "telegram", accountId: "bot_two" }
  }
]
```

## 3. Running the System

Start the gateway:
```bash
clawdbot gateway --port 18789
```

*   **Status Check**: The logs will show both agents initializing. You should see output similar to this:

```text
16:29:09 [gateway] agent model: google/gemini-3-flash-preview
16:29:09 [gateway] listening on ws://127.0.0.1:18789
16:29:10 [hooks] loaded 3 internal hook handlers
16:29:10 [telegram] [user1_bot] starting provider (@User1_Assistant_Bot)
16:29:11 [telegram] [user2_bot] starting provider (@User2_Assistant_Bot)
```
*   **Memory**: Upon the first message, Moltbot will create `~/clawd/agents/agent_1/MEMORY.md` and `~/clawd/agents/agent_2/MEMORY.md`.

## 4. Architecture & Isolation

### Visual Flow
![Multi-Agent Flow](./multi_agent_flow.md)

### Privacy Model
*   **Memory**: **ISOLATED**. Agent 1 cannot see Agent 2's memory files. They live in separate folders.
*   **Cron Jobs**: **SHARED VISAIBILITY**. Agents can see the global schedule of tasks but **ISOLATED EXECUTION**. A job scheduled by Agent 1 executes *as* Agent 1.

## 5. Complete Configuration Example

Here is a complete, configuration file based on a working setup. **Copy this and replace the placeholder values.**

```json5
{
    "meta": {
        "lastTouchedVersion": "2026.1.24-3",
        "lastTouchedAt": "2026-01-27T15:46:51.393Z"
    },
    "wizard": {
        "lastRunAt": "2026-01-27T15:46:51.384Z",
        "lastRunVersion": "2026.1.24-3",
        "lastRunCommand": "onboard",
        "lastRunMode": "local"
    },
    "auth": {
        "profiles": {
            "google:default": {
                "provider": "google",
                "mode": "api_key"
            }
        }
    },
    "agents": {
        "defaults": {
            "model": {
                "fallbacks": [
                    "openai/gpt-5-nano"
                ],
                "primary": "google/gemini-3-flash-preview"
            },
            "models": {
                "google/gemini-3-flash-preview": {
                    "alias": "gemini"
                },
                "openai/gpt-5-nano": {}
            },
            "workspace": "/home/clawbot/clawd",
            "maxConcurrent": 4,
            "subagents": {
                "maxConcurrent": 8
            }
        },
        "list": [
            {
                "id": "agent_1",
                "name": "User 1 Assistant"
            },
            {
                "id": "agent_2",
                "name": "User 2 Assistant"
            }
        ]
    },
    "bindings": [
        {
            "agentId": "agent_1",
            "match": {
                "channel": "telegram",
                "accountId": "user1_bot"
            }
        },
        {
            "agentId": "agent_2",
            "match": {
                "channel": "telegram",
                "accountId": "user2_bot"
            }
        }
    ],
    "messages": {
        "ackReactionScope": "all"
    },
    "commands": {
        "native": "auto",
        "nativeSkills": "auto"
    },
    "channels": {
        "telegram": {
            "enabled": true,
            "streamMode": "off",
            "accounts": {
                "user1_bot": {
                    "botToken": "REPLACE_WITH_USER_1_BOT_TOKEN",
                    "dmPolicy": "allowlist",
                    "allowFrom": [
                        "REPLACE_WITH_USER_1_ID"
                    ],
                    "groupPolicy": "allowlist"
                },
                "user2_bot": {
                    "botToken": "REPLACE_WITH_USER_2_BOT_TOKEN",
                    "dmPolicy": "allowlist",
                    "allowFrom": [
                        "REPLACE_WITH_USER_1_ID",
                        "REPLACE_WITH_USER_2_ID"
                    ],
                    "groupPolicy": "allowlist"
                }
            }
        }
    },
    "gateway": {
        "port": 18789,
        "mode": "local",
        "bind": "loopback",
        "auth": {
            "mode": "token",
            "token": "REPLACE_WITH_YOUR_GATEWAY_TOKEN"
        },
        "tailscale": {
            "mode": "off",
            "resetOnExit": false
        }
    },
    "skills": {
        "install": {
            "nodeManager": "npm"
        },
        "entries": {
            "nano-banana-pro": {
                "enabled": true,
                "apiKey": "REPLACE_WITH_YOUR_API_KEY"
            },
            "clawdhub": {
                "enabled": true
            },
            "coding-agent": {
                "enabled": false
            },
            "goplaces": {
                "enabled": true,
                "apiKey": "REPLACE_WITH_YOUR_API_KEY"
            },
            "skill-creator": {
                "enabled": true
            }
        }
    },
    "plugins": {
        "entries": {
            "telegram": {
                "enabled": true
            }
        }
    },
    "hooks": {
        "internal": {
            "enabled": true,
            "entries": {
                "session-memory": {
                    "enabled": true
                },
                "command-logger": {
                    "enabled": true
                },
                "boot-md": {
                    "enabled": true
                }
            }
        }
    }
}
```
