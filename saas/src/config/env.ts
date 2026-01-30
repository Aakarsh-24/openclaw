import { z } from "zod";

const envSchema = z.object({
	// Server
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(3000),
	HOST: z.string().default("0.0.0.0"),

	// Database
	DATABASE_URL: z.string().url(),

	// Redis (for sessions and rate limiting)
	REDIS_URL: z.string().url().optional(),

	// JWT secrets
	JWT_ACCESS_SECRET: z.string().min(32),
	JWT_REFRESH_SECRET: z.string().min(32),

	// JWT expiry
	JWT_ACCESS_EXPIRY: z.string().default("15m"),
	JWT_REFRESH_EXPIRY: z.string().default("7d"),

	// Encryption
	ENCRYPTION_KEY: z.string().min(32), // 256-bit key for AES-256

	// Vault (optional, for production)
	VAULT_ADDR: z.string().url().optional(),
	VAULT_TOKEN: z.string().optional(),

	// Stripe (optional for billing)
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),

	// Kubernetes (for orchestration)
	KUBERNETES_NAMESPACE: z.string().default("moltbot-tenants"),
	KUBERNETES_IN_CLUSTER: z.coerce.boolean().default(false),

	// Email (for verification emails)
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	SMTP_FROM: z.string().email().optional(),

	// Frontend URL (for email links)
	FRONTEND_URL: z.string().url().default("http://localhost:5173"),

	// Rate limiting
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

	// Logging
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

function loadEnv() {
	const result = envSchema.safeParse(process.env);

	if (!result.success) {
		console.error("Invalid environment variables:");
		for (const issue of result.error.issues) {
			console.error(`  ${issue.path.join(".")}: ${issue.message}`);
		}
		throw new Error("Failed to load environment variables");
	}

	return result.data;
}

export const env = loadEnv();

export type Env = z.infer<typeof envSchema>;
