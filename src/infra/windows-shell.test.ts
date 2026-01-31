import { describe, expect, it } from "vitest";

import { wrapPowerShellUtf8Command } from "./windows-shell.js";

describe("wrapPowerShellUtf8Command", () => {
  it("prefixes utf8 console settings", () => {
    const result = wrapPowerShellUtf8Command("echo hi");
    expect(result).toContain("[Console]::OutputEncoding");
    expect(result).toContain("[Console]::InputEncoding");
    expect(result).toContain("System.Text.Encoding]::UTF8");
    expect(result).toContain("chcp 65001");
    expect(result).toContain("; echo hi");
  });
});
