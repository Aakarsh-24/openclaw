import { describe, expect, it, vi } from "vitest";

import { wrapFetchWithAbortSignal } from "./fetch.js";

describe("wrapFetchWithAbortSignal", () => {
  it("adds duplex: half for requests with body (Node.js 22+)", async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);
    await wrapped("https://example.com", { body: "test body", method: "POST" });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((seenInit as Record<string, unknown>)?.duplex).toBe("half");
  });

  it("does not add duplex for requests without body", async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);
    await wrapped("https://example.com", { method: "GET" });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((seenInit as Record<string, unknown>)?.duplex).toBeUndefined();
  });

  it("preserves existing duplex option if already set", async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);
    await wrapped("https://example.com", {
      body: "test body",
      method: "POST",
      duplex: "full",
    } as RequestInit);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((seenInit as Record<string, unknown>)?.duplex).toBe("full");
  });

  it("converts foreign abort signals to native controllers", async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenSignal = init?.signal as AbortSignal | undefined;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);

    let abortHandler: (() => void) | null = null;
    const fakeSignal = {
      aborted: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "abort") abortHandler = handler;
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === "abort" && abortHandler === handler) abortHandler = null;
      },
    } as AbortSignal;

    const promise = wrapped("https://example.com", { signal: fakeSignal });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal).not.toBe(fakeSignal);

    abortHandler?.();
    expect(seenSignal?.aborted).toBe(true);

    await promise;
  });
});
