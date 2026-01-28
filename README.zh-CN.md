# 🦞 Moltbot — 个人 AI 助手

<p align="center">
  <img src="https://raw.githubusercontent.com/moltbot/moltbot/main/docs/whatsapp-clawd.jpg" alt="Clawdbot" width="400">
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

**Moltbot** 是一个运行在你自己设备上的*个人 AI 助手*。
它可以在你常用的渠道上回复你（WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams、WebChat），以及扩展渠道如 BlueBubbles、Matrix、Zalo 等。它可以在 macOS/iOS/Android 上语音交互，还可以渲染你控制的实时 Canvas。Gateway 只是控制平面——产品就是助手本身。

如果你想要一个感觉本地化、快速且始终在线的个人单用户助手，这就是它。

[官网](https://molt.bot) · [文档](https://docs.molt.bot) · [快速开始](https://docs.molt.bot/start/getting-started) · [更新指南](https://docs.molt.bot/install/updating) · [展示](https://docs.molt.bot/start/showcase) · [FAQ](https://docs.molt.bot/start/faq) · [向导](https://docs.molt.bot/start/wizard) · [Discord](https://discord.gg/clawd)

---

## 🚀 快速开始

**系统要求：** Node ≥22

### 安装（推荐）

```bash
npm install -g moltbot@latest
# 或: pnpm add -g moltbot@latest

moltbot onboard --install-daemon
```

向导会安装 Gateway 守护进程（launchd/systemd 用户服务），使其保持运行。

### 快速开始（TL;DR）

```bash
moltbot onboard --install-daemon

moltbot gateway --port 18789 --verbose

# 发送消息
moltbot message send --to +1234567890 --message "来自 Moltbot 的问候"

# 与助手对话
moltbot agent --message "今日待办清单" --thinking high
```

---

## 📦 从源码安装（开发）

推荐使用 `pnpm` 从源码构建。

```bash
git clone https://github.com/moltbot/moltbot.git
cd moltbot

pnpm install
pnpm ui:build  # 首次运行会自动安装 UI 依赖
pnpm build

pnpm moltbot onboard --install-daemon

# 开发循环（TS 变更自动重载）
pnpm gateway:watch
```

---

## 🔑 模型支持

**推荐订阅（OAuth）：**
- **[Anthropic](https://www.anthropic.com/)** (Claude Pro/Max) — 推荐
- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

模型说明：虽然支持任何模型，但强烈推荐 **Anthropic Pro/Max + Opus 4.5**，具有更强的长上下文能力和更好的提示注入抵抗力。

---

## 📱 支持的渠道

### 核心渠道
| 渠道 | 说明 |
|------|------|
| WhatsApp | 通过 Baileys 支持 |
| Telegram | 通过 grammY 支持 |
| Slack | 通过 Bolt 支持 |
| Discord | 通过 discord.js 支持 |
| Google Chat | 通过 Chat API 支持 |
| Signal | 通过 signal-cli 支持 |
| iMessage | 通过 imsg 支持（仅 macOS） |
| WebChat | 内置 web 界面 |

### 扩展渠道
BlueBubbles、Microsoft Teams、Matrix、Zalo、Mattermost、Nextcloud Talk 等

---

## ⚙️ 配置

配置文件位置：`~/.clawdbot/moltbot.json`

**最小配置：**
```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

**带渠道配置：**
```json5
{
  channels: {
    telegram: {
      botToken: "YOUR_BOT_TOKEN",
      allowFrom: ["YOUR_USER_ID"]
    }
  }
}
```

详细配置请参考：[配置参考](https://docs.molt.bot/gateway/configuration)

---

## 💬 聊天命令

在 WhatsApp/Telegram/Slack 等渠道发送：

| 命令 | 说明 |
|------|------|
| `/status` | 查看会话状态（模型 + tokens） |
| `/new` 或 `/reset` | 重置会话 |
| `/compact` | 压缩会话上下文 |
| `/think <级别>` | off\|minimal\|low\|medium\|high\|xhigh |
| `/verbose on\|off` | 详细模式 |
| `/usage off\|tokens\|full` | 每次响应的用量页脚 |

---

## 🔒 安全模型

- **默认：** 工具在宿主机上为 **main** 会话运行，所以当只有你使用时，助手有完全访问权限。
- **群组/渠道安全：** 设置 `agents.defaults.sandbox.mode: "non-main"` 可以在 Docker 沙箱中运行非 main 会话。

详情：[安全指南](https://docs.molt.bot/gateway/security)

---

## 📚 文档链接

- [入门指南](https://docs.molt.bot/start/getting-started)
- [配置参考](https://docs.molt.bot/gateway/configuration)
- [架构概述](https://docs.molt.bot/concepts/architecture)
- [渠道文档](https://docs.molt.bot/channels)
- [工具文档](https://docs.molt.bot/tools)
- [故障排除](https://docs.molt.bot/channels/troubleshooting)

---

## 🤝 贡献

欢迎贡献！参见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解指南。

AI 辅助的 PR 也欢迎！🤖 只需在 PR 中标注即可。

---

## 📜 许可证

[MIT License](LICENSE)
