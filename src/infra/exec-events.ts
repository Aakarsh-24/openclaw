import path from "node:path";
import type { MoltbotConfig } from "../config/config.js";

export type ExecEventName = "exec.started" | "exec.output" | "exec.completed";

export type ExecEventContext = {
  runId?: string;
  toolCallId?: string;
  sessionKey?: string;
};

type ExecEventBase = {
  event: ExecEventName;
  ts: number;
  seq: number;
  sessionId: string;
  runId?: string;
  sessionKey?: string;
  pid?: number;
  command: string;
  commandName?: string;
  context?: ExecEventContext;
};

export type ExecStartedEvent = ExecEventBase & {
  event: "exec.started";
  startedAt: number;
  cwd?: string;
};

export type ExecOutputEvent = ExecEventBase & {
  event: "exec.output";
  stream: "stdout" | "stderr";
  output: string;
  truncated?: boolean;
};

export type ExecCompletedEvent = ExecEventBase & {
  event: "exec.completed";
  startedAt: number;
  completedAt: number;
  durationMs: number;
  status: "completed" | "failed";
  exitCode: number | null;
  exitSignal: NodeJS.Signals | number | null;
  timedOut?: boolean;
  reason?: string;
};

export type ExecEventPayload = ExecStartedEvent | ExecOutputEvent | ExecCompletedEvent;

type ExecEventInputMap = {
  "exec.started": Omit<ExecStartedEvent, "event" | "ts" | "seq">;
  "exec.output": Omit<ExecOutputEvent, "event" | "ts" | "seq">;
  "exec.completed": Omit<ExecCompletedEvent, "event" | "ts" | "seq">;
};

export type ExecEventInput<T extends ExecEventName = ExecEventName> = ExecEventInputMap[T];

const listeners = new Set<(evt: ExecEventPayload) => void>();
let seq = 0;

export function emitExecEvent<T extends ExecEventName>(
  event: T,
  payload: ExecEventInput<T>,
): ExecEventPayload {
  const enriched = {
    ...payload,
    event,
    ts: Date.now(),
    seq: (seq += 1),
  } as ExecEventPayload;
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch {
      // Ignore listener failures.
    }
  }
  return enriched;
}

export function onExecEvent(listener: (evt: ExecEventPayload) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetExecEventsForTest(): void {
  seq = 0;
  listeners.clear();
}

const DEFAULT_COMMAND_WHITELIST = [
  "codex",
  "claude",
  "opencode",
  "pi",
  "gog",
  "himalaya",
  "playwright",
  "puppeteer",
] as const;

const DEFAULT_OUTPUT_THROTTLE_MS = 150;
const DEFAULT_OUTPUT_MAX_CHUNK_BYTES = 4096;
const DEFAULT_OUTPUT_BUFFER_MULTIPLIER = 8;
const MIN_OUTPUT_MAX_CHUNK_BYTES = 256;
const MAX_OUTPUT_BUFFER_BYTES = 256 * 1024;

const WRAPPER_COMMANDS = new Set(["npx", "pnpm", "pnpmx", "bunx", "npm", "yarn"]);

const WRAPPER_SUBCOMMANDS = new Set(["exec", "run", "run-script", "dlx", "x"]);

type ExecEventsConfigInput = {
  emitEvents?: boolean;
  commandWhitelist?: string[];
  outputThrottleMs?: number;
  outputMaxChunkBytes?: number;
};

type WhitelistMatchResult = {
  matched: boolean;
  commandName?: string;
};

export type ExecEventsConfigResolved = {
  emitEvents: boolean;
  commandWhitelist: string[];
  commandWhitelistSet: Set<string>;
  commandWhitelistTokens: string[];
  outputThrottleMs: number;
  outputMaxChunkBytes: number;
  outputBufferMaxBytes: number;
};

export type ExecEventRuntimeConfig = Pick<
  ExecEventsConfigResolved,
  "outputThrottleMs" | "outputMaxChunkBytes" | "outputBufferMaxBytes"
>;

export type ExecEventSessionState = {
  enabled: boolean;
  commandName?: string;
  context?: ExecEventContext;
  config?: ExecEventRuntimeConfig;
  startedEmitted: boolean;
  completedEmitted: boolean;
  outputBuffer?: ExecOutputBuffer;
};

function normalizeCommandName(value: string): string {
  return path.basename(value.trim()).toLowerCase();
}

function normalizeCommandWhitelist(entries?: unknown): string[] {
  const list = Array.isArray(entries) ? entries : DEFAULT_COMMAND_WHITELIST;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const name = normalizeCommandName(entry);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}

function resolvePositiveInt(value: unknown, fallback: number, min?: number): number {
  const raw = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  const floored = Math.floor(raw);
  if (min && floored < min) return min;
  return floored;
}

export function resolveExecEventsConfig(cfg?: MoltbotConfig): ExecEventsConfigResolved {
  const hooks = cfg?.hooks as { exec?: ExecEventsConfigInput } | undefined;
  const execCfg = hooks?.exec;
  const commandWhitelist = normalizeCommandWhitelist(execCfg?.commandWhitelist);
  const commandWhitelistSet = new Set(commandWhitelist);
  const outputThrottleMs = resolvePositiveInt(
    execCfg?.outputThrottleMs,
    DEFAULT_OUTPUT_THROTTLE_MS,
  );
  const outputMaxChunkBytes = resolvePositiveInt(
    execCfg?.outputMaxChunkBytes,
    DEFAULT_OUTPUT_MAX_CHUNK_BYTES,
    MIN_OUTPUT_MAX_CHUNK_BYTES,
  );
  const outputBufferMaxBytes = Math.min(
    Math.max(outputMaxChunkBytes * DEFAULT_OUTPUT_BUFFER_MULTIPLIER, outputMaxChunkBytes),
    MAX_OUTPUT_BUFFER_BYTES,
  );

  return {
    emitEvents: execCfg?.emitEvents !== false,
    commandWhitelist,
    commandWhitelistSet,
    commandWhitelistTokens: commandWhitelist,
    outputThrottleMs,
    outputMaxChunkBytes,
    outputBufferMaxBytes,
  } satisfies ExecEventsConfigResolved;
}

export function toExecEventRuntimeConfig(cfg: ExecEventsConfigResolved): ExecEventRuntimeConfig {
  return {
    outputThrottleMs: cfg.outputThrottleMs,
    outputMaxChunkBytes: cfg.outputMaxChunkBytes,
    outputBufferMaxBytes: cfg.outputBufferMaxBytes,
  };
}

function includesWhitelistToken(command: string, tokens: string[]): boolean {
  if (!command || tokens.length === 0) return false;
  const lower = command.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function isEnvAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function shellTokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) tokens.push(trimmed);
    current = "";
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      pushCurrent();
      continue;
    }
    current += ch;
  }
  pushCurrent();
  return tokens;
}

