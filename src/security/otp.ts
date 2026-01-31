/**
 * OTP Verification State Manager
 *
 * Tracks user verification status, handles expiration logic, and manages
 * state transitions for the OTP verification system.
 */

import type { OpenClawConfig } from "../config/config.js";
import {
  VerificationExpiredError,
  StrictModeViolationError,
  OtpConfigurationError,
} from "./errors.js";

export interface VerificationState {
  /** User identifier (e.g. slack:U123456, signal:+1234567890) */
  userId: string;
  /** When user was last successfully verified (ISO timestamp) */
  lastVerifiedAt: Date | null;
  /** Whether user is currently within grace period */
  inGracePeriod: boolean;
  /** When grace period expires (null if not in grace period) */
  gracePeriodExpiresAt: Date | null;
}

export interface OtpConfig {
  /** Whether OTP verification is enabled */
  enabled: boolean;
  /** Hours between required verifications (1-168) */
  intervalHours: number;
  /** Whether to enforce strict mode (block unverified users) */
  strictMode: boolean;
  /** Minutes of grace period after verification expires (5-60) */
  gracePeriodMinutes: number;
}

export class OtpVerificationManager {
  private verificationStates = new Map<string, VerificationState>();
  private config: OtpConfig;

  constructor(config: OpenClawConfig) {
    this.config = this.resolveOtpConfig(config);
  }

  /**
   * Get current verification state for a user
   */
  getVerificationState(userId: string): VerificationState {
    const existing = this.verificationStates.get(userId);
    if (existing) {
      return { ...existing }; // Return copy to prevent mutation
    }

    // Create initial state for new user
    const state: VerificationState = {
      userId,
      lastVerifiedAt: null,
      inGracePeriod: false,
      gracePeriodExpiresAt: null,
    };

    this.verificationStates.set(userId, state);
    return { ...state };
  }

  /**
   * Check if user is currently verified (within valid time window)
   */
  isUserVerified(userId: string): boolean {
    if (!this.config.enabled) return true;

    const state = this.getVerificationState(userId);

    // Never verified = not verified
    if (!state.lastVerifiedAt) return false;

    // Check if verification has expired
    const now = new Date();
    const expirationTime = new Date(state.lastVerifiedAt);
    expirationTime.setHours(expirationTime.getHours() + this.config.intervalHours);

    // Still within valid verification window
    if (now <= expirationTime) return true;

    // Check grace period
    if (state.inGracePeriod && state.gracePeriodExpiresAt && now <= state.gracePeriodExpiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Mark user as successfully verified
   */
  markUserVerified(userId: string): void {
    const now = new Date();
    const state: VerificationState = {
      userId,
      lastVerifiedAt: now,
      inGracePeriod: false,
      gracePeriodExpiresAt: null,
    };

    this.verificationStates.set(userId, state);
  }

  /**
   * Check if user should be blocked based on verification status
   * Throws appropriate errors if user should be blocked
   */
  enforceVerification(userId: string): void {
    if (!this.config.enabled) return;

    const isVerified = this.isUserVerified(userId);

    if (!isVerified) {
      const state = this.getVerificationState(userId);

      // Start grace period if user was previously verified but has expired
      if (state.lastVerifiedAt && !state.inGracePeriod) {
        this.startGracePeriod(userId);

        // After starting grace period, check again
        if (this.isUserVerified(userId)) {
          return; // User is now in grace period
        }
      }

      if (this.config.strictMode) {
        throw new StrictModeViolationError();
      } else {
        throw new VerificationExpiredError();
      }
    }
  }

  /**
   * Start grace period for a user whose verification has expired
   */
  private startGracePeriod(userId: string): void {
    const state = this.getVerificationState(userId);
    const now = new Date();
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setMinutes(gracePeriodEnd.getMinutes() + this.config.gracePeriodMinutes);

    const updatedState: VerificationState = {
      ...state,
      inGracePeriod: true,
      gracePeriodExpiresAt: gracePeriodEnd,
    };

    this.verificationStates.set(userId, updatedState);
  }

  /**
   * Get time until verification expires for a user
   * @returns milliseconds until expiration, or null if never verified/expired
   */
  getTimeUntilExpiration(userId: string): number | null {
    if (!this.config.enabled) return null;

    const state = this.getVerificationState(userId);
    if (!state.lastVerifiedAt) return null;

    const now = new Date();
    const expirationTime = new Date(state.lastVerifiedAt);
    expirationTime.setHours(expirationTime.getHours() + this.config.intervalHours);

    if (now >= expirationTime) return null; // Already expired

    return expirationTime.getTime() - now.getTime();
  }

  /**
   * Resolve OTP configuration from moltbot config with defaults
   */
  private resolveOtpConfig(config: OpenClawConfig): OtpConfig {
    const otpConfig = config.security?.otpVerification;

    if (!otpConfig) {
      throw new OtpConfigurationError("OTP verification configuration not found");
    }

    return {
      enabled: otpConfig.enabled ?? false,
      intervalHours: otpConfig.intervalHours ?? 24,
      strictMode: otpConfig.strictMode ?? false,
      gracePeriodMinutes: otpConfig.gracePeriodMinutes ?? 15,
    };
  }

  /**
   * Clear all verification states (for testing/reset)
   */
  clearAllStates(): void {
    this.verificationStates.clear();
  }

  /**
   * Get all current verification states (for debugging/admin)
   */
  getAllStates(): VerificationState[] {
    return Array.from(this.verificationStates.values()).map((state) => ({ ...state }));
  }
}
