---
title: "项目展示"
description: "来自OpenClaw 社区项目"
summary: "由社区构建、基于 OpenClaw 的项目与集成案例"
---

# 项目展示

社区实战项目：来这里寻找灵感，看看开发者们如何使用 OpenClaw 打造精彩应用。

<Info>
**想被收录展示？** 请在 [Discord 的 #showcase 频道](https://discord.gg/clawd) 分享你的项目，或在 X（原 Twitter）上 [@openclaw](https://x.com/openclaw) 提醒我们。
</Info>

## 🎥 OpenClaw 实战演示

由 VelvetShark 提供的完整搭建流程讲解（28 分钟）。

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/SaWSPZoPX34"
    title="OpenClaw：一个本该由 Siri 实现的自托管 AI（完整搭建流程）"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[在 YouTube 上观看](https://www.youtube.com/watch?v=SaWSPZoPX34)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/mMSKQvlmFuQ"
    title="OpenClaw 项目展示视频"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[在 YouTube 上观看](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/5kkIJNUGFho"
    title="OpenClaw 社区项目展示"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[在 YouTube 上观看](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 来自 Discord 的最新案例

<CardGroup cols={2}>

<Card title="PR 审查 → Telegram 反馈" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode 完成变更 → 创建 PR → OpenClaw 审查 diff，并在 Telegram 中回复“轻微建议（minor suggestions）”以及清晰的合并结论（包含需优先修复的关键问题）。

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="通过 Telegram 发送的 OpenClaw PR 审查反馈" />
</Card>

<Card title="分钟级构建酿酒技能" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

向 “Robby”（@openclaw）请求一个本地酿酒技能。它会要求提供示例 CSV 导出文件及存储位置，然后快速构建并测试技能（示例中包含 962 瓶酒）。

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="OpenClaw 基于 CSV 构建本地酒窖技能" />
</Card>

<Card title="Tesco 购物自动驾驶" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

每周餐单 → 常购清单 → 预约配送时段 → 确认订单。无需 API，仅通过浏览器自动化完成。

  <img src="/assets/showcase/tesco-shop.jpg" alt="通过聊天控制 Tesco 购物自动化" />
</Card>

<Card title="SNAG：截图转 Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

快捷键选取屏幕区域 → Gemini 视觉识别 → 即时将 Markdown 写入剪贴板。

  <img src="/assets/showcase/snag.png" alt="SNAG 截图转 Markdown 工具" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

用于在 Agents、Claude、Codex 与 OpenClaw 之间统一管理技能/命令的桌面应用。

  <img src="/assets/showcase/agents-ui.jpg" alt="Agents UI 应用" />
</Card>

<Card title="Telegram 语音便笺（papla.media）" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

封装 papla.media TTS，并以 Telegram 语音消息形式发送结果（避免烦人的自动播放）。

  <img src="/assets/showcase/papla-tts.jpg" alt="TTS 生成的 Telegram 语音便笺" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

通过 Homebrew 安装的辅助工具，用于列出 / 查看 / 监听本地 OpenAI Codex 会话（CLI + VS Code）。

  <img src="/assets/showcase/codexmonitor.png" alt="ClawHub 上的 CodexMonitor" />
</Card>

<Card title="Bambu 3D 打印机控制" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

控制并排查 BambuLab 打印机问题：状态、任务、摄像头、AMS、校准等。

  <img src="/assets/showcase/bambu-cli.png" alt="ClawHub 上的 Bambu CLI 技能" />
</Card>

<Card title="维也纳交通（Wiener Linien）" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

提供维也纳公共交通的实时到站、故障信息、电梯状态与路线规划。

  <img src="/assets/showcase/wienerlinien.png" alt="ClawHub 上的 Wiener Linien 技能" />
</Card>

</CardGroup>

## 提交你的项目

有项目想分享？欢迎提交！

<Steps>
  <Step title="分享项目">
    在 [Discord 的 #showcase 频道](https://discord.gg/clawd) 发布，或在 X 上 [@openclaw](https://x.com/openclaw)
  </Step>
  <Step title="说明细节">
    说明项目功能，附上仓库或演示链接，如有截图更佳
  </Step>
  <Step title="收录展示">
    我们会将优秀项目加入本页面
  </Step>
</Steps>