function findNextNonFlagToken(tokens: string[], startIndex: number): number | null {
  for (let i = startIndex; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;
    if (token === "--") continue;
    if (token.startsWith("-")) continue;
    if (isEnvAssignment(token)) continue;
    return i;
  }
  return null;
}

function resolveCommandTokenIndex(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  let index = 0;

  while (index < tokens.length && isEnvAssignment(tokens[index])) {
    index += 1;
  }
  if (index >= tokens.length) return null;

  const token = tokens[index]?.toLowerCase();
  if (token !== "env") return index;

  index += 1;
  while (index < tokens.length) {
    const entry = tokens[index];
    if (!entry) {
      index += 1;
      continue;
    }
    if (entry === "--") {
      index += 1;
      break;
    }
    if (entry.startsWith("-") || isEnvAssignment(entry)) {
      index += 1;
      continue;
    }
    break;
  }
  return index < tokens.length ? index : null;
}

function resolveWrapperCommandName(tokens: string[], wrapperIndex: number): string | undefined {
  const wrapper = normalizeCommandName(tokens[wrapperIndex]);
  const nextIndex = findNextNonFlagToken(tokens, wrapperIndex + 1);
  if (nextIndex == null) return undefined;
  const subcommand = normalizeCommandName(tokens[nextIndex]);

  if (wrapper === "npm" || wrapper === "yarn" || wrapper === "pnpm") {
    if (WRAPPER_SUBCOMMANDS.has(subcommand)) {
      const deeperIndex = findNextNonFlagToken(tokens, nextIndex + 1);
      if (deeperIndex != null) {
        return normalizeCommandName(tokens[deeperIndex]);
      }
    }
  }

  return subcommand;
}

export function matchExecCommandAgainstWhitelist(
  command: string,
  cfg: ExecEventsConfigResolved,
): WhitelistMatchResult {
  if (!cfg.emitEvents) return { matched: false };
  if (cfg.commandWhitelistSet.size === 0) return { matched: false };
  if (!includesWhitelistToken(command, cfg.commandWhitelistTokens)) {
    return { matched: false };
  }

  const tokens = shellTokenize(command);
  const commandIndex = resolveCommandTokenIndex(tokens);
  if (commandIndex == null) return { matched: false };

  const root = normalizeCommandName(tokens[commandIndex]);
  if (cfg.commandWhitelistSet.has(root)) {
    return { matched: true, commandName: root };
  }

  if (!WRAPPER_COMMANDS.has(root)) {
    return { matched: false };
  }

  const wrapped = resolveWrapperCommandName(tokens, commandIndex);
  if (wrapped && cfg.commandWhitelistSet.has(wrapped)) {
    return { matched: true, commandName: wrapped };
  }

  return { matched: false };
}

