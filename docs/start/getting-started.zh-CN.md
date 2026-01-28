---
summary: "入门指南：从零到第一条消息（向导、认证、渠道、配对）"
read_when:
  - 首次从零开始设置
  - 你想要从安装→引导→第一条消息的最快路径
---

# 快速开始

目标：尽快从 **零** → **第一个运行的聊天**（使用合理的默认值）。

最快的聊天方式：打开控制 UI（无需渠道设置）。运行 `moltbot dashboard` 并在浏览器中聊天，或在网关主机上打开 `http://127.0.0.1:18789/`。
文档：[Dashboard](/web/dashboard) 和 [Control UI](/web/control-ui)。

推荐路径：使用 **CLI 引导向导** (`moltbot onboard`)。它会设置：
- 模型/认证（推荐 OAuth）
- 网关设置
- 渠道（WhatsApp/Telegram/Discord/Mattermost(插件)/...）
- 配对默认值（安全 DM）
- 工作区引导 + 技能
- 可选的后台服务

---

## 0) 前置条件

- Node `>=22`
- `pnpm`（可选；如果从源码构建则推荐）
- **推荐：** Brave Search API 密钥用于网络搜索。最简单的方式：
  `moltbot configure --section web`（存储 `tools.web.search.apiKey`）。

**macOS：** 如果计划构建应用，需安装 Xcode / CLT。仅 CLI + 网关只需要 Node。

**Windows：** 使用 **WSL2**（推荐 Ubuntu）。WSL2 是强烈推荐的；原生 Windows 未经测试，问题更多，工具兼容性较差。

---

## 1) 安装 CLI（推荐）

```bash
curl -fsSL https://molt.bot/install.sh | bash
```

**Windows (PowerShell)：**
```powershell
iwr -useb https://molt.bot/install.ps1 | iex
```

**替代方案（全局安装）：**
```bash
npm install -g moltbot@latest
# 或
pnpm add -g moltbot@latest
```

---

## 2) 运行引导向导（并安装服务）

```bash
moltbot onboard --install-daemon
```

你将选择：
- **本地 vs 远程** 网关
- **认证**：OpenAI Code (Codex) 订阅 (OAuth) 或 API 密钥。对于 Anthropic 推荐使用 API 密钥。
- **提供商**：WhatsApp 二维码登录、Telegram/Discord 机器人令牌等。
- **守护进程**：后台安装（launchd/systemd；WSL2 使用 systemd）
- **网关令牌**：向导默认生成一个并存储在 `gateway.auth.token` 中。

### 认证：存储位置（重要）

- **推荐 Anthropic 路径：** 设置 API 密钥（向导可以为服务使用存储它）。
- OAuth 凭证（旧版导入）：`~/.clawdbot/credentials/oauth.json`
- 认证配置文件（OAuth + API 密钥）：`~/.clawdbot/agents/<agentId>/agent/auth-profiles.json`

**无头/服务器提示：** 先在普通机器上进行 OAuth，然后将 `oauth.json` 复制到网关主机。

---

## 3) 启动网关

如果在引导期间安装了服务，网关应该已经在运行：

```bash
moltbot gateway status
```

**手动运行（前台）：**
```bash
moltbot gateway --port 18789 --verbose
```

**仪表板（本地回环）：** `http://127.0.0.1:18789/`

如果配置了令牌，将其粘贴到控制 UI 设置中。

⚠️ **Bun 警告（WhatsApp + Telegram）：** Bun 在这些渠道上有已知问题。如果使用 WhatsApp 或 Telegram，请用 **Node** 运行网关。

---

## 3.5) 快速验证（2 分钟）

```bash
moltbot status
moltbot health
moltbot security audit --deep
```

---

## 4) 配对 + 连接你的第一个聊天界面

### WhatsApp（二维码登录）

```bash
moltbot channels login
```

通过 WhatsApp → 设置 → 链接设备 扫描。

### Telegram / Discord / 其他

向导可以为你写入令牌/配置。如果偏好手动配置：
- Telegram：设置 `TELEGRAM_BOT_TOKEN` 环境变量或配置文件
- Discord：设置 `DISCORD_BOT_TOKEN` 环境变量

**Telegram DM 提示：** 你的第一个 DM 会返回一个配对码。需要批准它（见下一步），否则机器人不会响应。

---

## 5) DM 安全（配对批准）

默认行为：未知 DM 会收到一个短代码，消息在批准前不会被处理。
如果你的第一个 DM 没有收到回复，批准配对：

```bash
moltbot pairing list whatsapp
moltbot pairing approve whatsapp <code>
```

**注意：** Telegram 不使用配对，而是使用 `allowFrom` 配置：

```json5
{
  channels: {
    telegram: {
      allowFrom: ["YOUR_USER_ID"]
    }
  }
}
```

---

## 6) 从源码安装（开发）

```bash
git clone https://github.com/moltbot/moltbot.git
cd moltbot
pnpm install
pnpm ui:build  # 首次运行会自动安装 UI 依赖
pnpm build
pnpm moltbot onboard --install-daemon
```

**网关（从此仓库）：**
```bash
node moltbot.mjs gateway --port 18789 --verbose
```

---

## 7) 端到端验证

在新终端中，发送测试消息：

```bash
moltbot message send --target +15555550123 --message "来自 Moltbot 的问候"
```

如果 `moltbot health` 显示 "no auth configured"，返回向导设置 OAuth/密钥认证——没有它助手无法响应。

**提示：** `moltbot status --all` 是最好的可粘贴、只读调试报告。

---

## 下一步（可选，但很棒）

- macOS 菜单栏应用 + 语音唤醒：[macOS 应用](/platforms/macos)
- iOS/Android 节点（Canvas/相机/语音）：[节点](/nodes)
- 远程访问（SSH 隧道 / Tailscale Serve）：[远程访问](/gateway/remote)
