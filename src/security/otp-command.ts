/**
 * OTP Command Handler
 *
 * Handles /otp <code> commands for user verification.
 */

import type { OpenClawConfig } from "../config/config.js";
import { verifyOtpCode, getOtpStatus } from "./otp-middleware.js";

export type OtpCommandResult =
  | { success: true; message: string }
  | { success: false; message: string };

/**
 * Handle /otp command.
 *
 * Usage:
 *   /otp <code> - Verify with 6-digit code
 *   /otp status - Check verification status
 */
export function handleOtpCommand(
  config: OpenClawConfig,
  userId: string,
  args: string[],
): OtpCommandResult {
  const otpConfig = config.auth?.otpVerification;

  if (!otpConfig?.enabled) {
    return {
      success: false,
      message: "OTP verification is not enabled.",
    };
  }

  // Handle /otp status
  if (args[0] === "status") {
    const status = getOtpStatus(config, userId);

    if (!status.verified) {
      return {
        success: false,
        message: status.lastVerifiedAt
          ? `Verification expired. Last verified: ${status.lastVerifiedAt.toISOString()}`
          : "Not verified. Use: /otp <code>",
      };
    }

    const timeRemaining = status.expiresAt
      ? Math.floor((status.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
      : 0;

    return {
      success: true,
      message: `✅ Verified. Expires in ${timeRemaining} hours (${status.expiresAt?.toISOString() ?? "unknown"})`,
    };
  }

  // Handle /otp <code>
  const code = args[0]?.trim();

  if (!code) {
    return {
      success: false,
      message: "Usage: /otp <code> or /otp status",
    };
  }

  // Remove any non-digit characters
  const cleanCode = code.replace(/\D/g, "");

  if (cleanCode.length !== 6) {
    return {
      success: false,
      message: "Invalid code. Must be 6 digits.",
    };
  }

  const isValid = verifyOtpCode(config, userId, cleanCode);

  if (isValid) {
    const intervalHours = otpConfig.intervalHours ?? 24;
    return {
      success: true,
      message: `✅ Verified! Valid for ${intervalHours} hours.`,
    };
  }

  return {
    success: false,
    message: "❌ Invalid code. Check your authenticator app and try again.",
  };
}

/**
 * Check if a message is an OTP command.
 */
export function isOtpCommand(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("/otp ") || trimmed === "/otp";
}

/**
 * Parse OTP command arguments.
 */
export function parseOtpCommand(text: string): string[] {
  const trimmed = text.trim();

  if (!trimmed.startsWith("/otp")) {
    return [];
  }

  // Remove "/otp" and split remaining args
  const argsString = trimmed.slice(4).trim();
  return argsString ? argsString.split(/\s+/) : [];
}
