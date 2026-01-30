import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export interface DbClient {
	query: <T extends pg.QueryResultRow = Record<string, unknown>>(
		text: string,
		params?: unknown[]
	) => Promise<pg.QueryResult<T>>;
	getClient: () => Promise<pg.PoolClient>;
	end: () => Promise<void>;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
	if (!pool) {
		pool = new Pool({
			connectionString: env.DATABASE_URL,
			max: 20,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
		});

		pool.on("error", (err) => {
			console.error("Unexpected database pool error:", err);
		});
	}
	return pool;
}

export function createDbClient(): DbClient {
	const p = getPool();

	return {
		query: <T extends pg.QueryResultRow = Record<string, unknown>>(
			text: string,
			params?: unknown[]
		) => p.query<T>(text, params),

		getClient: () => p.connect(),

		end: () => p.end(),
	};
}

// Transaction helper
export async function withTransaction<T>(
	db: DbClient,
	fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
	const client = await db.getClient();
	try {
		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

// Type helpers for database rows
export interface UserRow {
	id: string;
	email: string;
	email_verified: boolean;
	password_hash: string;
	display_name: string | null;
	avatar_url: string | null;
	totp_secret: Buffer | null;
	totp_enabled: boolean;
	failed_login_attempts: number;
	locked_until: Date | null;
	created_at: Date;
	updated_at: Date;
	last_login_at: Date | null;
	deleted_at: Date | null;
}

export interface SubscriptionRow {
	id: string;
	user_id: string;
	tier: "free" | "starter" | "pro" | "enterprise";
	status: "active" | "canceled" | "past_due" | "trialing";
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	current_period_start: Date | null;
	current_period_end: Date | null;
	cancel_at_period_end: boolean;
	created_at: Date;
	updated_at: Date;
	canceled_at: Date | null;
}

export interface TenantRow {
	id: string;
	user_id: string;
	namespace: string;
	pod_name: string | null;
	service_name: string | null;
	status: "provisioning" | "active" | "suspended" | "terminated";
	cpu_limit: string;
	memory_limit: string;
	storage_limit: string;
	vault_key_id: string | null;
	gateway_port: number | null;
	gateway_token_hash: string | null;
	last_activity_at: Date;
	scaled_down_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface UserSessionRow {
	id: string;
	user_id: string;
	refresh_token_hash: string;
	user_agent: string | null;
	ip_address: string | null;
	device_fingerprint: string | null;
	status: "active" | "expired" | "revoked";
	created_at: Date;
	expires_at: Date;
	last_used_at: Date;
	revoked_at: Date | null;
}

export interface TierLimitsRow {
	tier: "free" | "starter" | "pro" | "enterprise";
	daily_message_limit: number | null;
	monthly_token_limit: bigint | null;
	max_compute_hours_month: number | null;
	max_concurrent_sessions: number;
	max_storage_bytes: bigint;
	voice_enabled: boolean;
	video_enabled: boolean;
	custom_models_enabled: boolean;
	api_access_enabled: boolean;
	api_rate_limit: number;
	created_at: Date;
	updated_at: Date;
}
