import { Hono } from "hono";
import { authMiddleware } from "../../auth/middleware.js";
import type { DbClient, SubscriptionRow, TierLimitsRow } from "../../db/client.js";

interface UsageRecordRow {
	id: string;
	user_id: string;
	tenant_id: string;
	period_start: Date;
	period_end: Date;
	messages_sent: number;
	messages_received: number;
	tokens_input: bigint;
	tokens_output: bigint;
	compute_seconds: number;
	storage_bytes: bigint;
	created_at: Date;
	updated_at: Date;
}

export function createUsageRoutes(db: DbClient): Hono {
	const app = new Hono();

	// All usage routes require authentication
	app.use("*", authMiddleware);

	// GET /usage - Get current period usage
	app.get("/", async (c) => {
		const user = c.get("user");

		// Get current period (this month)
		const now = new Date();
		const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

		// Get usage record
		const usageResult = await db.query<UsageRecordRow>(
			`SELECT * FROM usage_records
			 WHERE user_id = $1
			   AND period_start = $2
			   AND period_end = $3`,
			[user.sub, periodStart.toISOString().split("T")[0], periodEnd.toISOString().split("T")[0]]
		);

		// Get subscription tier
		const subscriptionResult = await db.query<SubscriptionRow>(
			"SELECT tier FROM subscriptions WHERE user_id = $1",
			[user.sub]
		);

		const tier = subscriptionResult.rows[0]?.tier ?? "free";

		// Get tier limits
		const limitsResult = await db.query<TierLimitsRow>(
			"SELECT * FROM tier_limits WHERE tier = $1",
			[tier]
		);

		const limits = limitsResult.rows[0];

		const usage = usageResult.rows[0];

		return c.json({
			period: {
				start: periodStart.toISOString(),
				end: periodEnd.toISOString(),
			},
			usage: {
				messagesSent: usage?.messages_sent ?? 0,
				messagesReceived: usage?.messages_received ?? 0,
				tokensInput: usage ? Number(usage.tokens_input) : 0,
				tokensOutput: usage ? Number(usage.tokens_output) : 0,
				computeSeconds: usage?.compute_seconds ?? 0,
				storageBytes: usage ? Number(usage.storage_bytes) : 0,
			},
			limits: limits
				? {
						dailyMessageLimit: limits.daily_message_limit,
						monthlyTokenLimit: limits.monthly_token_limit
							? Number(limits.monthly_token_limit)
							: null,
						maxComputeHoursMonth: limits.max_compute_hours_month,
						maxStorageBytes: Number(limits.max_storage_bytes),
						voiceEnabled: limits.voice_enabled,
						videoEnabled: limits.video_enabled,
						customModelsEnabled: limits.custom_models_enabled,
						apiAccessEnabled: limits.api_access_enabled,
					}
				: null,
			tier,
		});
	});

	// GET /usage/history - Get usage history
	app.get("/history", async (c) => {
		const user = c.get("user");
		const months = parseInt(c.req.query("months") ?? "6", 10);

		const result = await db.query<UsageRecordRow>(
			`SELECT * FROM usage_records
			 WHERE user_id = $1
			 ORDER BY period_start DESC
			 LIMIT $2`,
			[user.sub, months]
		);

		return c.json({
			history: result.rows.map((row) => ({
				period: {
					start: row.period_start,
					end: row.period_end,
				},
				messagesSent: row.messages_sent,
				messagesReceived: row.messages_received,
				tokensInput: Number(row.tokens_input),
				tokensOutput: Number(row.tokens_output),
				computeSeconds: row.compute_seconds,
				storageBytes: Number(row.storage_bytes),
			})),
		});
	});

	// GET /usage/daily - Get daily usage for current month
	app.get("/daily", async (c) => {
		const user = c.get("user");

		// This would require a separate daily tracking table
		// For now, return a placeholder

		return c.json({
			message: "Daily usage tracking not yet implemented",
			daily: [],
		});
	});

	return app;
}
