import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import { gitStatusCommand } from "./git.js";

const runCommandWithTimeoutMock = vi.hoisted(() => vi.fn());

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

function createTestRuntime() {
  const logs: string[] = [];
  const errors: string[] = [];
  const runtime: RuntimeEnv = {
    log: (...args) => logs.push(args.join(" ")),
    error: (...args) => errors.push(args.join(" ")),
    exit: (code) => {
      throw new Error(`EXIT:${code}`);
    },
  };
  return { runtime, logs, errors };
}

beforeEach(() => {
  runCommandWithTimeoutMock.mockReset();
});

describe("gitStatusCommand", () => {
  it("exits 127 with a clean message when git is missing", async () => {
    runCommandWithTimeoutMock.mockRejectedValue(
      Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" }),
    );

    const { runtime, errors } = createTestRuntime();

    await expect(gitStatusCommand({ json: false, verbose: false }, runtime)).rejects.toThrow(
      "EXIT:127",
    );
    expect(errors.join("\n")).toMatch(/git is not installed/i);
  });

  it("prints stdout/stderr on failure when verbose", async () => {
    runCommandWithTimeoutMock.mockResolvedValue({
      stdout: "some stdout\n",
      stderr: "some stderr\n",
      code: 2,
      signal: null,
      killed: false,
    });

    const { runtime, errors } = createTestRuntime();

    await expect(gitStatusCommand({ json: false, verbose: true }, runtime)).rejects.toThrow(
      "EXIT:2",
    );
    const joined = errors.join("\n");
    expect(joined).toMatch(/some stderr/i);
    expect(joined).toMatch(/stdout:/i);
  });

  it("parses porcelain v2 paths (including renames and C-quoted spaces)", async () => {
    runCommandWithTimeoutMock.mockResolvedValue({
      stdout: [
        "# branch.oid 0123456789abcdef",
        "# branch.head main",
        // rename record: X<score> then <path> <origPath>
        '2 R. N... 100644 100644 100644 deadbeef deadbeef R100 "new name.txt" "old name.txt"',
        // normal record: <path>
        '1 M. N... 100644 100644 100644 deadbeef deadbeef "spaced file.txt"',
        "",
      ].join("\n"),
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });

    const { runtime, logs } = createTestRuntime();
    await gitStatusCommand({ json: true, verbose: false }, runtime);

    const payload = JSON.parse(logs.join("\n")) as {
      branch: { head?: string };
      entries: Array<{ code: string; path: string; origPath?: string }>;
    };

    expect(payload.branch.head).toBe("main");
    const rename = payload.entries.find((e) => e.code === "2");
    expect(rename?.path).toBe("new name.txt");
    expect(rename?.origPath).toBe("old name.txt");

    const modified = payload.entries.find((e) => e.code === "1");
    expect(modified?.path).toBe("spaced file.txt");
  });
});
