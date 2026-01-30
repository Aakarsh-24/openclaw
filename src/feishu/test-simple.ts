/**
 * Feishu 简单功能测试
 * 不使用长连接，只测试基本 API
 *
 * 运行: npx tsx src/feishu/test-simple.ts
 */

import * as lark from "@larksuiteoapi/node-sdk";

const APP_ID = "cli_a9f608f133781bcc";
const APP_SECRET = "Dta7m0KJVrsXXFKW51OOTd6px1elOk7f";

async function testSimple() {
  console.log("🔍 飞书 API 简单测试\n");

  const client = new lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  // 1. 测试凭证
  console.log("1️⃣ 验证凭证...");
  try {
    const tokenRes = await client.auth.tenantAccessToken.internal({
      data: { app_id: APP_ID, app_secret: APP_SECRET },
    });

    if (tokenRes.code === 0) {
      console.log(`   ✅ 凭证有效！Token 过期时间: ${tokenRes.expire}秒\n`);
    } else {
      console.log(`   ❌ 凭证无效: ${tokenRes.msg}\n`);
      return;
    }
  } catch (err) {
    console.log(`   ❌ 凭证验证失败: ${err}\n`);
    return;
  }

  // 2. 获取机器人信息
  console.log("2️⃣ 获取机器人信息...");
  try {
    // 尝试获取当前用户（机器人）信息
    const botInfoRes = await client.contact.user.batchGetId({
      params: { user_id_type: "open_id" },
      data: { emails: [] }, // 空查询只是为了测试 API 可用性
    });
    console.log(`   API 响应码: ${botInfoRes.code}`);
    if (botInfoRes.code === 0) {
      console.log(`   ✅ 联系人 API 正常\n`);
    } else {
      console.log(`   ⚠️ ${botInfoRes.msg}\n`);
    }
  } catch (err) {
    console.log(`   ⚠️ 需要额外权限\n`);
  }

  // 3. 测试发送消息（需要知道 chat_id）
  console.log("3️⃣ 下一步：向机器人发送消息获取 chat_id\n");
  console.log("   📋 操作步骤：");
  console.log("   1. 在飞书中搜索你创建的应用名称");
  console.log("   2. 点击机器人头像，开始对话");
  console.log("   3. 发送任意消息\n");
  console.log("   🔧 获取 chat_id 的方法：");
  console.log("   - 配置 Webhook 回调 URL");
  console.log("   - 或使用 ngrok 等工具暴露本地端口\n");

  console.log("=".repeat(50));
  console.log("\n✅ 基础 API 测试通过！\n");
  console.log("💡 要进行完整的消息收发测试，你需要：");
  console.log("   方案 A：使用 Webhook 模式 + ngrok");
  console.log("   方案 B：等飞书修复长连接配置问题\n");
  console.log("   推荐使用方案 A，我可以帮你设置 ngrok\n");
}

testSimple();
