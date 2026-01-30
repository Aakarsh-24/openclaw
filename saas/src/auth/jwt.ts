import * as jose from "jose";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
	sub: string; // User ID
	email: string;
	tier: "free" | "starter" | "pro" | "enterprise";
	iat: number;
	exp: number;
}

export interface RefreshTokenPayload {
	sub: string; // User ID
	sid: string; // Session ID
	iat: number;
	exp: number;
}

// Parse duration string (e.g., "15m", "7d") to seconds
function parseDuration(duration: string): number {
	const match = duration.match(/^(\d+)([smhd])$/);
	if (!match) {
		throw new Error(`Invalid duration format: ${duration}`);
	}

	const value = parseInt(match[1]!, 10);
	const unit = match[2];

	switch (unit) {
		case "s":
			return value;
		case "m":
			return value * 60;
		case "h":
			return value * 60 * 60;
		case "d":
			return value * 60 * 60 * 24;
		default:
			throw new Error(`Unknown duration unit: ${unit}`);
	}
}

// Create secret keys from environment
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

/**
 * Generate an access token (short-lived)
 */
export async function generateAccessToken(payload: {
	userId: string;
	email: string;
	tier: "free" | "starter" | "pro" | "enterprise";
}): Promise<string> {
	const expiry = parseDuration(env.JWT_ACCESS_EXPIRY);

	return new jose.SignJWT({
		email: payload.email,
		tier: payload.tier,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(payload.userId)
		.setIssuedAt()
		.setExpirationTime(`${expiry}s`)
		.setIssuer("moltbot-saas")
		.setAudience("moltbot-api")
		.sign(accessSecret);
}

/**
 * Generate a refresh token (long-lived)
 */
export async function generateRefreshToken(payload: {
	userId: string;
	sessionId: string;
}): Promise<string> {
	const expiry = parseDuration(env.JWT_REFRESH_EXPIRY);

	return new jose.SignJWT({
		sid: payload.sessionId,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(payload.userId)
		.setIssuedAt()
		.setExpirationTime(`${expiry}s`)
		.setIssuer("moltbot-saas")
		.setAudience("moltbot-refresh")
		.sign(refreshSecret);
}

/**
 * Verify and decode an access token
 */
export async function verifyAccessToken(
	token: string
): Promise<AccessTokenPayload | null> {
	try {
		const { payload } = await jose.jwtVerify(token, accessSecret, {
			issuer: "moltbot-saas",
			audience: "moltbot-api",
		});

		return {
			sub: payload.sub as string,
			email: payload["email"] as string,
			tier: payload["tier"] as AccessTokenPayload["tier"],
			iat: payload.iat as number,
			exp: payload.exp as number,
		};
	} catch {
		return null;
	}
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(
	token: string
): Promise<RefreshTokenPayload | null> {
	try {
		const { payload } = await jose.jwtVerify(token, refreshSecret, {
			issuer: "moltbot-saas",
			audience: "moltbot-refresh",
		});

		return {
			sub: payload.sub as string,
			sid: payload["sid"] as string,
			iat: payload.iat as number,
			exp: payload.exp as number,
		};
	} catch {
		return null;
	}
}

/**
 * Generate a secure random token for email verification, password reset, etc.
 */
export function generateSecureToken(): string {
	return crypto.randomBytes(32).toString("base64url");
}

/**
 * Hash a token for storage (using SHA-256)
 */
export function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate token expiry time
 */
export function getTokenExpiry(durationMs: number): Date {
	return new Date(Date.now() + durationMs);
}
