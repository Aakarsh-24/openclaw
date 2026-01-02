/**
 * Deep Research keyword detection
 * @see docs/sdd/deep-research/keyword-detection.md
 */

const DEEP_RESEARCH_PATTERNS = [
  // Group 1: Russian "депресерч"
  "сделай депресерч",
  "сделать депресерч",
  "сделайте депресерч",
  "запусти депресерч",
  "нужен депресерч",
  "депресерч по",
  "депресерч на тему",
  "депресерч про",
  // Group 2: Russian phonetic
  "сделай дип рисерч",
  "сделать дип рисерч",
  // Group 3: English
  "do deep research",
  "run deep research",
  "start deep research",
  "conduct deep research",
  "perform deep research",
  // Group 4: Mixed
  "сделай deep research",
  "сделать deep research",
  "запусти deep research",
  // Group 5: Russian typo variants
  "сделай дипресерч",
  "сделать дипресерч",
] as const;

const FLEXIBLE_RU_TRIGGER_RE = new RegExp(
  String.raw`(?:^|[\s"'“”‘’(（【])(?:сделай|сделайгу|сделать|сделайте|запусти|нужен|нужна|нужно)(?:\s+\S+){0,4}?\s+(?:депресерч|дипресерч|гипресерч|дип[-–—\s]+рисерч|дип[-–—\s]+ресерч|deep\s+research|глубок(?:ий\s+поиск|ое\s+исследование))(?![\p{L}\p{N}])`,
  "iu",
);
const MIXED_RESEARCH_FRAGMENT =
  String.raw`[rр][eеё]{1,3}[sс][eеё]{1,3}(?:[aа])?[rр](?:[cс][hх]|ч)`;
const FLEXIBLE_MIXED_TRIGGER_RE = new RegExp(
  String.raw`(?:^|[\s"'“”‘’(（【])(?:сделай|сделать|сделайте|запусти|нужен|нужна|нужно)(?:\s+\S+){0,4}?\s+(?:deep|dip|дип)\s*[-–—]?\s*${MIXED_RESEARCH_FRAGMENT}(?![\p{L}\p{N}])`,
  "iu",
);
const TOKEN_THEN_PREP_RE = new RegExp(
  String.raw`(?:deep\s+research|депресерч|дип[-–—\s]*ресерч)[\s,.:;!?—-]*?(?:на тему|про|по)(?=$|[\s,.:;!?—-])`,
  "iu",
);
const DISFLUENCY_PREFIX_RE = new RegExp(
  String.raw`^(?:э(?:[-–—\s]*э)+|эм+|мм+|м(?:[-–—\s]*м)+|ну|значит|короче|типа|как бы|в общем|в целом|я думаю|я бы сказал)(?:[,:.!?\-—]|\s)+`,
  "iu",
);

type MatchInfo = { start: number; length: number };

function findPatternMatch(
  normalized: string,
  patterns: readonly string[],
): MatchInfo | null {
  let matchStart = -1;
  let matchLength = 0;
  for (const pattern of patterns) {
    const patternLower = pattern.toLowerCase();
    const index = normalized.indexOf(patternLower);
    if (index === -1) continue;
    if (index > matchStart || (index === matchStart && pattern.length > matchLength)) {
      matchStart = index;
      matchLength = pattern.length;
    }
  }
  if (matchStart === -1) return null;
  return { start: matchStart, length: matchLength };
}

function findFlexibleMatch(normalized: string): MatchInfo | null {
  const match =
    FLEXIBLE_RU_TRIGGER_RE.exec(normalized) ??
    FLEXIBLE_MIXED_TRIGGER_RE.exec(normalized);
  if (!match || match.index === undefined) return null;
  return { start: match.index, length: match[0].length };
}

function stripLeadingDisfluencies(text: string): string {
  let result = text;
  for (let i = 0; i < 4; i += 1) {
    const trimmed = result.trim();
    const next = trimmed.replace(DISFLUENCY_PREFIX_RE, "").trim();
    if (next === trimmed) break;
    result = next;
  }
  return result;
}

/**
 * Detect if message contains deep research intent
 * @param message - User message text
 * @param customPatterns - Optional custom patterns from config
 * @returns true if deep research intent detected
 */
