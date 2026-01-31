import { describe, expect, it } from "vitest";

import { TelegramUserConfigSchema } from "./config-schema.js";

describe("TelegramUserConfigSchema", () => {
  it("allows group entries without tools", () => {
    const result = TelegramUserConfigSchema.safeParse({
      groups: {
        "-100123": {
          allowFrom: ["@alice"],
          requireMention: true,
        },
        "*": {},
      },
    });

    expect(result.success).toBe(true);
  });
});
