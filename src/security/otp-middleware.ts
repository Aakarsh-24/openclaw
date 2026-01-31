/**
 * OTP Verification Middleware
 *
 * Automatically enforces OTP verification before processing messages/commands.
 * Can be configured per-channel and with custom failure handlers.
 */

import type { OpenClawConfig } from "../config/config.js";
import { OtpVerificationManager } from "./otp.js";
import { VerificationExpiredError, StrictModeViolationError } from "./errors.js";

export type OtpMiddlewareResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "expired" | "strict_mode" | "never_verified" | "disabled";
      message: string;
      gracePeriodActive?: boolean;
    };

export type OtpCheckContext = {
  userId: string;
  channel?: string;
  channelType?: "dm" | "group" | "channel";
  isCommand?: boolean;
};

/**
 * Check if OTP verification is required and enforced for this context.
 *
 * @returns Result indicating if the user is allowed to proceed
 */
export function checkOtpVerification(
  config: OpenClawConfig,
  context: OtpCheckContext,
): OtpMiddlewareResult {
  const otpConfig = config.auth?.otpVerification;

  // OTP not configured or disabled
  if (!otpConfig?.enabled || !otpConfig?.secret) {
    return { allowed: true };
  }

  // Check if OTP is required for this channel
  if (context.channel && otpConfig.channels) {
    const channelEnabled = otpConfig.channels[context.channel as keyof typeof otpConfig.channels];
    if (channelEnabled === false) {
      return { allowed: true };
    }
  }

  // Create manager and check verification
  try {
    const manager = new OtpVerificationManager(config);
    manager.enforceVerification(context.userId);

    // If we get here, verification is valid
    return { allowed: true };
  } catch (error) {
    if (error instanceof VerificationExpiredError) {
      const manager = new OtpVerificationManager(config);
      const state = manager.getVerificationState(context.userId);

      return {
        allowed: false,
        reason: state.inGracePeriod ? "expired" : "never_verified",
        message: state.inGracePeriod
          ? `Your verification has expired. Grace period active for ${otpConfig.gracePeriodMinutes ?? 15} minutes. Please re-verify with: /otp <code>`
          : state.lastVerifiedAt
            ? `Your verification expired. Please verify with: /otp <code>`
            : `OTP verification required. Please verify with: /otp <code>`,
        gracePeriodActive: state.inGracePeriod,
      };
    }

    if (error instanceof StrictModeViolationError) {
      return {
        allowed: false,
        reason: "strict_mode",
        message: "Access blocked. OTP verification required. Contact your administrator.",
      };
    }

    // Unknown error - allow through but log
    console.error("OTP middleware error:", error);
    return { allowed: true };
  }
}

/**
 * Verify an OTP code and update user's verification state.
 *
 * @returns true if valid, false if invalid
 */
export function verifyOtpCode(config: OpenClawConfig, userId: string, code: string): boolean {
  const otpConfig = config.auth?.otpVerification;

  if (!otpConfig?.enabled || !otpConfig?.secret) {
    return false;
  }

  try {
    const manager = new OtpVerificationManager(config);

    // Import TOTP validation from the security module
    // This will need to call TotpManager.validateCode
    const { TotpManager } = require("./totp.js");
    const isValid = TotpManager.validateCode(otpConfig.secret, code);

    if (isValid) {
      manager.markUserVerified(userId);
      return true;
    }

    return false;
  } catch (error) {
    console.error("OTP verification error:", error);
    return false;
  }
}

/**
 * Get verification status for a user.
 */
export function getOtpStatus(
  config: OpenClawConfig,
  userId: string,
): {
  enabled: boolean;
  verified: boolean;
  lastVerifiedAt: Date | null;
  expiresAt: Date | null;
  inGracePeriod: boolean;
} {
  const otpConfig = config.auth?.otpVerification;

  if (!otpConfig?.enabled) {
    return {
      enabled: false,
      verified: true,
      lastVerifiedAt: null,
      expiresAt: null,
      inGracePeriod: false,
    };
  }

  try {
    const manager = new OtpVerificationManager(config);
    const state = manager.getVerificationState(userId);
    const verified = manager.isUserVerified(userId);

    let expiresAt: Date | null = null;
    if (state.lastVerifiedAt) {
      expiresAt = new Date(state.lastVerifiedAt);
      expiresAt.setHours(expiresAt.getHours() + (otpConfig.intervalHours ?? 24));
    }

    return {
      enabled: true,
      verified,
      lastVerifiedAt: state.lastVerifiedAt,
      expiresAt,
      inGracePeriod: state.inGracePeriod,
    };
  } catch (error) {
    console.error("Error getting OTP status:", error);
    return {
      enabled: true,
      verified: false,
      lastVerifiedAt: null,
      expiresAt: null,
      inGracePeriod: false,
    };
  }
}
