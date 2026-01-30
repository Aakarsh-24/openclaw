import { describe, expect, it } from "vitest";
import { classifyFailoverReason } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";

const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});
describe("classifyFailoverReason", () => {
  it("returns a stable reason", () => {
    expect(classifyFailoverReason("invalid api key")).toBe("auth");
    expect(classifyFailoverReason("no credentials found")).toBe("auth");
    expect(classifyFailoverReason("no api key found")).toBe("auth");
    expect(classifyFailoverReason("429 too many requests")).toBe("rate_limit");
    expect(classifyFailoverReason("resource has been exhausted")).toBe("rate_limit");
    expect(
      classifyFailoverReason(
        '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      ),
    ).toBe("rate_limit");
    expect(classifyFailoverReason("invalid request format")).toBe("format");
    expect(classifyFailoverReason("credit balance too low")).toBe("billing");
    expect(classifyFailoverReason("deadline exceeded")).toBe("timeout");
    expect(classifyFailoverReason("string should match pattern")).toBe("format");
    expect(classifyFailoverReason("bad request")).toBeNull();
    expect(
      classifyFailoverReason(
        "messages.84.content.1.image.source.base64.data: At least one of the image dimensions exceed max allowed size for many-image requests: 2000 pixels",
      ),
    ).toBeNull();
    expect(classifyFailoverReason("image exceeds 5 MB maximum")).toBeNull();
  });
  it("classifies OpenAI usage limit errors as rate_limit", () => {
    expect(classifyFailoverReason("You have hit your ChatGPT usage limit (plus plan)")).toBe(
      "rate_limit",
    );
  });

  it("classifies 5xx server errors as timeout for fallback", () => {
    expect(classifyFailoverReason('500 "Internal Server Error"')).toBe("timeout");
    expect(classifyFailoverReason("502 Bad Gateway")).toBe("timeout");
    expect(classifyFailoverReason("503 Service Unavailable")).toBe("timeout");
    expect(classifyFailoverReason("504 Gateway Timeout")).toBe("timeout");
    expect(classifyFailoverReason("internal server error")).toBe("timeout");
    expect(classifyFailoverReason("bad gateway")).toBe("timeout");
    expect(classifyFailoverReason("service unavailable")).toBe("timeout");
  });

  it("classifies model unavailable errors as timeout for fallback", () => {
    expect(classifyFailoverReason("model not found")).toBe("timeout");
    expect(classifyFailoverReason("model is loading")).toBe("timeout");
    expect(classifyFailoverReason("model unavailable")).toBe("timeout");
    expect(classifyFailoverReason("model does not exist")).toBe("timeout");
    expect(classifyFailoverReason("no such model")).toBe("timeout");
    expect(classifyFailoverReason("model is currently unavailable")).toBe("timeout");
  });

  it("classifies capacity errors as rate_limit for backoff", () => {
    expect(classifyFailoverReason("no available workers")).toBe("rate_limit");
    expect(classifyFailoverReason("capacity exceeded")).toBe("rate_limit");
    expect(classifyFailoverReason("queue full")).toBe("rate_limit");
    expect(classifyFailoverReason("server is busy")).toBe("rate_limit");
    expect(classifyFailoverReason("all workers are busy")).toBe("rate_limit");
    expect(classifyFailoverReason("temporarily unavailable")).toBe("rate_limit");
  });
});
