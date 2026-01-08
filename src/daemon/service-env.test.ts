import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMinimalServicePath,
  buildServiceEnvironment,
} from "./service-env.js";

describe("buildMinimalServicePath", () => {
  it("includes bun directory from BUN_INSTALL", () => {
    const result = buildMinimalServicePath({
      env: { BUN_INSTALL: "/custom/bun", HOME: "/home/user" },
    });
    expect(result).toContain("/custom/bun/bin");
  });

  it("falls back to ~/.bun/bin when BUN_INSTALL not set", () => {
    const result = buildMinimalServicePath({
      env: { HOME: "/home/user" },
    });
    expect(result).toContain("/home/user/.bun/bin");
  });

  it("includes system directories", () => {
    const result = buildMinimalServicePath({
      env: { HOME: "/home/user" },
    });
    expect(result).toContain("/usr/local/bin");
    expect(result).toContain("/usr/bin");
    expect(result).toContain("/bin");
  });

  it("does not include nvm, pnpm, or npm directories", () => {
    const result = buildMinimalServicePath({
      env: {
        HOME: "/home/user",
        PATH: "/home/user/.nvm/versions/node/v22.0.0/bin:/home/user/.local/share/pnpm:/usr/bin",
      },
    });
    expect(result).not.toContain(".nvm");
    expect(result).not.toContain("pnpm");
  });

  it("includes extra directories when provided", () => {
    const result = buildMinimalServicePath({
      env: { HOME: "/home/user" },
      extraDirs: ["/custom/tools"],
    });
    expect(result).toContain("/custom/tools");
  });

  it("deduplicates directories", () => {
    const result = buildMinimalServicePath({
      env: { HOME: "/home/user" },
      extraDirs: ["/usr/bin", "/home/user/.bun/bin"],
    });
    const parts = result.split(path.delimiter);
    const unique = [...new Set(parts)];
    expect(parts.length).toBe(unique.length);
  });

  it("orders directories: bun → extra → system", () => {
    const result = buildMinimalServicePath({
      env: { HOME: "/home/user" },
      extraDirs: ["/custom/tools"],
    });
    const parts = result.split(path.delimiter);
    const bunIndex = parts.findIndex((p) => p.includes(".bun"));
    const customIndex = parts.findIndex((p) => p.includes("/custom/tools"));
    const systemIndex = parts.indexOf("/usr/bin");
    expect(bunIndex).toBeLessThan(customIndex);
    expect(customIndex).toBeLessThan(systemIndex);
  });
});

describe("buildServiceEnvironment", () => {
  it("uses minimal PATH", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user", PATH: "/full/complex/path" },
      port: 18789,
    });
    expect(env.PATH).toContain(".bun");
    expect(env.PATH).not.toContain("/full/complex/path");
  });

  it("includes CLAWDBOT_GATEWAY_PORT", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user" },
      port: 18789,
    });
    expect(env.CLAWDBOT_GATEWAY_PORT).toBe("18789");
  });

  it("includes token when provided", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user" },
      port: 18789,
      token: "secret",
    });
    expect(env.CLAWDBOT_GATEWAY_TOKEN).toBe("secret");
  });

  it("includes launchd label when provided", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user" },
      port: 18789,
      launchdLabel: "com.clawdbot.gateway",
    });
    expect(env.CLAWDBOT_LAUNCHD_LABEL).toBe("com.clawdbot.gateway");
  });

  it("passes through CLAWDBOT_* env vars", () => {
    const env = buildServiceEnvironment({
      env: {
        HOME: "/home/user",
        CLAWDBOT_PROFILE: "work",
        CLAWDBOT_STATE_DIR: "/custom/state",
        CLAWDBOT_CONFIG_PATH: "/custom/config.json",
      },
      port: 18789,
    });
    expect(env.CLAWDBOT_PROFILE).toBe("work");
    expect(env.CLAWDBOT_STATE_DIR).toBe("/custom/state");
    expect(env.CLAWDBOT_CONFIG_PATH).toBe("/custom/config.json");
  });
});
