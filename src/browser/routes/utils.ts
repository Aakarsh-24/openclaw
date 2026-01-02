import type express from "express";

import type { BrowserRouteContext, ProfileContext } from "../server-context.js";

/**
 * Extract profile name from query string and get profile context.
 * Returns the profile context or null if the profile doesn't exist.
 */
export function getProfileContext(
  req: express.Request,
  ctx: BrowserRouteContext,
): ProfileContext | { error: string; status: number } {
  const profileName =
    typeof req.query.profile === "string"
      ? req.query.profile.trim()
      : undefined;

  try {
    return ctx.forProfile(profileName);
  } catch (err) {
    return { error: String(err), status: 404 };
  }
}

export function jsonError(
  res: express.Response,
  status: number,
  message: string,
) {
  res.status(status).json({ error: message });
}

export function toStringOrEmpty(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

export function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return undefined;
}

export function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.map((v) => toStringOrEmpty(v)).filter(Boolean);
  return strings.length ? strings : undefined;
}
