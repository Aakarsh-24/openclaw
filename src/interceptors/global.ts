import { createCommandSafetyGuard } from "./builtin/command-safety-guard.js";
import { createSecurityAudit } from "./builtin/security-audit.js";
import { createInterceptorRegistry, type InterceptorRegistry } from "./registry.js";

let globalRegistry: InterceptorRegistry | null = null;

/**
 * Initialize the global interceptor registry.
 * Creates the registry and registers built-in interceptors if not already initialized.
 * Idempotent.
 */
export function initializeGlobalInterceptors(): InterceptorRegistry {
  if (!globalRegistry) {
    globalRegistry = createInterceptorRegistry();
    // Register built-in interceptors
    globalRegistry.add(createCommandSafetyGuard());
    globalRegistry.add(createSecurityAudit());
  }
  return globalRegistry;
}

/**
 * Get the global interceptor registry.
 * Returns null if not yet initialized.
 */
export function getGlobalInterceptorRegistry(): InterceptorRegistry | null {
  return globalRegistry;
}

/**
 * Reset the global interceptor registry (for tests).
 */
export function resetGlobalInterceptors(): void {
  globalRegistry = null;
}