type OutputStream = "stdout" | "stderr";

type OutputStreamState = {
  buffer: string;
  truncated: boolean;
};

export type ExecOutputChunk = {
  stream: OutputStream;
  output: string;
  truncated?: boolean;
};

export type ExecOutputBuffer = {
  append: (stream: OutputStream, chunk: string) => void;
  flush: () => void;
  flushAll: () => void;
  dispose: () => void;
  hasBufferedOutput: () => boolean;
};

type OutputBufferOptions = {
  throttleMs: number;
  maxChunkBytes: number;
  maxBufferBytes: number;
  onFlush: (chunks: ExecOutputChunk[]) => void;
};

function byteLength(text: string): number {
  return Buffer.byteLength(text);
}

function sliceByMaxBytes(text: string, maxBytes: number): string {
  if (!text) return "";
  if (maxBytes <= 0) return text[0] ?? "";
  if (byteLength(text) <= maxBytes) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const bytes = byteLength(text.slice(0, mid));
    if (bytes <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  if (low <= 0) return text[0] ?? "";
  return text.slice(0, low);
}

function trimSuffixByMaxBytes(text: string, maxBytes: number): string {
  if (!text) return "";
  if (maxBytes <= 0) return text.slice(-1);
  if (byteLength(text) <= maxBytes) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const suffix = text.slice(mid);
    const bytes = byteLength(suffix);
    if (bytes > maxBytes) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const trimmed = text.slice(low);
  return trimmed || text.slice(-1);
}

function capBuffer(state: OutputStreamState, maxBufferBytes: number): void {
  const totalBytes = byteLength(state.buffer);
  if (totalBytes <= maxBufferBytes) return;

  state.truncated = true;
  state.buffer = trimSuffixByMaxBytes(state.buffer, maxBufferBytes);
}

export function createThrottledExecOutputBuffer(options: OutputBufferOptions): ExecOutputBuffer {
  const throttleMs = Math.max(0, Math.floor(options.throttleMs));
  const maxChunkBytes = Math.max(1, Math.floor(options.maxChunkBytes));
  const maxBufferBytes = Math.max(maxChunkBytes, Math.floor(options.maxBufferBytes));

  const stdout: OutputStreamState = { buffer: "", truncated: false };
  const stderr: OutputStreamState = { buffer: "", truncated: false };
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  let flushingAll = false;

  const getState = (stream: OutputStream) => (stream === "stdout" ? stdout : stderr);

  const schedule = () => {
    if (disposed || timer) return;
    if (throttleMs === 0) {
      flush();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, throttleMs);
  };

  const drainOnce = (state: OutputStreamState, stream: OutputStream): ExecOutputChunk | null => {
    if (!state.buffer) return null;
    const chunk = sliceByMaxBytes(state.buffer, maxChunkBytes);
    if (!chunk) return null;
    state.buffer = state.buffer.slice(chunk.length);
    const truncated = state.truncated || undefined;
    state.truncated = false;
    return { stream, output: chunk, ...(truncated ? { truncated } : {}) };
  };

  const flush = () => {
    if (disposed) return;
    const chunks: ExecOutputChunk[] = [];
    const stdoutChunk = drainOnce(stdout, "stdout");
    if (stdoutChunk) chunks.push(stdoutChunk);
    const stderrChunk = drainOnce(stderr, "stderr");
    if (stderrChunk) chunks.push(stderrChunk);
    if (chunks.length > 0) {
      options.onFlush(chunks);
    }
    if (!disposed && !flushingAll && throttleMs > 0 && (stdout.buffer || stderr.buffer)) {
      schedule();
    }
  };

  const flushAll = () => {
    if (disposed) return;
    flushingAll = true;
    try {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      while (!disposed && (stdout.buffer || stderr.buffer)) {
        flush();
      }
    } finally {
      flushingAll = false;
    }
  };

  const append = (stream: OutputStream, chunk: string) => {
    if (disposed || !chunk) return;
    const state = getState(stream);
    state.buffer += chunk;
    capBuffer(state, maxBufferBytes);
    schedule();
  };

  const dispose = () => {
    disposed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    append,
    flush,
    flushAll,
    dispose,
    hasBufferedOutput: () => stdout.buffer.length > 0 || stderr.buffer.length > 0,
  } satisfies ExecOutputBuffer;
}
