/**
 * Health Scorer
 *
 * Tracks health scores for accounts based on:
 * - Success/failure rates
 * - Rate limit frequency
 * - Recovery over time
 */

import { HEALTH_SCORE } from "./constants.js";

export class HealthScorer {
  private scores = new Map<string, number>();
  private lastUpdate = new Map<string, number>();

  getScore(profileId: string): number {
    const baseScore = this.scores.get(profileId) ?? HEALTH_SCORE.initial;
    const lastUpdateTime = this.lastUpdate.get(profileId);

    if (!lastUpdateTime) return baseScore;

    // Apply time-based recovery
    const minutesSinceUpdate = (Date.now() - lastUpdateTime) / 60_000;
    const recovery = Math.floor(
      minutesSinceUpdate * HEALTH_SCORE.recoveryPerMinute
    );

    return Math.min(HEALTH_SCORE.maxScore, baseScore + recovery);
  }

  recordSuccess(profileId: string): void {
    const current = this.getScore(profileId);
    const newScore = Math.min(
      HEALTH_SCORE.maxScore,
      current + HEALTH_SCORE.successBonus
    );
    this.scores.set(profileId, newScore);
    this.lastUpdate.set(profileId, Date.now());
  }

  recordFailure(profileId: string): void {
    const current = this.getScore(profileId);
    const newScore = Math.max(
      HEALTH_SCORE.minScore,
      current - HEALTH_SCORE.failurePenalty
    );
    this.scores.set(profileId, newScore);
    this.lastUpdate.set(profileId, Date.now());
  }

  recordRateLimit(profileId: string): void {
    const current = this.getScore(profileId);
    const newScore = Math.max(
      HEALTH_SCORE.minScore,
      current - HEALTH_SCORE.rateLimitPenalty
    );
    this.scores.set(profileId, newScore);
    this.lastUpdate.set(profileId, Date.now());
  }

  getSortedByHealth(
    profileIds: string[]
  ): Array<{ profileId: string; score: number }> {
    return profileIds
      .map((profileId) => ({
        profileId,
        score: this.getScore(profileId),
      }))
      .sort((a, b) => b.score - a.score);
  }

  toJSON(): {
    scores: Record<string, number>;
    lastUpdate: Record<string, number>;
  } {
    return {
      scores: Object.fromEntries(this.scores),
      lastUpdate: Object.fromEntries(this.lastUpdate),
    };
  }

  fromJSON(data: {
    scores?: Record<string, number>;
    lastUpdate?: Record<string, number>;
  }): void {
    if (data?.scores) {
      for (const [key, value] of Object.entries(data.scores)) {
        this.scores.set(key, value);
      }
    }
    if (data?.lastUpdate) {
      for (const [key, value] of Object.entries(data.lastUpdate)) {
        this.lastUpdate.set(key, value);
      }
    }
  }
}
