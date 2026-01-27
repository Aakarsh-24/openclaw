#!/usr/bin/env node
import { createUser } from "@xmtp/agent-sdk/user";
import { randomBytes } from "crypto";

// Generate a random private key
const privateKey = `0x${randomBytes(32).toString("hex")}` as const;

// Create user to verify it works
const user = createUser(privateKey);

console.log("=== XMTP Bot Wallet Generated ===");
console.log("");
console.log("Private Key (keep this secret!):");
console.log(privateKey);
console.log("");
console.log("Ethereum Address:");
console.log(user.account.address);
console.log("");
console.log("Add to your environment or clawdbot.json:");
console.log(`XMTP_WALLET_KEY=${privateKey}`);
console.log("");
console.log("⚠️  IMPORTANT: Keep the private key secure!");
console.log("   This key controls the bot's XMTP identity.");
