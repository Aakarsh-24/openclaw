import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { AuthService } from "../../auth/service.js";
import { authMiddleware } from "../../auth/middleware.js";
import { verifyRefreshToken } from "../../auth/jwt.js";
import type { DbClient } from "../../db/client.js";

// Request schemas
const signupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8).max(128),
	displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

const refreshSchema = z.object({
	refreshToken: z.string(),
});

const verifyEmailSchema = z.object({
	token: z.string(),
});

const requestResetSchema = z.object({
	email: z.string().email(),
});

const resetPasswordSchema = z.object({
	token: z.string(),
	password: z.string().min(8).max(128),
});

export function createAuthRoutes(db: DbClient): Hono {
	const app = new Hono();
	const authService = new AuthService(db);

	// POST /auth/signup - Register a new user
	app.post("/signup", zValidator("json", signupSchema), async (c) => {
		const body = c.req.valid("json");

		const result = await authService.signup({
			email: body.email,
			password: body.password,
			displayName: body.displayName,
		});

		if (!result.success) {
			return c.json({ error: result.error }, 400);
		}

		return c.json(
			{
				message: "Account created successfully. Please verify your email.",
				user: result.user,
			},
			201
		);
	});

	// POST /auth/login - Authenticate user
	app.post("/login", zValidator("json", loginSchema), async (c) => {
		const body = c.req.valid("json");

		const result = await authService.login({
			email: body.email,
			password: body.password,
			userAgent: c.req.header("User-Agent"),
			ipAddress: c.req.header("X-Forwarded-For") ?? c.req.header("X-Real-IP"),
		});

		if (!result.success) {
			return c.json({ error: result.error }, 401);
		}

		return c.json({
			user: result.user,
			tokens: result.tokens,
		});
	});

	// POST /auth/refresh - Refresh access token
	app.post("/refresh", zValidator("json", refreshSchema), async (c) => {
		const { refreshToken } = c.req.valid("json");

		const result = await authService.refreshTokens(refreshToken);

		if (!result.success) {
			return c.json({ error: result.error }, 401);
		}

		return c.json({
			user: result.user,
			tokens: result.tokens,
		});
	});

	// POST /auth/logout - Logout current session
	app.post("/logout", authMiddleware, async (c) => {
		const user = c.get("user");

		// Get session ID from request body (optional)
		const body = await c.req.json().catch(() => ({})) as { sessionId?: string };

		if (body.sessionId) {
			await authService.logout(user.sub, body.sessionId);
		}

		return c.json({ message: "Logged out successfully" });
	});

	// POST /auth/logout-all - Logout all sessions
	app.post("/logout-all", authMiddleware, async (c) => {
		const user = c.get("user");

		await authService.logoutAll(user.sub);

		return c.json({ message: "Logged out from all sessions" });
	});

	// GET /auth/me - Get current user info
	app.get("/me", authMiddleware, async (c) => {
		const user = c.get("user");

		const fullUser = await authService.getUserById(user.sub);

		if (!fullUser) {
			return c.json({ error: "User not found" }, 404);
		}

		return c.json({
			id: fullUser.id,
			email: fullUser.email,
			displayName: fullUser.display_name,
			emailVerified: fullUser.email_verified,
			createdAt: fullUser.created_at,
			lastLoginAt: fullUser.last_login_at,
		});
	});

	// POST /auth/verify-email - Verify email with token
	app.post("/verify-email", zValidator("json", verifyEmailSchema), async (c) => {
		const { token } = c.req.valid("json");

		const result = await authService.verifyEmail(token);

		if (!result.success) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ message: "Email verified successfully" });
	});

	// POST /auth/request-password-reset - Request password reset
	app.post(
		"/request-password-reset",
		zValidator("json", requestResetSchema),
		async (c) => {
			const { email } = c.req.valid("json");

			await authService.requestPasswordReset(email);

			// Always return success to prevent email enumeration
			return c.json({
				message: "If an account exists, a password reset email will be sent",
			});
		}
	);

	// POST /auth/reset-password - Reset password with token
	app.post(
		"/reset-password",
		zValidator("json", resetPasswordSchema),
		async (c) => {
			const { token, password } = c.req.valid("json");

			const result = await authService.resetPassword(token, password);

			if (!result.success) {
				return c.json({ error: result.error }, 400);
			}

			return c.json({ message: "Password reset successfully" });
		}
	);

	return app;
}
