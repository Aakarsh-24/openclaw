import { Agent } from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";

async function main() {
  const walletKey = "0xef0760e5f534adb201b9c2d4140b130d5fbc870d2b3513df5442c999d3e58b54";
  const user = createUser(walletKey);
  const signer = createSigner(user);

  console.log("Creating XMTP agent and registering on network...");
  const agent = await Agent.create(signer, {
    env: "dev",
    dbPath: null, // in-memory for testing
  });

  console.log("✅ Agent created! Address:", agent.address);
  console.log("✅ Wallet is now registered on XMTP dev network");
  console.log("");
  console.log("The bot is now ready to receive messages!");

  await agent.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
