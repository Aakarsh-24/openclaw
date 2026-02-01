import { describe, expect, it } from "vitest";
import { tokenizePorcelainV2Line } from "./porcelain-v2.js";

describe("tokenizePorcelainV2Line", () => {
  it("splits unquoted tokens", () => {
    expect(tokenizePorcelainV2Line("1 M. N... 100644")).toEqual(["1", "M.", "N...", "100644"]);
  });

  it("parses quoted tokens with spaces", () => {
    expect(tokenizePorcelainV2Line('1 M. N... 100644 100644 100644 a b "spaced file.txt"')).toEqual(
      ["1", "M.", "N...", "100644", "100644", "100644", "a", "b", "spaced file.txt"],
    );
  });

  it("unescapes common C-escapes in quoted tokens", () => {
    expect(tokenizePorcelainV2Line('X "a\\n\\\"b\\t\\\\c" Y')).toEqual(["X", 'a\n"b\t\\c', "Y"]);
  });

  it("handles rename record paths as separate quoted tokens", () => {
    const tokens = tokenizePorcelainV2Line(
      '2 R. N... 100644 100644 100644 deadbeef deadbeef R100 "new name.txt" "old name.txt"',
    );
    expect(tokens.at(-2)).toBe("new name.txt");
    expect(tokens.at(-1)).toBe("old name.txt");
  });
});
