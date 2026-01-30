import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AccessTokenPayload } from "./jwt.js";
import { verifyAccessToken } from "./jwt.js";

// Extend Hono's context with our user info
declare module "hono" {
	interface ContextVariableMap {
		user: AccessTokenPayload;
	}
}

/**
 * Authentication middleware - requires valid access token
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		throw new HTTPException(401, {
			message: "Missing authorization header",
		});
	}

	if (!authHeader.startsWith("Bearer ")) {
		throw new HTTPException(401, {
			message: "Invalid authorization header format",
		});
	}

	const token = authHeader.slice(7); // Remove "Bearer " prefix

	const payload = await verifyAccessToken(token);

	if (!payload) {
		throw new HTTPException(401, {
			message: "Invalid or expired access token",
		});
	}

	// Set user in context
	c.set("user", payload);

	await next();
}

/**
 * Optional auth middleware - doesn't require token but parses if present
 */
export async function optionalAuthMiddleware(
	c: Context,
	next: Next
): Promise<Response | void> {
	const authHeader = c.req.header("Authorization");

	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const payload = await verifyAccessToken(token);

		if (payload) {
			c.set("user", payload);
		}
	}

	await next();
}

/**
 * Tier requirement middleware - checks if user has required subscription tier
 */
export function requireTier(
	...allowedTiers: Array<"free" | "starter" | "pro" | "enterprise">
) {
	return async (c: Context, next: Next): Promise<Response | void> => {
		const user = c.get("user");

		if (!user) {
			throw new HTTPException(401, {
				message: "Authentication required",
			});
		}

		if (!allowedTiers.includes(user.tier)) {
			throw new HTTPException(403, {
				message: `This feature requires a ${allowedTiers.join(" or ")} subscription`,
			});
		}

		await next();
	};
}

/**
 * Email verification requirement middleware
 */
export function requireEmailVerified() {
	return async (c: Context, next: Next): Promise<Response | void> => {
		const user = c.get("user");

		if (!user) {
			throw new HTTPException(401, {
				message: "Authentication required",
			});
		}

		// Note: For full implementation, we'd need to check the database
		// This is a placeholder - the access token should include email_verified

		await next();
	};
}
