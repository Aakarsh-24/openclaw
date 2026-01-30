/**
 * Feishu 连接测试脚本
 * 运行: npx tsx src/feishu/test-connection.ts
 */

import * as lark from "@larksuiteoapi/node-sdk";

const APP_ID = "cli_a9f608f133781bcc";
const APP_SECRET = "Dta7m0KJVrsXXFKW51OOTd6px1elOk7f";

async function testConnection() {
  console.log("🔍 测试飞书 API 连接...\n");

  // 创建客户端
  const client = new lark.Client({
    appId: APP_ID,
    appSecret: APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  try {
    // 1. 验证凭证 - 获取 tenant access token
    console.log("1️⃣ 验证应用凭证...");
    const tokenResponse = await client.auth.tenantAccessToken.internal({
      data: {
        app_id: APP_ID,
        app_secret: APP_SECRET,
      },
    });

    if (tokenResponse.code !== 0) {
      console.error(`❌ 凭证验证失败: ${tokenResponse.code} - ${tokenResponse.msg}`);
      return;
    }

    console.log(`✅ 凭证验证成功！Token 有效期: ${tokenResponse.expire} 秒\n`);

    // 2. 获取机器人信息
    console.log("2️⃣ 获取机器人信息...");
    try {
      const botInfo = await client.im.chat.list({
        params: {
          page_size: 1,
        },
      });

      if (botInfo.code === 0) {
        console.log(`✅ 机器人 API 访问正常\n`);
      } else {
        console.log(`⚠️ 获取聊天列表: ${botInfo.code} - ${botInfo.msg}`);
        console.log("   这可能是因为机器人还没有加入任何群聊\n");
      }
    } catch (err) {
      console.log(`⚠️ 获取机器人信息失败（可能需要额外权限）\n`);
    }

    // 3. 测试长连接模式
    console.log("3️⃣ 测试长连接模式...");
    console.log("   (这将监听来自飞书的消息，按 Ctrl+C 退出)\n");

    const eventDispatcher = new lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data) => {
        console.log("\n📨 收到消息:");
        console.log(`   消息 ID: ${data.message.message_id}`);
        console.log(`   聊天类型: ${data.message.chat_type}`);
        console.log(`   消息类型: ${data.message.message_type}`);

        try {
          const content = JSON.parse(data.message.content);
          if (content.text) {
            console.log(`   内容: ${content.text}`);
          }
        } catch {
          console.log(`   原始内容: ${data.message.content}`);
        }

        // 自动回复
        try {
          console.log("\n   🤖 发送自动回复...");
          const replyResponse = await client.im.message.create({
            params: {
              receive_id_type: "chat_id",
            },
            data: {
              receive_id: data.message.chat_id,
              msg_type: "text",
              content: JSON.stringify({
                text: `收到你的消息！这是来自 OpenClaw Feishu 集成的自动回复 🎉`,
              }),
            },
          });

          if (replyResponse.code === 0) {
            console.log(`   ✅ 回复成功！消息 ID: ${replyResponse.data?.message_id}`);
          } else {
            console.log(`   ❌ 回复失败: ${replyResponse.code} - ${replyResponse.msg}`);
          }
        } catch (err) {
          console.log(`   ❌ 回复失败: ${err}`);
        }
      },
    });

    const wsClient = new lark.WSClient({
      appId: APP_ID,
      appSecret: APP_SECRET,
      eventDispatcher,
      loggerLevel: lark.LoggerLevel.info,
    });

    console.log("   正在启动长连接...");
    await wsClient.start();
    console.log("   ✅ 长连接已建立！现在可以在飞书中给机器人发消息了。\n");
    console.log("   💡 提示: 在飞书中搜索你的应用名称，然后发送消息测试\n");

    // 保持运行
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

testConnection();
