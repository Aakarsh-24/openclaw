import type pg from "pg";
import type { DbClient, SubscriptionRow, UserRow, UserSessionRow } from "../db/client.js";
import { withTransaction } from "../db/client.js";
import {
	generateAccessToken,
	generateRefreshToken,
	generateSecureToken,
	getTokenExpiry,
	hashToken,
	verifyRefreshToken,
} from "./jwt.js";
import {
	hashPassword,
	needsRehash,
	validatePasswordStrength,
	verifyPassword,
} from "./password.js";

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthResult {
	success: boolean;
	error?: string;
	user?: {
		id: string;
		email: string;
		displayName: string | null;
		emailVerified: boolean;
		tier: SubscriptionRow["tier"];
	};
	tokens?: {
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
	};
}

export interface SignupInput {
	email: string;
	password: string;
	displayName?: string;
}

export interface LoginInput {
	email: string;
	password: string;
	userAgent?: string;
	ipAddress?: string;
}

export class AuthService {
	constructor(private db: DbClient) {}

	/**
	 * Register a new user
	 */
	async signup(input: SignupInput): Promise<AuthResult> {
		const email = input.email.toLowerCase().trim();

		// Validate email format
		if (!this.isValidEmail(email)) {
			return { success: false, error: "Invalid email format" };
		}

		// Validate password strength
		const passwordErrors = validatePasswordStrength(input.password);
		if (passwordErrors.length > 0) {
			return { success: false, error: passwordErrors.join("; ") };
		}

		// Check if user already exists
		const existingUser = await this.db.query<UserRow>(
			"SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
			[email]
		);

		if (existingUser.rows.length > 0) {
			return { success: false, error: "Email already registered" };
		}

		// Hash password
		const passwordHash = await hashPassword(input.password);

		// Create user and subscription in a transaction
		const result = await withTransaction(this.db, async (client) => {
			// Create user
			const userResult = await client.query<UserRow>(
				`INSERT INTO users (email, password_hash, display_name)
				 VALUES ($1, $2, $3)
				 RETURNING *`,
				[email, passwordHash, input.displayName ?? null]
			);

			const user = userResult.rows[0]!;

			// Create free tier subscription
			await client.query(
				`INSERT INTO subscriptions (user_id, tier, status)
				 VALUES ($1, 'free', 'active')`,
				[user.id]
			);

			// Generate email verification token
			const verificationToken = generateSecureToken();
			const tokenHash = hashToken(verificationToken);
			const expiresAt = getTokenExpiry(EMAIL_VERIFICATION_EXPIRY_MS);

			await client.query(
				`INSERT INTO email_verifications (user_id, token_hash, expires_at)
				 VALUES ($1, $2, $3)`,
				[user.id, tokenHash, expiresAt]
			);

			return {
				user,
				verificationToken,
			};
		});

		// TODO: Send verification email with result.verificationToken

		return {
			success: true,
			user: {
				id: result.user.id,
				email: result.user.email,
				displayName: result.user.display_name,
				emailVerified: false,
				tier: "free",
			},
		};
	}