export function detectDeepResearchIntent(
  message: string,
  customPatterns?: readonly string[],
): boolean {
  const patterns = customPatterns ?? DEEP_RESEARCH_PATTERNS;
  const normalized = message.toLowerCase();
  const matchesPattern = patterns.some((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );
  if (matchesPattern) return true;
  if (customPatterns) return false;
  return (
    FLEXIBLE_RU_TRIGGER_RE.test(normalized) ||
    FLEXIBLE_MIXED_TRIGGER_RE.test(normalized) ||
    TOKEN_THEN_PREP_RE.test(normalized)
  );
}

/**
 * Extract topic from message by removing trigger keywords
 * @param message - Original user message
 * @param customPatterns - Optional custom patterns from config
 * @returns Extracted topic or original message
 */
export function extractTopicFromMessage(
  message: string,
  customPatterns?: readonly string[],
): string {
  const normalized = message.toLowerCase();
  const patterns = customPatterns ?? DEEP_RESEARCH_PATTERNS;
  const commandPrefixes = [
    "сделай",
    "сделайгу",
    "сделать",
    "сделайте",
    "запусти",
    "нужен",
    "нужна",
    "нужно",
  ];
  const politePrefixes = ["пожалуйста", "плиз", "пж"];
  const prepositionPrefixes = ["про", "по", "на тему"];

  // Find the latest matching pattern (prefer longer at same index)
  const match =
    findPatternMatch(normalized, patterns) ??
    (customPatterns ? null : findFlexibleMatch(normalized));

  if (!match) {
    const tokenPrepMatch = TOKEN_THEN_PREP_RE.exec(message);
    if (!tokenPrepMatch || tokenPrepMatch.index === undefined) return message;
    let topic = message.slice(tokenPrepMatch.index + tokenPrepMatch[0].length);
    topic = topic.replace(/\s+/g, " ").trim();
    topic = topic.replace(/^[\s:,\.\-—]+/, "").trim();
    topic = stripLeadingDisfluencies(topic);
    topic = topic.replace(/[\s:,\.\-—!?]+$/, "").trim();
    if (!/[\p{L}\p{N}]/u.test(topic)) {
      return "";
    }
    return topic;
  }

  const before = message.slice(0, match.start);
  const after = message.slice(match.start + match.length);
  const afterHasContent = /[\p{L}\p{N}]/u.test(after);
  const beforeHasTrigger =
    !customPatterns &&
    (FLEXIBLE_RU_TRIGGER_RE.test(before) ||
      FLEXIBLE_MIXED_TRIGGER_RE.test(before));

  let topic =
    afterHasContent && beforeHasTrigger ? after : `${before}${after}`;

  topic = topic.replace(/\s+/g, " ").trim();
  topic = topic.replace(/^[\s:,\.\-—]+/, "").trim();
  topic = stripLeadingDisfluencies(topic);

  for (const prefix of politePrefixes) {
    const trimmed = topic.trim();
    if (trimmed.toLowerCase() === prefix) {
      topic = "";
      break;
    }
    const politeRe = new RegExp(`^${prefix}(?:[,:.!?\\-—]|\\s)+`, "i");
    if (politeRe.test(trimmed)) {
      topic = trimmed.replace(politeRe, "").trim();
      break;
    }
  }

  const loweredTopic = topic.toLowerCase();
  for (const prefix of commandPrefixes) {
    if (loweredTopic === prefix) {
      topic = "";
      break;
    }
    if (loweredTopic.startsWith(`${prefix} `)) {
      topic = topic.slice(prefix.length).trim();
      break;
    }
  }

  const loweredAfterCommand = topic.toLowerCase();
  for (const prefix of prepositionPrefixes) {
    if (loweredAfterCommand === prefix) {
      topic = "";
      break;
    }
    const prepositionRe = new RegExp(
      `^${prefix}(?:[,:.!?\\-—]|\\s)+`,
      "i",
    );
    if (prepositionRe.test(topic)) {
      topic = topic.replace(prepositionRe, "").trim();
      break;
    }
  }

  topic = topic.replace(/^[\s:,\.\-—]+/, "").trim();
  topic = stripLeadingDisfluencies(topic);
  topic = topic.replace(/[\s:,\.\-—!?]+$/, "").trim();

  if (!/[\p{L}\p{N}]/u.test(topic)) {
    return "";
  }

  return topic;
}

/**
 * Get all default patterns (for testing/config)
 */
export function getDefaultPatterns(): readonly string[] {
  return DEEP_RESEARCH_PATTERNS;
}
