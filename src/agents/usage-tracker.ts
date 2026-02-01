/**
 * Usage Tracker for Smart Router
 * 
 * Tracks daily model usage with limits and automatic fallback.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface UsageStats {
  date: string;
  models: Record<string, number>;
}

export interface UsageTrackerOptions {
  configDir: string;
  filename?: string;
}

export class UsageTracker {
  private filePath: string;

  constructor(options: UsageTrackerOptions) {
    this.filePath = path.join(options.configDir, options.filename ?? "usage-stats.json");
  }

  private getTodayDate(): string {
    return new Date().toISOString().split("T")[0]!;
  }

  private load(): UsageStats {
    const today = this.getTodayDate();
    const defaultStats: UsageStats = { date: today, models: {} };

    if (!fs.existsSync(this.filePath)) {
      return defaultStats;
    }

    try {
      const content = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(content) as UsageStats;
      
      // Reset if it's a new day
      if (data.date !== today) {
        return defaultStats;
      }
      
      return data;
    } catch (error) {
      console.warn("[UsageTracker] Failed to load usage stats, resetting:", error);
      return defaultStats;
    }
  }

  private save(data: UsageStats): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[UsageTracker] Failed to save usage stats:", error);
    }
  }

  /**
   * Increment usage count for a model
   */
  increment(modelId: string): number {
    const stats = this.load();
    stats.models[modelId] = (stats.models[modelId] ?? 0) + 1;
    this.save(stats);
    return stats.models[modelId]!;
  }

  /**
   * Get current usage for a model
   */
  getUsage(modelId: string): number {
    return this.load().models[modelId] ?? 0;
  }

  /**
   * Check if model is at or over a limit
   */
  isAtLimit(modelId: string, limit: number): boolean {
    return this.getUsage(modelId) >= limit;
  }

  /**
   * Get all usage stats
   */
  getAllUsage(): UsageStats {
    return this.load();
  }

  /**
   * Reset all usage (mainly for testing)
   */
  reset(): void {
    this.save({ date: this.getTodayDate(), models: {} });
  }
}

// Singleton for default usage (can be overridden in tests)
let defaultTracker: UsageTracker | null = null;

export function getUsageTracker(configDir?: string): UsageTracker {
  if (!defaultTracker || configDir) {
    defaultTracker = new UsageTracker({
      // Use os.homedir() for reliable home directory resolution (not ~ literal)
      configDir: configDir ?? process.env.OPENCLAW_CONFIG_DIR ?? path.join(os.homedir(), ".openclaw"),
    });
  }
  return defaultTracker;
}