	/**
	 * Authenticate a user and create a session
	 */
	async login(input: LoginInput): Promise<AuthResult> {
		const email = input.email.toLowerCase().trim();

		// Fetch user
		const userResult = await this.db.query<UserRow>(
			`SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
			[email]
		);

		if (userResult.rows.length === 0) {
			// Use same error for non-existent users to prevent enumeration
			return { success: false, error: "Invalid email or password" };
		}

		const user = userResult.rows[0]!;

		// Check if account is locked
		if (user.locked_until && user.locked_until > new Date()) {
			const remainingMs = user.locked_until.getTime() - Date.now();
			const remainingMinutes = Math.ceil(remainingMs / 60000);
			return {
				success: false,
				error: `Account is locked. Try again in ${remainingMinutes} minutes`,
			};
		}

		// Verify password
		const isValid = await verifyPassword(input.password, user.password_hash);

		if (!isValid) {
			// Increment failed attempts
			const newAttempts = user.failed_login_attempts + 1;
			const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

			await this.db.query(
				`UPDATE users
				 SET failed_login_attempts = $1,
				     locked_until = $2
				 WHERE id = $3`,
				[
					newAttempts,
					shouldLock
						? new Date(Date.now() + LOCKOUT_DURATION_MS)
						: null,
					user.id,
				]
			);

			if (shouldLock) {
				return {
					success: false,
					error: `Too many failed attempts. Account locked for 15 minutes`,
				};
			}

			return { success: false, error: "Invalid email or password" };
		}

		// Check if password needs rehashing
		if (needsRehash(user.password_hash)) {
			const newHash = await hashPassword(input.password);
			await this.db.query(
				"UPDATE users SET password_hash = $1 WHERE id = $2",
				[newHash, user.id]
			);
		}

		// Get subscription tier
		const subscriptionResult = await this.db.query<SubscriptionRow>(
			"SELECT tier FROM subscriptions WHERE user_id = $1",
			[user.id]
		);

		const tier = subscriptionResult.rows[0]?.tier ?? "free";

		// Create session
		const sessionId = await this.createSession(user.id, {
			userAgent: input.userAgent,
			ipAddress: input.ipAddress,
		});

		// Generate tokens
		const accessToken = await generateAccessToken({
			userId: user.id,
			email: user.email,
			tier,
		});

		const refreshToken = await generateRefreshToken({
			userId: user.id,
			sessionId,
		});

		// Reset failed attempts and update last login
		await this.db.query(
			`UPDATE users
			 SET failed_login_attempts = 0,
			     locked_until = NULL,
			     last_login_at = NOW()
			 WHERE id = $1`,
			[user.id]
		);

		return {
			success: true,
			user: {
				id: user.id,
				email: user.email,
				displayName: user.display_name,
				emailVerified: user.email_verified,
				tier,
			},
			tokens: {
				accessToken,
				refreshToken,
				expiresIn: 900, // 15 minutes in seconds
			},
		};
	}

	/**
	 * Refresh access token using a refresh token
	 */
	async refreshTokens(
		refreshToken: string
	): Promise<AuthResult> {
		const payload = await verifyRefreshToken(refreshToken);

		if (!payload) {
			return { success: false, error: "Invalid refresh token" };
		}

		// Verify session exists and is active
		const sessionResult = await this.db.query<UserSessionRow>(
			`SELECT * FROM user_sessions
			 WHERE id = $1
			   AND user_id = $2
			   AND status = 'active'
			   AND expires_at > NOW()`,
			[payload.sid, payload.sub]
		);

		if (sessionResult.rows.length === 0) {
			return { success: false, error: "Session expired or revoked" };
		}

		const session = sessionResult.rows[0]!;

		// Get user and subscription
		const userResult = await this.db.query<UserRow>(
			"SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
			[payload.sub]
		);

		if (userResult.rows.length === 0) {
			return { success: false, error: "User not found" };
		}

		const user = userResult.rows[0]!;

		const subscriptionResult = await this.db.query<SubscriptionRow>(
			"SELECT tier FROM subscriptions WHERE user_id = $1",
			[user.id]
		);

		const tier = subscriptionResult.rows[0]?.tier ?? "free";

		// Update session last used
		await this.db.query(
			"UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1",
			[session.id]
		);

		// Generate new tokens
		const newAccessToken = await generateAccessToken({
			userId: user.id,
			email: user.email,
			tier,
		});

		const newRefreshToken = await generateRefreshToken({
			userId: user.id,
			sessionId: session.id,
		});

		// Update refresh token hash in session
		await this.db.query(
			"UPDATE user_sessions SET refresh_token_hash = $1 WHERE id = $2",
			[hashToken(newRefreshToken), session.id]
		);

		return {
			success: true,
			user: {
				id: user.id,
				email: user.email,
				displayName: user.display_name,
				emailVerified: user.email_verified,
				tier,
			},
			tokens: {
				accessToken: newAccessToken,
				refreshToken: newRefreshToken,
				expiresIn: 900,
			},
		};
	}

	/**
	 * Logout - revoke a session
	 */
	async logout(userId: string, sessionId: string): Promise<void> {
		await this.db.query(
			`UPDATE user_sessions
			 SET status = 'revoked', revoked_at = NOW()
			 WHERE id = $1 AND user_id = $2`,
			[sessionId, userId]
		);
	}

	/**
	 * Logout from all sessions
	 */
	async logoutAll(userId: string): Promise<void> {
		await this.db.query(
			`UPDATE user_sessions
			 SET status = 'revoked', revoked_at = NOW()
			 WHERE user_id = $1 AND status = 'active'`,
			[userId]
		);
	}

	/**
	 * Verify email with token
	 */
	async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
		const tokenHash = hashToken(token);

		const result = await this.db.query<{
			id: string;
			user_id: string;
			expires_at: Date;
			used_at: Date | null;
		}>(
			`SELECT * FROM email_verifications
			 WHERE token_hash = $1`,
			[tokenHash]
		);

		if (result.rows.length === 0) {
			return { success: false, error: "Invalid verification token" };
		}

		const verification = result.rows[0]!;

		if (verification.used_at) {
			return { success: false, error: "Token already used" };
		}

		if (verification.expires_at < new Date()) {
			return { success: false, error: "Token expired" };
		}

		// Mark token as used and verify email
		await withTransaction(this.db, async (client) => {
			await client.query(
				"UPDATE email_verifications SET used_at = NOW() WHERE id = $1",
				[verification.id]
			);

			await client.query(
				"UPDATE users SET email_verified = TRUE WHERE id = $1",
				[verification.user_id]
			);
		});

		return { success: true };
	}

	/**
	 * Request password reset
	 */
	async requestPasswordReset(
		email: string
	): Promise<{ success: boolean; token?: string }> {
		const normalizedEmail = email.toLowerCase().trim();

		const userResult = await this.db.query<UserRow>(
			"SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
			[normalizedEmail]
		);

		// Always return success to prevent email enumeration
		if (userResult.rows.length === 0) {
			return { success: true };
		}

		const user = userResult.rows[0]!;

		// Invalidate existing reset tokens
		await this.db.query(
			"UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
			[user.id]
		);

		// Generate new reset token
		const resetToken = generateSecureToken();
		const tokenHash = hashToken(resetToken);
		const expiresAt = getTokenExpiry(PASSWORD_RESET_EXPIRY_MS);

		await this.db.query(
			`INSERT INTO password_resets (user_id, token_hash, expires_at)
			 VALUES ($1, $2, $3)`,
			[user.id, tokenHash, expiresAt]
		);

		// TODO: Send password reset email

		return { success: true, token: resetToken };
	}

	/**
	 * Reset password with token
	 */
	async resetPassword(
		token: string,
		newPassword: string
	): Promise<{ success: boolean; error?: string }> {
		// Validate new password
		const passwordErrors = validatePasswordStrength(newPassword);
		if (passwordErrors.length > 0) {
			return { success: false, error: passwordErrors.join("; ") };
		}

		const tokenHash = hashToken(token);

		const result = await this.db.query<{
			id: string;
			user_id: string;
			expires_at: Date;
			used_at: Date | null;
		}>(
			"SELECT * FROM password_resets WHERE token_hash = $1",
			[tokenHash]
		);

		if (result.rows.length === 0) {
			return { success: false, error: "Invalid reset token" };
		}

		const reset = result.rows[0]!;

		if (reset.used_at) {
			return { success: false, error: "Token already used" };
		}

		if (reset.expires_at < new Date()) {
			return { success: false, error: "Token expired" };
		}

		// Hash new password and update
		const passwordHash = await hashPassword(newPassword);

		await withTransaction(this.db, async (client) => {
			await client.query(
				"UPDATE password_resets SET used_at = NOW() WHERE id = $1",
				[reset.id]
			);

			await client.query(
				`UPDATE users
				 SET password_hash = $1,
				     failed_login_attempts = 0,
				     locked_until = NULL
				 WHERE id = $2`,
				[passwordHash, reset.user_id]
			);

			// Revoke all sessions for security
			await client.query(
				`UPDATE user_sessions
				 SET status = 'revoked', revoked_at = NOW()
				 WHERE user_id = $1 AND status = 'active'`,
				[reset.user_id]
			);
		});

		return { success: true };
	}

	/**
	 * Get user by ID
	 */
	async getUserById(userId: string): Promise<UserRow | null> {
		const result = await this.db.query<UserRow>(
			"SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
			[userId]
		);

		return result.rows[0] ?? null;
	}

	// Private helpers

	private async createSession(
		userId: string,
		metadata: { userAgent?: string; ipAddress?: string }
	): Promise<string> {
		const refreshToken = generateSecureToken();
		const tokenHash = hashToken(refreshToken);
		const expiresAt = getTokenExpiry(REFRESH_TOKEN_EXPIRY_MS);

		const result = await this.db.query<{ id: string }>(
			`INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			[userId, tokenHash, metadata.userAgent ?? null, metadata.ipAddress ?? null, expiresAt]
		);

		return result.rows[0]!.id;
	}

	private isValidEmail(email: string): boolean {
		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email) && email.length <= 255;
	}
}
