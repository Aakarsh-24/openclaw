---
summary: "~/.clawdbot/moltbot.json 的所有配置选项及示例"
read_when:
  - 添加或修改配置字段
---

# 配置 🔧

Moltbot 从 `~/.clawdbot/moltbot.json` 读取可选的 **JSON5** 配置（支持注释和尾随逗号）。

如果文件不存在，Moltbot 使用安全的默认值（嵌入式 Pi 代理 + 每发送者会话 + 工作区 `~/clawd`）。通常只需要配置以下内容：
- 限制谁可以触发机器人（`channels.whatsapp.allowFrom`、`channels.telegram.allowFrom` 等）
- 控制群组允许列表 + 提及行为
- 自定义消息前缀
- 设置代理的工作区
- 调整嵌入式代理默认值和会话行为

---

## 严格配置验证

Moltbot 只接受完全匹配架构的配置。
未知键、格式错误的类型或无效值会导致网关**拒绝启动**以确保安全。

验证失败时：
- 网关不会启动。
- 只允许诊断命令（例如：`moltbot doctor`、`moltbot logs`、`moltbot health`）。
- 运行 `moltbot doctor` 查看确切问题。
- 运行 `moltbot doctor --fix` 应用迁移/修复。

---

## 最小配置（推荐起点）

```json5
{
  agents: { defaults: { workspace: "~/clawd" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } }
}
```

---

## 常用选项

### 环境变量

Moltbot 从父进程读取环境变量。另外加载：
- 当前工作目录的 `.env`（如果存在）
- `~/.clawdbot/.env` 的全局回退

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-..."
    }
  }
}
```

### 配置中的环境变量替换

可以使用 `${VAR_NAME}` 语法在任何配置字符串值中引用环境变量：

```json5
{
  models: {
    providers: {
      "custom-provider": {
        apiKey: "${CUSTOM_API_KEY}"
      }
    }
  }
}
```

---

## 渠道配置

### WhatsApp

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing",  // pairing | allowlist | open | disabled
      allowFrom: ["+15555550123", "+447700900123"],
      textChunkLimit: 4000,  // 可选出站块大小（字符）
      mediaMaxMb: 50  // 可选入站媒体上限（MB）
    }
  }
}
```

**DM 策略说明：**
| 值 | 说明 |
|----|------|
| `pairing` | 默认，未知发送者获得配对码；所有者必须批准 |
| `allowlist` | 只允许 `allowFrom` 中的发送者 |
| `open` | 允许所有入站 DM（**需要** `allowFrom` 包含 `"*"`） |
| `disabled` | 忽略所有入站 DM |

### Telegram

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABC...",
      allowFrom: ["5347394567"],  // 你的 Telegram 用户 ID
      groups: {
        "*": { requireMention: true }
      }
    }
  }
}
```

**获取 Bot Token：**
1. 在 Telegram 中找 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 复制返回的 token

**获取用户 ID：**
给机器人发消息后，机器人会返回你的用户 ID。

### Discord

```json5
{
  channels: {
    discord: {
      token: "YOUR_BOT_TOKEN",
      dm: {
        policy: "pairing",
        allowFrom: ["USER_ID"]
      },
      guilds: {
        "GUILD_ID": {
          channels: {
            "CHANNEL_NAME": { allow: true }
          }
        }
      }
    }
  }
}
```

### Slack

```json5
{
  channels: {
    slack: {
      botToken: "xoxb-...",
      appToken: "xapp-...",
      channels: {
        "#general": { allow: true }
      }
    }
  }
}
```

---

## 代理配置

### 模型配置

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-5",
        fallbacks: ["openai/gpt-5"]
      },
      workspace: "~/clawd"
    }
  }
}
```

### 多代理配置

```json5
{
  agents: {
    defaults: {
      workspace: "~/clawd"
    },
    list: [
      {
        id: "main",
        default: true,
        identity: {
          name: "助手",
          emoji: "🦞"
        }
      },
      {
        id: "work",
        workspace: "~/clawd-work",
        model: "openai/gpt-5"
      }
    ]
  }
}
```

### 代理身份

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "小龙",
          theme: "友好的助手",
          emoji: "🦞",
          avatar: "avatars/lobster.png"
        }
      }
    ]
  }
}
```

---

## 群组聊天配置

### 提及门控

群组消息默认**需要提及**（元数据提及或正则模式）。

```json5
{
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@小龙", "小龙", "助手"]
        }
      }
    ]
  }
}
```

### 群组策略

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",  // open | disabled | allowlist
      groups: {
        "*": { requireMention: true }
      }
    },
    telegram: {
      groupPolicy: "allowlist",
      groups: {
        "*": { requireMention: true }
      }
    }
  }
}
```

---

## 网关配置

```json5
{
  gateway: {
    mode: "local",
    port: 18789,
    bind: "loopback",
    auth: {
      mode: "token",
      token: "your-secret-token"
    },
    tailscale: {
      mode: "off"  // off | serve | funnel
    }
  }
}
```

---

## 日志配置

```json5
{
  logging: {
    level: "info",
    file: "/tmp/moltbot/moltbot.log",
    consoleLevel: "info",
    consoleStyle: "pretty",  // pretty | compact | json
    redactSensitive: "tools"
  }
}
```

---

## 沙箱配置

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",  // off | non-main | all
        scope: "session",  // session | agent | shared
        workspaceAccess: "rw"  // none | ro | rw
      }
    }
  }
}
```

---

## 完整示例

```json5
{
  // 代理设置
  agents: {
    defaults: {
      workspace: "~/clawd",
      model: {
        primary: "anthropic/claude-opus-4-5"
      }
    },
    list: [
      {
        id: "main",
        identity: {
          name: "小龙",
          emoji: "🦞"
        },
        groupChat: {
          mentionPatterns: ["@小龙", "小龙"]
        }
      }
    ]
  },

  // 网关设置
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: {
      mode: "token",
      token: "your-secret-token"
    }
  },

  // 渠道设置
  channels: {
    telegram: {
      enabled: true,
      botToken: "YOUR_BOT_TOKEN",
      allowFrom: ["YOUR_USER_ID"]
    },
    whatsapp: {
      dmPolicy: "pairing",
      allowFrom: ["+8612345678901"]
    }
  },

  // 日志设置
  logging: {
    level: "info",
    consoleStyle: "pretty"
  }
}
```

---

## 更多信息

- [配置示例](https://docs.molt.bot/gateway/configuration-examples)
- [安全指南](https://docs.molt.bot/gateway/security)
- [多代理配置](https://docs.molt.bot/multi-agent-sandbox-tools)
