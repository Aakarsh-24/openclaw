import { describe, expect, it, vi } from "vitest";

import { resolveSlackThreadStarter } from "./media.js";

describe("resolveSlackThreadStarter", () => {
  it("falls back to file metadata when text is empty", async () => {
    const client = {
      conversations: {
        replies: vi.fn().mockResolvedValue({
          messages: [
            {
              text: "",
              user: "U1",
              ts: "123.456",
              files: [{ name: "Daily Update" }],
            },
          ],
        }),
      },
    } as const;

    const starter = await resolveSlackThreadStarter({
      channelId: "C1",
      threadTs: "123.456",
      client: client as any,
    });

    expect(starter?.text).toContain("Daily Update");
  });

  it("uses blocks when text is empty", async () => {
    const client = {
      conversations: {
        replies: vi.fn().mockResolvedValue({
          messages: [
            {
              text: "",
              user: "U2",
              ts: "789.012",
              blocks: [{ text: { text: "Status summary" } }],
            },
          ],
        }),
      },
    } as const;

    const starter = await resolveSlackThreadStarter({
      channelId: "C2",
      threadTs: "789.012",
      client: client as any,
    });

    expect(starter?.text).toBe("Status summary");
  });
});
