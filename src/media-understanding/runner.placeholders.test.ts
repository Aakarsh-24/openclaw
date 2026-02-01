import { describe, expect, it } from "vitest";
import { normalizePlaceholders } from "./runner.js";

describe("normalizePlaceholders", () => {
  it("converts {file} to {{MediaPath}}", () => {
    expect(normalizePlaceholders("{file}")).toBe("{{MediaPath}}");
  });

  it("converts {input} and {media} to {{MediaPath}}", () => {
    expect(normalizePlaceholders("{input}")).toBe("{{MediaPath}}");
    expect(normalizePlaceholders("{media}")).toBe("{{MediaPath}}");
  });

  it("converts output placeholders", () => {
    expect(normalizePlaceholders("{output}")).toBe("{{OutputDir}}");
    expect(normalizePlaceholders("{output_dir}")).toBe("{{OutputDir}}");
    expect(normalizePlaceholders("{output_base}")).toBe("{{OutputBase}}");
  });

  it("converts {prompt} and {media_dir}", () => {
    expect(normalizePlaceholders("{prompt}")).toBe("{{Prompt}}");
    expect(normalizePlaceholders("{media_dir}")).toBe("{{MediaDir}}");
  });

  it("is case-insensitive", () => {
    expect(normalizePlaceholders("{FILE}")).toBe("{{MediaPath}}");
    expect(normalizePlaceholders("{File}")).toBe("{{MediaPath}}");
    expect(normalizePlaceholders("{OUTPUT_DIR}")).toBe("{{OutputDir}}");
  });

  it("handles multiple placeholders in one string", () => {
    expect(normalizePlaceholders("{file} --output {output_dir}")).toBe(
      "{{MediaPath}} --output {{OutputDir}}",
    );
  });

  it("leaves unknown placeholders unchanged", () => {
    expect(normalizePlaceholders("{unknown}")).toBe("{unknown}");
    expect(normalizePlaceholders("{{MediaPath}}")).toBe("{{MediaPath}}");
  });

  it("leaves regular text unchanged", () => {
    expect(normalizePlaceholders("--model large-v3")).toBe("--model large-v3");
  });
});
