/**
 * Multi-Account Profile Order Integration
 *
 * Wraps resolveAuthProfileOrder to use intelligent multi-account selection
 * when enabled. Falls back to default behavior otherwise.
 */

import type { ClawdbotConfig } from "../../config/config.js";
import type { AuthProfileStore } from "../auth-profiles/types.js";
import { resolveAuthProfileOrder as baseResolveAuthProfileOrder } from "../auth-profiles/order.js";
import { isMultiAccountEnabled, getOrCreateManager } from "./model-auth-integration.js";

/**
 * Enhanced profile order resolution with multi-account intelligence.
 *
 * When multi-account is enabled for the provider:
 * - Uses health scores, quota tracking, and strategy-based selection
 * - Falls back to base order if multi-account unavailable
 *
 * When multi-account is disabled:
 * - Uses standard resolveAuthProfileOrder (round-robin + cooldown)
 */
export async function resolveProfileOrderWithMultiAccount(params: {
  cfg?: ClawdbotConfig;
  store: AuthProfileStore;
  provider: string;
  modelId?: string;
  preferredProfile?: string;
}): Promise<string[]> {
  const { cfg, store, provider, modelId, preferredProfile } = params;

  // Get base order first
  const baseOrder = baseResolveAuthProfileOrder({
    cfg,
    store,
    provider,
    preferredProfile,
  });

  // If multi-account not enabled or not enough profiles, use base order
  if (!isMultiAccountEnabled(provider, cfg) || baseOrder.length < 2) {
    return baseOrder;
  }

  // If no modelId provided, can't do intelligent selection
  if (!modelId) {
    return baseOrder;
  }

  try {
    const manager = await getOrCreateManager(provider, store, cfg);

    // Get intelligent ordering from manager
    const healthSorted = manager.healthScorer.getSortedByHealth(baseOrder);

    // Filter out rate-limited profiles and sort by health
    const available: string[] = [];
    const rateLimited: Array<{ profileId: string; score: number }> = [];

    for (const { profileId, score } of healthSorted) {
      if (manager.rateLimitTracker.isRateLimited(profileId, modelId)) {
        rateLimited.push({ profileId, score });
      } else {
        available.push(profileId);
      }
    }

    // Sort rate-limited by soonest cooldown expiry
    const rateLimitedSorted = rateLimited
      .map(({ profileId }) => ({
        profileId,
        cooldownRemaining: manager.rateLimitTracker.getCooldownRemaining(profileId, modelId),
      }))
      .sort((a, b) => a.cooldownRemaining - b.cooldownRemaining)
      .map(({ profileId }) => profileId);

    const result = [...available, ...rateLimitedSorted];

    // Ensure preferredProfile is first if specified and in list
    if (preferredProfile && result.includes(preferredProfile)) {
      return [preferredProfile, ...result.filter((p) => p !== preferredProfile)];
    }

    return result;
  } catch {
    // Fall back to base order on any error
    return baseOrder;
  }
}

/**
 * Synchronous version that uses cached manager state.
 * Falls back to base order if manager not initialized.
 */
export function resolveProfileOrderWithMultiAccountSync(params: {
  cfg?: ClawdbotConfig;
  store: AuthProfileStore;
  provider: string;
  modelId?: string;
  preferredProfile?: string;
}): string[] {
  const { cfg, store, provider, preferredProfile } = params;

  // Always return base order for sync version
  // Multi-account benefits come from the manager callbacks in run.ts
  return baseResolveAuthProfileOrder({
    cfg,
    store,
    provider,
    preferredProfile,
  });
}
