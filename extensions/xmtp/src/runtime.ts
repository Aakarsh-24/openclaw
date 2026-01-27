import type { ClawdbotRuntime } from "clawdbot/plugin-sdk";

let runtime: ClawdbotRuntime | null = null;

export function setXmtpRuntime(rt: ClawdbotRuntime): void {
  runtime = rt;
}

export function getXmtpRuntime(): ClawdbotRuntime {
  if (!runtime) {
    throw new Error("XMTP runtime not initialized");
  }
  return runtime;
}
