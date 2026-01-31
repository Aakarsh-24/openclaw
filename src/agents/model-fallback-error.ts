export interface AttemptInfo {
  provider: string;
  model: string;
  error: string;
  reason?: string;
}

export interface AllModelsFailedErrorOptions {
  attempts: AttemptInfo[];
  allInCooldown: boolean;
  retryAfterMs?: number;
  cause?: unknown;
}

export class AllModelsFailedError extends Error {
  readonly attempts: AttemptInfo[];
  readonly allInCooldown: boolean;
  readonly retryAfterMs?: number;

  constructor(message: string, options: AllModelsFailedErrorOptions) {
    super(message);
    this.name = "AllModelsFailedError";
    this.attempts = options.attempts;
    this.allInCooldown = options.allInCooldown;
    this.retryAfterMs = options.retryAfterMs;
    if (options.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

export function isAllModelsFailedError(error: unknown): error is AllModelsFailedError {
  return error instanceof AllModelsFailedError;
}
