import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { applyAuthChoice, resolvePreferredProviderForAuthChoice } from "./auth-choice.js";
import type { AuthChoice } from "./onboard-types.js";

vi.mock("../providers/github-copilot-auth.js", () => ({
  githubCopilotLoginCommand: vi.fn(async () => {}),
}));

const resolvePluginProviders = vi.hoisted(() => vi.fn(() => []));
vi.mock("../plugins/providers.js", () => ({
  resolvePluginProviders,
}));

const noopAsync = async () => {};
const noop = () => {};
const authProfilePathFor = (agentDir: string) => path.join(agentDir, "auth-profiles.json");
const requireAgentDir = () => {
  const agentDir = process.env.CLAWDBOT_AGENT_DIR;
  if (!agentDir) throw new Error("CLAWDBOT_AGENT_DIR not set");
  return agentDir;
};

describe("applyAuthChoice", () => {
  const previousStateDir = process.env.CLAWDBOT_STATE_DIR;
  const previousAgentDir = process.env.CLAWDBOT_AGENT_DIR;
  const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousOpenrouterKey = process.env.OPENROUTER_API_KEY;
  const previousAiGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const previousOllamaKey = process.env.OLLAMA_API_KEY;
  const previousSshTty = process.env.SSH_TTY;
  const previousChutesClientId = process.env.CHUTES_CLIENT_ID;
  let tempStateDir: string | null = null;

  afterEach(async () => {
    vi.unstubAllGlobals();
    resolvePluginProviders.mockReset();
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
      tempStateDir = null;
    }
    if (previousStateDir === undefined) {
      delete process.env.CLAWDBOT_STATE_DIR;
    } else {
      process.env.CLAWDBOT_STATE_DIR = previousStateDir;
    }
    if (previousAgentDir === undefined) {
      delete process.env.CLAWDBOT_AGENT_DIR;
    } else {
      process.env.CLAWDBOT_AGENT_DIR = previousAgentDir;
    }
    if (previousPiAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
    }
    if (previousOpenrouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previousOpenrouterKey;
    }
    if (previousAiGatewayKey === undefined) {
      delete process.env.AI_GATEWAY_API_KEY;
    } else {
      process.env.AI_GATEWAY_API_KEY = previousAiGatewayKey;
    }
    if (previousOllamaKey === undefined) {
      delete process.env.OLLAMA_API_KEY;
    } else {
      process.env.OLLAMA_API_KEY = previousOllamaKey;
    }
    if (previousSshTty === undefined) {
      delete process.env.SSH_TTY;
    } else {
      process.env.SSH_TTY = previousSshTty;
    }
    if (previousChutesClientId === undefined) {
      delete process.env.CHUTES_CLIENT_ID;
    } else {
      process.env.CHUTES_CLIENT_ID = previousChutesClientId;
    }
  });

  it("prompts and writes MiniMax API key when selecting minimax-api", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const text = vi.fn().mockResolvedValue("sk-minimax-test");
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "minimax-api",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Enter MiniMax API key" }),
    );
    expect(result.config.auth?.profiles?.["minimax:default"]).toMatchObject({
      provider: "minimax",
      mode: "api_key",
    });

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["minimax:default"]?.key).toBe("sk-minimax-test");
  });

  it("prompts and writes Synthetic API key when selecting synthetic-api-key", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const text = vi.fn().mockResolvedValue("sk-synthetic-test");
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "synthetic-api-key",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Enter Synthetic API key" }),
    );
    expect(result.config.auth?.profiles?.["synthetic:default"]).toMatchObject({
      provider: "synthetic",
      mode: "api_key",
    });

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["synthetic:default"]?.key).toBe("sk-synthetic-test");
  });

  it("sets default model when selecting github-copilot", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const previousTty = process.stdin.isTTY;
    const stdin = process.stdin as unknown as { isTTY?: boolean };
    stdin.isTTY = true;

    try {
      const result = await applyAuthChoice({
        authChoice: "github-copilot",
        config: {},
        prompter,
        runtime,
        setDefaultModel: true,
      });

      expect(result.config.agents?.defaults?.model?.primary).toBe("github-copilot/gpt-4o");
    } finally {
      stdin.isTTY = previousTty;
    }
  });

  it("does not override the default model when selecting opencode-zen without setDefaultModel", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const text = vi.fn().mockResolvedValue("sk-opencode-zen-test");
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "opencode-zen",
      config: {
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-opus-4-5" },
          },
        },
      },
      prompter,
      runtime,
      setDefaultModel: false,
    });

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Enter OpenCode Zen API key" }),
    );
    expect(result.config.agents?.defaults?.model?.primary).toBe("anthropic/claude-opus-4-5");
    expect(result.config.models?.providers?.["opencode-zen"]).toBeUndefined();
    expect(result.agentModelOverride).toBe("opencode/claude-opus-4-5");
  });

  it("uses existing OPENROUTER_API_KEY when selecting openrouter-api-key", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;
    process.env.OPENROUTER_API_KEY = "sk-openrouter-test";

    const text = vi.fn();
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const confirm = vi.fn(async () => true);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "openrouter-api-key",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("OPENROUTER_API_KEY"),
      }),
    );
    expect(text).not.toHaveBeenCalled();
    expect(result.config.auth?.profiles?.["openrouter:default"]).toMatchObject({
      provider: "openrouter",
      mode: "api_key",
    });
    expect(result.config.agents?.defaults?.model?.primary).toBe("openrouter/auto");

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["openrouter:default"]?.key).toBe("sk-openrouter-test");

    delete process.env.OPENROUTER_API_KEY;
  });

  it("uses existing AI_GATEWAY_API_KEY when selecting ai-gateway-api-key", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;
    process.env.AI_GATEWAY_API_KEY = "gateway-test-key";

    const text = vi.fn();
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const confirm = vi.fn(async () => true);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ai-gateway-api-key",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("AI_GATEWAY_API_KEY"),
      }),
    );
    expect(text).not.toHaveBeenCalled();
    expect(result.config.auth?.profiles?.["vercel-ai-gateway:default"]).toMatchObject({
      provider: "vercel-ai-gateway",
      mode: "api_key",
    });
    expect(result.config.agents?.defaults?.model?.primary).toBe(
      "vercel-ai-gateway/anthropic/claude-opus-4.5",
    );

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["vercel-ai-gateway:default"]?.key).toBe("gateway-test-key");

    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("writes Chutes OAuth credentials when selecting chutes (remote/manual)", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;
    process.env.SSH_TTY = "1";
    process.env.CHUTES_CLIENT_ID = "cid_test";

    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://api.chutes.ai/idp/token") {
        return new Response(
          JSON.stringify({
            access_token: "at_test",
            refresh_token: "rt_test",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "https://api.chutes.ai/idp/userinfo") {
        return new Response(JSON.stringify({ username: "remote-user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const text = vi.fn().mockResolvedValue("code_manual");
    const select: WizardPrompter["select"] = vi.fn(
      async (params) => params.options[0]?.value as never,
    );
    const multiselect: WizardPrompter["multiselect"] = vi.fn(async () => []);
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select,
      multiselect,
      text,
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "chutes",
      config: {},
      prompter,
      runtime,
      setDefaultModel: false,
    });

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Paste the redirect URL (or authorization code)",
      }),
    );
    expect(result.config.auth?.profiles?.["chutes:remote-user"]).toMatchObject({
      provider: "chutes",
      mode: "oauth",
    });

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<
        string,
        { provider?: string; access?: string; refresh?: string; email?: string }
      >;
    };
    expect(parsed.profiles?.["chutes:remote-user"]).toMatchObject({
      provider: "chutes",
      access: "at_test",
      refresh: "rt_test",
      email: "remote-user",
    });
  });

  it("configures Ollama when selecting ollama and Ollama is reachable", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(
          JSON.stringify({
            models: [
              { name: "llama3.3:latest", modified_at: "2024-01-01", size: 1000, digest: "abc" },
              { name: "qwen2.5:latest", modified_at: "2024-01-01", size: 2000, digest: "def" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("custom Ollama endpoint"),
      }),
    );
    expect(result.config.auth?.profiles?.["ollama:default"]).toMatchObject({
      provider: "ollama",
      mode: "api_key",
    });
    // Should use first discovered model as default
    expect(result.config.agents?.defaults?.model?.primary).toBe("ollama/llama3.3:latest");

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["ollama:default"]?.key).toBe("ollama");
  });

  it("uses existing OLLAMA_API_KEY when selecting ollama", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;
    process.env.OLLAMA_API_KEY = "my-ollama-key";

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(
          JSON.stringify({
            models: [{ name: "llama3.3", modified_at: "2024-01-01", size: 1000, digest: "abc" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const confirm = vi
      .fn()
      .mockResolvedValueOnce(false) // Don't use custom endpoint
      .mockResolvedValueOnce(true); // Use existing OLLAMA_API_KEY
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("OLLAMA_API_KEY"),
      }),
    );
    expect(result.config.auth?.profiles?.["ollama:default"]).toMatchObject({
      provider: "ollama",
      mode: "api_key",
    });

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    expect(parsed.profiles?.["ollama:default"]?.key).toBe("my-ollama-key");

    delete process.env.OLLAMA_API_KEY;
  });

  it("shows error when Ollama is not reachable", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async () => {
      throw new Error("Connection refused");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const note = vi.fn(noopAsync);
    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note,
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(note).toHaveBeenCalledWith(
      expect.stringContaining("Ollama is not reachable"),
      "Ollama not detected",
    );
    // Should not set auth profile when Ollama is not reachable
    expect(result.config.auth?.profiles?.["ollama:default"]).toBeUndefined();
  });

  it("uses custom Ollama endpoint when specified", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const customEndpoint = "http://192.168.1.100:11434";
    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${customEndpoint}/api/tags`) {
        return new Response(
          JSON.stringify({
            models: [
              { name: "mistral:latest", modified_at: "2024-01-01", size: 1000, digest: "abc" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const text = vi.fn(async () => customEndpoint);
    const confirm = vi.fn(async () => true); // Use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text,
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Enter Ollama endpoint URL" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(`${customEndpoint}/api/tags`, expect.anything());
    expect(result.config.agents?.defaults?.model?.primary).toBe("ollama/mistral:latest");
    // Custom endpoint should be in provider config
    expect(result.config.models?.providers?.ollama).toMatchObject({
      baseUrl: `${customEndpoint}/v1`,
      api: "openai-completions",
    });
  });

  it("uses fallback model when Ollama returns empty models list", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const note = vi.fn(noopAsync);
    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note,
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(note).toHaveBeenCalledWith(expect.stringContaining("No models found"), "Ollama");
    // Should use the fallback model
    expect(result.config.agents?.defaults?.model?.primary).toBe("ollama/llama3.3");
  });

  it("uses placeholder when user declines existing OLLAMA_API_KEY", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;
    process.env.OLLAMA_API_KEY = "my-secret-ollama-key";

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(
          JSON.stringify({
            models: [{ name: "llama3.3", modified_at: "2024-01-01", size: 1000, digest: "abc" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const confirm = vi
      .fn()
      .mockResolvedValueOnce(false) // Don't use custom endpoint
      .mockResolvedValueOnce(false); // Decline existing OLLAMA_API_KEY
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    // Should have asked about existing key
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("OLLAMA_API_KEY"),
      }),
    );

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { key?: string }>;
    };
    // Should use placeholder "ollama" instead of the env key
    expect(parsed.profiles?.["ollama:default"]?.key).toBe("ollama");

    delete process.env.OLLAMA_API_KEY;
  });

  it("treats non-200 Ollama response as unreachable", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const note = vi.fn(noopAsync);
    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note,
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(note).toHaveBeenCalledWith(
      expect.stringContaining("Ollama is not reachable"),
      "Ollama not detected",
    );
    expect(result.config.auth?.profiles?.["ollama:default"]).toBeUndefined();
  });

  it("returns agentModelOverride when setDefaultModel is false", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        return new Response(
          JSON.stringify({
            models: [
              { name: "codellama:latest", modified_at: "2024-01-01", size: 1000, digest: "abc" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-opus-4-5" },
          },
        },
      },
      prompter,
      runtime,
      setDefaultModel: false,
    });

    // Should not change the existing default model
    expect(result.config.agents?.defaults?.model?.primary).toBe("anthropic/claude-opus-4-5");
    // Should return the override for the agent
    expect(result.agentModelOverride).toBe("ollama/codellama:latest");
  });

  it("handles malformed Ollama response gracefully", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://127.0.0.1:11434/api/tags") {
        // Return unexpected structure - models is not an array
        return new Response(JSON.stringify({ unexpected: "format", models: "not-an-array" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const note = vi.fn(noopAsync);
    const confirm = vi.fn(async () => false); // Don't use custom endpoint
    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note,
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm,
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "ollama",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    // Should treat malformed response as reachable but with no models
    expect(note).toHaveBeenCalledWith(expect.stringContaining("No models found"), "Ollama");
    // Should still configure auth profile
    expect(result.config.auth?.profiles?.["ollama:default"]).toMatchObject({
      provider: "ollama",
      mode: "api_key",
    });
    // Should use fallback model
    expect(result.config.agents?.defaults?.model?.primary).toBe("ollama/llama3.3");
  });

  it("writes Qwen credentials when selecting qwen-portal", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-auth-"));
    process.env.CLAWDBOT_STATE_DIR = tempStateDir;
    process.env.CLAWDBOT_AGENT_DIR = path.join(tempStateDir, "agent");
    process.env.PI_CODING_AGENT_DIR = process.env.CLAWDBOT_AGENT_DIR;

    resolvePluginProviders.mockReturnValue([
      {
        id: "qwen-portal",
        label: "Qwen",
        auth: [
          {
            id: "device",
            label: "Qwen OAuth",
            kind: "device_code",
            run: vi.fn(async () => ({
              profiles: [
                {
                  profileId: "qwen-portal:default",
                  credential: {
                    type: "oauth",
                    provider: "qwen-portal",
                    access: "access",
                    refresh: "refresh",
                    expires: Date.now() + 60 * 60 * 1000,
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    "qwen-portal": {
                      baseUrl: "https://portal.qwen.ai/v1",
                      apiKey: "qwen-oauth",
                      api: "openai-completions",
                      models: [],
                    },
                  },
                },
              },
              defaultModel: "qwen-portal/coder-model",
            })),
          },
        ],
      },
    ]);

    const prompter: WizardPrompter = {
      intro: vi.fn(noopAsync),
      outro: vi.fn(noopAsync),
      note: vi.fn(noopAsync),
      select: vi.fn(async () => "" as never),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => ""),
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: noop, stop: noop })),
    };
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number) => {
        throw new Error(`exit:${code}`);
      }),
    };

    const result = await applyAuthChoice({
      authChoice: "qwen-portal",
      config: {},
      prompter,
      runtime,
      setDefaultModel: true,
    });

    expect(result.config.auth?.profiles?.["qwen-portal:default"]).toMatchObject({
      provider: "qwen-portal",
      mode: "oauth",
    });
    expect(result.config.agents?.defaults?.model?.primary).toBe("qwen-portal/coder-model");
    expect(result.config.models?.providers?.["qwen-portal"]).toMatchObject({
      baseUrl: "https://portal.qwen.ai/v1",
      apiKey: "qwen-oauth",
    });

    const authProfilePath = authProfilePathFor(requireAgentDir());
    const raw = await fs.readFile(authProfilePath, "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<string, { access?: string; refresh?: string; provider?: string }>;
    };
    expect(parsed.profiles?.["qwen-portal:default"]).toMatchObject({
      provider: "qwen-portal",
      access: "access",
      refresh: "refresh",
    });
  });
});

describe("resolvePreferredProviderForAuthChoice", () => {
  it("maps github-copilot to the provider", () => {
    expect(resolvePreferredProviderForAuthChoice("github-copilot")).toBe("github-copilot");
  });

  it("maps qwen-portal to the provider", () => {
    expect(resolvePreferredProviderForAuthChoice("qwen-portal")).toBe("qwen-portal");
  });

  it("maps ollama to the provider", () => {
    expect(resolvePreferredProviderForAuthChoice("ollama")).toBe("ollama");
  });

  it("returns undefined for unknown choices", () => {
    expect(resolvePreferredProviderForAuthChoice("unknown" as AuthChoice)).toBeUndefined();
  });
});
