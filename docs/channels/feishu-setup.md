# 飞书/Feishu 集成完整指南

## 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [前提条件](#前提条件)
- [快速开始](#快速开始)
- [配置详解](#配置详解)
- [连接模式](#连接模式)
- [权限管理](#权限管理)
- [事件订阅](#事件订阅)
- [消息处理](#消息处理)
- [故障排查](#故障排查)
- [最佳实践](#最佳实践)
- [API参考](#api参考)

---

## 概述

### 什么是飞书插件?

Moltbot的飞书插件是一个**企业级AI助手集成方案**,通过飞书开放平台API实现:

- ✅ **双向消息** - 接收和发送消息
- ✅ **群组支持** - 支持群聊和私聊
- ✅ **富媒体** - 支持图片、文件、卡片消息
- ✅ **事件驱动** - 实时响应飞书事件
- ✅ **MCP协议** - 支持Model Context Protocol集成

### 核心特性

| 特性 | 说明 |
|------|------|
| **WebSocket长连接** | 实时消息推送,无需公网服务器 |
| **多租户支持** | 支持多个飞书应用 |
| **灵活策略** | open/pairing/allowlist三种访问模式 |
| **消息历史** | 自动维护对话上下文 |
| **富文本卡片** - 支持交互式卡片消息 |

---

## 架构设计

### 插件架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Moltbot Gateway                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Feishu Plugin Extension                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   Monitor    │  │    Bot       │  │    Send    │  │  │
│  │  │  (WebSocket) │  │  (Handler)   │  │  (Client)  │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    飞书开放平台 (Lark)                        │
│  - 事件推送                                                  │
│  - 消息接收                                                  │
│  - API调用                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 文件 | 职责 |
|------|------|------|
| **Monitor** | `monitor.ts` | WebSocket连接管理、事件监听 |
| **Bot Handler** | `bot.ts` | 消息处理、事件分发 |
| **Send Client** | `send.ts` | 消息发送、媒体上传 |
| **Accounts** | `accounts.ts` | 凭证解析、账号管理 |
| **Probe** | `probe.ts` | 连接测试、健康检查 |
| **Types** | `types.ts` | TypeScript类型定义 |

---

## 前提条件

### 1. 飞书企业账号

- 需要有一个飞书企业账号
- 管理员权限(创建自建应用)
- 访问: https://open.feishu.cn/

### 2. 应用凭证

从飞书开发者后台获取:
- **App ID** - 应用凭证
- **App Secret** - 应用密钥

### 3. 系统要求

- Node.js 22+
- Moltbot已安装并运行
- 网络能够访问飞书API

---

## 快速开始

### 步骤 1: 创建飞书应用

1. 访问飞书开发者后台: https://open.feishu.cn/app
2. 点击 **"创建企业自建应用"**
3. 填写应用信息:
   - **应用名称**: Moltbot助手
   - **应用描述**: AI企业助手
   - **应用图标**: 上传或选择默认图标

### 步骤 2: 获取应用凭证

1. 进入应用管理页面
2. 左侧导航: **"凭证与基础信息"**
3. 复制以下信息:
   - **App ID**: `cli_a9f1cc5722389bd7` (示例)
   - **App Secret**: `yE748No3yNQDIV0KP5O3TyplSEGclhag` (示例)

### 步骤 3: 配置Moltbot

打开Moltbot Web UI: http://127.0.0.1:18789/

1. **Settings** → **Config** → **Authentication**
2. 选择 **Raw** 查看方式
3. 添加以下配置:

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_a9f1cc5722389bd7",
      "appSecret": "yE748No3yNQDIV0KP5O3TyplSEGclhag",
      "domain": "feishu",
      "connectionMode": "websocket",
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist"
    }
  }
}
```

4. 点击 **Save** → **Update**
5. 重启网关:

```bash
moltbot gateway restart
```

### 步骤 4: 配置飞书事件订阅

#### 4.1 启用长连接模式

1. 飞书开发者后台 → **"事件与回调"**
2. **"事件配置"** → **订阅方式**
3. 选择 **"使用长连接接收事件"**
4. 点击 **"保存"**

#### 4.2 订阅消息事件

1. 点击 **"添加事件"**
2. 选择 **"消息与群组"** 分类
3. 勾选以下事件:
   - ✅ **im.message.receive_v1** - 接收消息
   - ✅ **im.chat.member.bot.added_v1** - 机器人被添加到群
   - ✅ **im.chat.member.bot.deleted_v1** - 机器人被移出群
4. 点击 **"确定"**

#### 4.3 配置权限

1. **"权限管理"** → **"批量导入权限"**
2. 导入以下JSON:

```json
{
  "scopes": {
    "tenant": [
      "contact:user.base:readonly",
      "im:chat",
      "im:chat:read",
      "im:chat:update",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": []
  }
}
```

### 步骤 5: 发布应用

1. **"版本管理与发布"** → **"创建新版本"**
2. 填写版本号和描述
3. 点击 **"保存"**
4. 点击 **"发布"**

### 步骤 6: 验证连接

```bash
# 检查通道状态
moltbot channels status
```

预期输出:
```
Gateway reachable.
- Feishu default: enabled, configured, running
```

### 步骤 7: 添加机器人到飞书

1. 打开飞书客户端
2. 搜索你的机器人名称(如 "Moltbot助手")
3. 开始聊天!

---

## 配置详解

### 完整配置示例

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_a9f1cc5722389bd7",
      "appSecret": "yE748No3yNQDIV0KP5O3TyplSEGclhag",
      "domain": "feishu",
      "connectionMode": "websocket",
      "webhookPath": "/feishu",
      "webhookPort": 3000,
      "dmPolicy": "pairing",
      "allowFrom": ["ou_xxx", "ou_yyy"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["oc_xxx"],
      "requireMention": true,
      "historyLimit": 50,
      "dmHistoryLimit": 20,
      "textChunkLimit": 2000,
      "chunkMode": "length",
      "mediaMaxMb": 100,
      "renderMode": "auto"
    }
  }
}
```

### 配置参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enabled` | boolean | ✅ | false | 是否启用飞书通道 |
| `appId` | string | ✅ | - | 飞书应用ID |
| `appSecret` | string | ✅ | - | 飞书应用密钥 |
| `domain` | string | ❌ | "feishu" | 域名: feishu/lark |
| `connectionMode` | string | ❌ | "websocket" | 连接模式: websocket/webhook |
| `webhookPath` | string | ❌ | "/feishu" | Webhook路径 |
| `webhookPort` | number | ❌ | 3000 | Webhook端口 |
| `dmPolicy` | string | ❌ | "pairing" | 私聊策略: open/pairing/allowlist |
| `allowFrom` | array | ❌ | [] | 允许的用户ID列表 |
| `groupPolicy` | string | ❌ | "allowlist" | 群聊策略: open/allowlist/disabled |
| `groupAllowFrom` | array | ❌ | [] | 允许的群ID列表 |
| `requireMention` | boolean | ❌ | true | 群聊是否需要@机器人 |
| `historyLimit` | number | ❌ | 50 | 群聊消息历史数量 |
| `dmHistoryLimit` | number | ❌ | 20 | 私聊消息历史数量 |
| `textChunkLimit` | number | ❌ | 2000 | 文本分块大小 |
| `chunkMode` | string | ❌ | "length" | 分块模式: length/newline |
| `mediaMaxMb` | number | ❌ | 100 | 媒体文件最大大小(MB) |
| `renderMode` | string | ❌ | "auto" | 渲染模式: auto/raw/card |

---

## 连接模式

### WebSocket模式 (推荐)

**优点:**
- ✅ 无需公网服务器
- ✅ 实时双向通信
- ✅ 开发环境友好
- ✅ 自动重连机制

**配置:**
```json
{
  "connectionMode": "websocket"
}
```

**适用场景:**
- 本地开发
- 内网部署
- 不想暴露服务器到公网

### Webhook模式

**优点:**
- ✅ 传统HTTP回调
- ✅ 易于集成现有系统

**缺点:**
- ❌ 需要公网服务器
- ❌ 需要配置HTTPS

**配置:**
```json
{
  "connectionMode": "webhook",
  "webhookPath": "/feishu",
  "webhookPort": 3000
}
```

**适用场景:**
- 有公网服务器
- 需要自定义webhook处理

---

## 权限管理

### DM策略 (私聊访问控制)

#### Open模式 - 任何人都可以私聊

```json
{
  "dmPolicy": "open"
}
```

**风险:** ⚠️ 任何人都可以与机器人对话

#### Pairing模式 - 需要配对 (推荐)

```json
{
  "dmPolicy": "pairing"
}
```

**流程:**
1. 用户发送 `/pair` 命令
2. 管理员在Moltbot中批准配对
3. 配对成功后可以对话

#### Allowlist模式 - 仅允许列表用户

```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["ou_xxx", "ou_yyy"]
}
```

**如何获取用户ID:**
- 在飞书中打开用户资料
- URL中的 `ou_xxxxx` 即为用户open_id

### 群组策略

#### Open模式 - 任何群都可以添加

```json
{
  "groupPolicy": "open",
  "requireMention": true
}
```

**注意:** 建议启用 `requireMention`,避免机器人在所有群聊中响应

#### Allowlist模式 - 仅允许指定群

```json
{
  "groupPolicy": "allowlist",
  "groupAllowFrom": ["oc_xxx"]
}
```

**如何获取群ID:**
- 在群聊设置中查看群信息
- URL中的 `oc_xxxxx` 即为群chat_id

#### Disabled模式 - 禁用群聊

```json
{
  "groupPolicy": "disabled"
}
```

---

## 事件订阅

### 支持的事件类型

| 事件类型 | 说明 | 处理函数 |
|----------|------|----------|
| `im.message.receive_v1` | 接收消息 | `handleFeishuMessage` |
| `im.message.message_read_v1` | 消息已读 | (忽略) |
| `im.chat.member.bot.added_v1` | 机器人被添加 | 记录日志 |
| `im.chat.member.bot.deleted_v1` | 机器人被移除 | 记录日志 |

### 事件处理流程

```typescript
// 1. WebSocket接收到事件
WSClient.on("im.message.receive_v1", (data) => {

  // 2. 验证事件
  if (!validateEvent(data)) return;

  // 3. 解析消息
  const message = parseMessage(data);

  // 4. 检查权限
  if (!checkPermission(message)) return;

  // 5. 处理消息
  await handleFeishuMessage(message);

  // 6. 更新历史
  updateChatHistory(message);
});
```

---

## 消息处理

### 消息类型

| 类型 | contentType | 示例 |
|------|-------------|------|
| 文本 | `text` | 纯文本消息 |
| 图片 | `image` | 图片消息 |
| 文件 | `file` | 文件消息 |
| 卡片 | `interactive` | 交互式卡片 |
| @消息 | `text` (含@) | @机器人的消息 |

### 消息发送

#### 发送文本消息

```bash
moltbot message send --channel feishu --target "user:ou_xxx" "Hello!"
```

或通过代码:

```typescript
import { sendMessageFeishu } from "@clawdbot/plugin-feishu";

await sendMessageFeishu({
  cfg,
  to: "ou_xxx",
  text: "Hello!",
});
```

#### 发送卡片消息

```typescript
import { sendCardFeishu } from "@clawdbot/plugin-feishu";

await sendCardFeishu({
  cfg,
  to: "ou_xxx",
  card: {
    header: {
      title: {
        content: "卡片标题",
        tag: "plain_text",
      },
    },
    elements: [
      {
        tag: "div",
        text: {
          content: "卡片内容",
          tag: "lark_md",
        },
      },
    ],
  },
});
```

### 目标格式

| 场景 | 格式 | 示例 |
|------|------|------|
| 私聊 | `user:open_id` | `user:ou_a1b2c3d4` |
| 群聊 | `chat:chat_id` | `chat:oc_a1b2c3d4` |
| 当前会话 | (省略) | 自动推断 |

---

## 故障排查

### 常见问题

#### 1. 机器人无响应

**检查清单:**
```bash
# 1. 确认网关运行
moltbot gateway status

# 2. 确认通道状态
moltbot channels status

# 3. 查看日志
tail -f /tmp/moltbot/moltbot-*.log | grep -i feishu

# 4. 检查配置
moltbot config get channels.feishu
```

**可能原因:**
- ❌ App ID或Secret错误
- ❌ 长连接未启用
- ❌ 权限未配置
- ❌ 应用未发布

#### 2. WebSocket连接失败

**日志:**
```
feishu: WebSocket connection failed
```

**解决:**
1. 确认在飞书后台启用了长连接
2. 检查网络连接
3. 重启网关: `moltbot gateway restart`

#### 3. 权限被拒绝

**日志:**
```
feishu: access denied for user ou_xxx
```

**解决:**
1. 检查 `dmPolicy` 配置
2. 如需配对,执行 `/pair` 命令
3. 检查 `allowFrom` 列表

#### 4. 群聊中@机器人无响应

**检查:**
```json
{
  "groupPolicy": "open",
  "requireMention": true
}
```

**确认:**
- ✅ `requireMention` 为 `true`
- ✅ 消息中确实@了机器人
- ✅ 群ID在 `groupAllowFrom` 中(如使用allowlist)

### 日志分析

#### 查看实时日志

```bash
# 查看所有日志
tail -f /tmp/moltbot/moltbot-*.log

# 只看飞书相关
tail -f /tmp/moltbot/moltbot-*.log | grep -i feishu

# 只看错误
tail -f /tmp/moltbot/moltbot-*.log | grep -i "feishu.*error"
```

#### 日志级别

```bash
# 设置详细日志
moltbot config set logLevel debug

# 重启网关
moltbot gateway restart
```

---

## 最佳实践

### 1. 安全建议

#### ✅ 使用配对模式

```json
{
  "dmPolicy": "pairing",
  "groupPolicy": "allowlist"
}
```

#### ✅ 限制历史记录

```json
{
  "historyLimit": 50,
  "dmHistoryLimit": 20
}
```

#### ✅ 启用群聊@要求

```json
{
  "groupPolicy": "open",
  "requireMention": true
}
```

### 2. 性能优化

#### 文本分块

```json
{
  "textChunkLimit": 2000,
  "chunkMode": "length"
}
```

**建议:**
- 飞书消息限制: 2000字符
- 大于限制自动分块发送
- `chunkMode: "newline"` 按段落分块

#### 媒体文件限制

```json
{
  "mediaMaxMb": 100
}
```

**说明:**
- 限制上传文件大小
- 超过限制会被拒绝
- 飞书限制: 100MB

### 3. 用户体验

#### 使用卡片消息

```typescript
// 富文本卡片比纯文本更好
await sendCardFeishu({
  card: {
    // 交互式卡片
  },
});
```

#### 适当的历史记录

```json
{
  "historyLimit": 50  // 足够的上下文
}
```

**建议:**
- 太少: 上下文不足
- 太多: Token浪费

---

## API参考

### 核心函数

#### sendMessageFeishu

发送文本消息

```typescript
interface SendMessageFeishuOpts {
  cfg: ClawdbotConfig;
  to: string;  // user:open_id 或 chat:chat_id
  text: string;
  replyTo?: string;  // 可选: 回复的消息ID
}

await sendMessageFeishu({
  cfg,
  to: "user:ou_xxx",
  text: "Hello!",
});
```

#### sendCardFeishu

发送卡片消息

```typescript
interface SendCardFeishuOpts {
  cfg: ClawdbotConfig;
  to: string;
  card: FeishuCard;
}

await sendCardFeishu({
  cfg,
  to: "user:ou_xxx",
  card: {
    header: { title: { content: "Title" } },
    elements: [
      { tag: "div", text: { content: "Content" } }
    ],
  },
});
```

#### updateCardFeishu

更新卡片消息

```typescript
interface UpdateCardFeishuOpts {
  cfg: ClawdbotConfig;
  to: string;
  messageId: string;
  card: FeishuCard;
}

await updateCardFeishu({
  cfg,
  to: "user:ou_xxx",
  messageId: "om_xxx",
  card: newCard,
});
```

### 类型定义

```typescript
// 飞书配置
type FeishuConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  domain?: "feishu" | "lark";
  connectionMode?: "websocket" | "webhook";
  dmPolicy?: "open" | "pairing" | "allowlist";
  groupPolicy?: "open" | "allowlist" | "disabled";
  requireMention?: boolean;
  historyLimit?: number;
  dmHistoryLimit?: number;
  // ... 更多配置
};

// 消息上下文
type FeishuMessageContext = {
  chatId: string;
  messageId: string;
  senderId: string;
  senderOpenId: string;
  senderName?: string;
  chatType: "p2p" | "group";
  mentionedBot: boolean;
  rootId?: string;
  parentId?: string;
  content: string;
  contentType: string;
};
```

---

## 附录

### A. 飞书 vs Lark

| 特性 | 飞书 (Feishu) | Lark |
|------|---------------|------|
| **域名** | `.feishu.cn` | `.larksuite.com` |
| **API** | `open.feishu.cn` | `open.larksuite.com` |
| **使用地区** | 中国大陆 | 海外 |
| **配置** | `domain: "feishu"` | `domain: "lark"` |

### B. Open ID vs User ID

| ID类型 | 格式 | 说明 | 获取方式 |
|--------|------|------|----------|
| `open_id` | `ou_xxx` | 应用内唯一 | 用户资料页URL |
| `user_id` | `on_xxx` | 企业内唯一 | API查询 |
| `union_id` | - | 跨应用唯一 | 需要特殊权限 |
| `chat_id` | `oc_xxx` | 群聊唯一 | 群设置URL |

**推荐使用 `open_id`**

### C. 相关链接

#### 官方文档
- [飞书开放平台](https://open.feishu.cn/)
- [事件订阅指南](https://open.feishu.cn/document/server-docs/event-subscription-guide/overview)
- [消息发送API](https://open.feishu.cn/document/server-docs/im/message/send-messages)
- [WebSocket长连接](https://open.feishu.cn/document/common-capabilities/event-subscription/subscribe-to-events/push-methods/persistent-connection)
- [权限管理](https://open.feishu.cn/document/ukTMukTMukTM/uAjLw4CM/ukTMukTMukTM/introduction)

#### Moltbot文档
- [通道配置](https://docs.molt.bot/channels)
- [故障排查](https://docs.molt.bot/troubleshooting)
- [API参考](https://docs.molt.bot/api)

#### 社区资源
- [Moltbot GitHub](https://github.com/moltbot/moltbot)
- [飞书开发者社区](https://open.feishu.cn/community)

---

**最后更新:** 2026-01-29
**文档版本:** 1.0.0
**插件版本:** 基于 @clawdbot/plugin-feishu
