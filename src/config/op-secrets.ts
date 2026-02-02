import childProcess from "node:child_process";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export class OpSecretError extends Error {
  constructor(
    message: string,
    public readonly ref: string,
    public readonly configPath: string,
  ) {
    super(message);
    this.name = "OpSecretError";
  }
}

function readOpSecret(ref: string, env: NodeJS.ProcessEnv): string {
  // Note: op reads may require an interactive sign-in; we intentionally fail loudly.
  const out = childProcess.execFileSync("op", ["read", ref], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });
  return String(out).trim();
}

function resolveAny(value: unknown, env: NodeJS.ProcessEnv, path: string): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("op://")) {
      try {
        const secret = readOpSecret(trimmed, env);
        if (!secret) {
          throw new OpSecretError("1Password secret resolved to empty string", trimmed, path);
        }
        return secret;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new OpSecretError(`Failed to resolve 1Password reference: ${msg}`, trimmed, path);
      }
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => resolveAny(item, env, `${path}[${index}]`));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = resolveAny(val, env, childPath);
    }
    return result;
  }

  return value;
}

/**
 * Replaces any string value equal to a 1Password reference (op://...) with the resolved secret.
 *
 * This runs during config load (after ${ENV} substitution, before schema validation).
 */
export function resolveConfigOpSecrets(
  obj: unknown,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  return resolveAny(obj, env, "");
}
