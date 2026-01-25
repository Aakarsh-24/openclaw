import { afterEach, describe, expect, it, vi } from "vitest";

const stealthMock = vi.hoisted(() => ({
  configureStealthMode: vi.fn(),
}));

vi.mock("./pw-stealth.js", () => stealthMock);

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    browser: {
      enabled: true,
      stealth: true,
      controlUrl: "http://127.0.0.1:19999",
    },
  })),
}));

vi.mock("./extension-relay.js", () => ({
  ensureChromeExtensionRelayServer: vi.fn(async () => {}),
}));

describe("browser server stealth integration", () => {
  afterEach(async () => {
    vi.resetModules();
    stealthMock.configureStealthMode.mockClear();
  });

  it("configures stealth mode from resolved browser config", async () => {
    const { startBrowserControlServerFromConfig, stopBrowserControlServer } =
      await import("./server.js");

    const state = await startBrowserControlServerFromConfig();
    expect(stealthMock.configureStealthMode).toHaveBeenCalledWith(true);

    if (state) {
      await stopBrowserControlServer();
    }
  });
});
