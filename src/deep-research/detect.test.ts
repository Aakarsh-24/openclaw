import { describe, expect, it } from "vitest";

import {
  detectDeepResearchIntent,
  extractTopicFromMessage,
  getDefaultPatterns,
} from "./detect.js";

describe("detectDeepResearchIntent", () => {
  describe("Russian patterns", () => {
    it("detects \"сделай депресерч\"", () => {
      expect(detectDeepResearchIntent("Сделай депресерч про AI")).toBe(true);
    });

    it("detects \"дип рисерч\" phonetic", () => {
      expect(
        detectDeepResearchIntent("Сделай дип рисерч про криптовалюты"),
      ).toBe(true);
    });

    it("detects \"дип-ресерч\" with hyphen", () => {
      expect(
        detectDeepResearchIntent("Сделай дип-ресерч про криптовалюты"),
      ).toBe(true);
    });

    it("detects typo variant \"дипресерч\" with verb", () => {
      expect(detectDeepResearchIntent("Сделай дипресерч про рынок")).toBe(true);
    });

    it("detects with filler words between verb and keyword", () => {
      expect(
        detectDeepResearchIntent(
          "Пожалуйста, сделай для этого дипресерч про китайскую робототехнику",
        ),
      ).toBe(true);
    });

    it("detects typo variant \"гипресерч\" with verb", () => {
      expect(
        detectDeepResearchIntent("Сделай для нас гипресерч по рынку"),
      ).toBe(true);
    });

    it("detects \"глубокий поиск\" with verb", () => {
      expect(
        detectDeepResearchIntent("Сделай глубокий поиск по трендам"),
      ).toBe(true);
    });

    it("detects \"глубокое исследование\" with verb", () => {
      expect(
        detectDeepResearchIntent("Сделай глубокое исследование про бренды"),
      ).toBe(true);
    });
  });

  describe("English patterns", () => {
    it("detects \"do deep research\"", () => {
      expect(
        detectDeepResearchIntent("Do deep research on quantum computing"),
      ).toBe(true);
    });

    it("detects \"conduct deep research\"", () => {
      expect(
        detectDeepResearchIntent("Conduct deep research for AI trends"),
      ).toBe(true);
    });
  });

  describe("Mixed patterns", () => {
    it("detects \"сделай deep research\"", () => {
      expect(
        detectDeepResearchIntent("Сделай deep research про блокчейн"),
      ).toBe(true);
    });

    it("detects \"deep research, на тему\" pattern", () => {
      expect(
        detectDeepResearchIntent(
          "Я хочу попросить тебя, deep research, на тему того, как используется suno",
        ),
      ).toBe(true);
    });

    it("detects mixed-latin transcript spelling", () => {
      expect(
        detectDeepResearchIntent("Сделай дип-реeseерch про тренды"),
      ).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    it("detects uppercase \"ДЕПРЕСЕРЧ\"", () => {
      expect(detectDeepResearchIntent("Сделай ДЕПРЕСЕРЧ")).toBe(true);
    });

    it("detects mixed case \"Deep Research\"", () => {
      expect(detectDeepResearchIntent("Do Deep Research please")).toBe(true);
    });
  });

  describe("Substring matching", () => {
    it("matches patterns inside a longer sentence", () => {
      expect(
        detectDeepResearchIntent("Пожалуйста, сделай депресерч сегодня"),
      ).toBe(true);
    });
  });

  describe("Non-matching cases", () => {
    it("does NOT match \"депресерч\" standalone", () => {
      expect(detectDeepResearchIntent("депресерч")).toBe(false);
    });

    it("does NOT match \"дип рисерч\" standalone", () => {
      expect(detectDeepResearchIntent("дип рисерч")).toBe(false);
    });

    it("does NOT match \"deep research\" mention", () => {
      expect(detectDeepResearchIntent("What is deep research?")).toBe(false);
    });

    it("does NOT match \"глубокий поиск\" mention", () => {
      expect(detectDeepResearchIntent("глубокий поиск по рынку")).toBe(false);
    });

    it("does NOT match \"deepsearch\" (different word)", () => {
      expect(detectDeepResearchIntent("deepsearch something")).toBe(false);
    });

    it("does NOT match \"исследование\" (not in patterns)", () => {
      expect(detectDeepResearchIntent("Сделай исследование")).toBe(false);
    });

    it("does NOT match empty string", () => {
      expect(detectDeepResearchIntent("")).toBe(false);
    });

    it("does NOT match random text", () => {
      expect(detectDeepResearchIntent("Hello, how are you?")).toBe(false);
    });
  });

  describe("Custom patterns", () => {
    it("uses custom patterns when provided", () => {
      expect(detectDeepResearchIntent("custom trigger", ["custom trigger"])).toBe(
        true,
      );
      expect(detectDeepResearchIntent("депресерч", ["custom trigger"])).toBe(
        false,
      );
    });
  });
});

describe("extractTopicFromMessage", () => {
  it("extracts topic after \"сделай депресерч про\"", () => {
    expect(
      extractTopicFromMessage("Сделай депресерч про квантовые компьютеры"),
    ).toBe("квантовые компьютеры");
  });

  it("extracts topic after \"deep research on\"", () => {
    expect(extractTopicFromMessage("Do deep research on AI safety")).toBe(
      "on AI safety",
    );
  });

  it("returns original if no pattern found", () => {
    expect(extractTopicFromMessage("random message")).toBe("random message");
  });

  it("returns empty topic when only trigger words are present", () => {
    expect(extractTopicFromMessage("Нужен депресерч")).toBe("");
    expect(extractTopicFromMessage("Сделай депресерч")).toBe("");
  });

  it("treats punctuation-only topics as empty", () => {
    expect(extractTopicFromMessage("Сделай депресерч?")).toBe("");
    expect(extractTopicFromMessage("Do deep research?")).toBe("");
  });

  it("cleans leading punctuation", () => {
    expect(
      extractTopicFromMessage("Сделай депресерч: тема исследования"),
    ).toBe("тема исследования");
  });

  it("extracts topic with filler words in request", () => {
    expect(
      extractTopicFromMessage(
        "Пожалуйста, сделай для этого дипресерч про китайских роботов",
      ),
    ).toBe("китайских роботов");
  });

  it("extracts topic from noisy voice transcript", () => {
    expect(
      extractTopicFromMessage(
        "Сделайгу глубокий поиск, сделай дип-ресерч. И глубокий поиск, я думаю, ну, сделай дипресерч на тему, э-э-э, какие валенки модны в Китае в 2025 году.",
      ),
    ).toBe("какие валенки модны в Китае в 2025 году");
  });

  it("extracts topic from \"глубокий поиск\" request", () => {
    expect(
      extractTopicFromMessage("Сделай глубокий поиск по трендам"),
    ).toBe("трендам");
  });

  it("extracts topic from \"глубокое исследование\" request", () => {
    expect(
      extractTopicFromMessage("Сделай глубокое исследование про бренды"),
    ).toBe("бренды");
  });

  it("extracts topic from mixed-latin transcript spelling", () => {
    expect(
      extractTopicFromMessage(
        "Сделай дип-реeseерch на тему последние тренды в одежде",
      ),
    ).toBe("последние тренды в одежде");
  });

  it("uses custom patterns when provided", () => {
    expect(
      extractTopicFromMessage("custom trigger about space", ["custom trigger"]),
    ).toBe("about space");
  });
});

describe("getDefaultPatterns", () => {
  it("returns 20 patterns", () => {
    expect(getDefaultPatterns()).toHaveLength(20);
  });

  it("includes key patterns", () => {
    const patterns = getDefaultPatterns();
    expect(patterns).toContain("сделай депресерч");
    expect(patterns).toContain("perform deep research");
    expect(patterns).toContain("сделай дипресерч");
  });
});
