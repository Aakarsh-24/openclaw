import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../auth/middleware.js";
import type { DbClient, SubscriptionRow, TierLimitsRow } from "../../db/client.js";

const updateSubscriptionSchema = z.object({
	tier: z.enum(["free", "starter", "pro", "enterprise"]),
});

export function createBillingRoutes(db: DbClient): Hono {
	const app = new Hono();

	// All billing routes require authentication
	app.use("*", authMiddleware);

	// GET /billing/subscription - Get current subscription
	app.get("/subscription", async (c) => {
		const user = c.get("user");

		const result = await db.query<SubscriptionRow>(
			"SELECT * FROM subscriptions WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No subscription found" }, 404);
		}

		const subscription = result.rows[0]!;

		return c.json({
			tier: subscription.tier,
			status: subscription.status,
			currentPeriod: {
				start: subscription.current_period_start,
				end: subscription.current_period_end,
			},
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			createdAt: subscription.created_at,
		});
	});

	// GET /billing/plans - Get available subscription plans
	app.get("/plans", async (c) => {
		const result = await db.query<TierLimitsRow>(
			"SELECT * FROM tier_limits ORDER BY tier"
		);

		const pricing: Record<string, { monthly: number; yearly: number }> = {
			free: { monthly: 0, yearly: 0 },
			starter: { monthly: 9.99, yearly: 99.99 },
			pro: { monthly: 29.99, yearly: 299.99 },
			enterprise: { monthly: 99.99, yearly: 999.99 },
		};

		return c.json({
			plans: result.rows.map((row) => ({
				tier: row.tier,
				pricing: pricing[row.tier],
				limits: {
					dailyMessageLimit: row.daily_message_limit,
					monthlyTokenLimit: row.monthly_token_limit
						? Number(row.monthly_token_limit)
						: null,
					maxComputeHoursMonth: row.max_compute_hours_month,
					maxStorageBytes: Number(row.max_storage_bytes),
					maxConcurrentSessions: row.max_concurrent_sessions,
				},
				features: {
					voiceEnabled: row.voice_enabled,
					videoEnabled: row.video_enabled,
					customModelsEnabled: row.custom_models_enabled,
					apiAccessEnabled: row.api_access_enabled,
				},
				apiRateLimit: row.api_rate_limit,
			})),
		});
	});

	// POST /billing/subscription - Update subscription (upgrade/downgrade)
	app.post(
		"/subscription",
		zValidator("json", updateSubscriptionSchema),
		async (c) => {
			const user = c.get("user");
			const { tier } = c.req.valid("json");

			// Get current subscription
			const currentResult = await db.query<SubscriptionRow>(
				"SELECT * FROM subscriptions WHERE user_id = $1",
				[user.sub]
			);

			if (currentResult.rows.length === 0) {
				return c.json({ error: "No subscription found" }, 404);
			}

			const currentSubscription = currentResult.rows[0]!;

			if (currentSubscription.tier === tier) {
				return c.json({ error: "Already on this plan" }, 400);
			}

			// For paid tiers, we would integrate with Stripe here
			// For now, just update the tier directly

			if (tier !== "free" && !currentSubscription.stripe_customer_id) {
				return c.json(
					{
						error: "Payment method required",
						message: "Please set up a payment method before upgrading",
						action: "setup_payment",
					},
					402
				);
			}

			// Update subscription
			await db.query(
				`UPDATE subscriptions
				 SET tier = $1, updated_at = NOW()
				 WHERE user_id = $2`,
				[tier, user.sub]
			);

			return c.json({
				message: `Subscription updated to ${tier}`,
				tier,
			});
		}
	);

	// POST /billing/cancel - Cancel subscription
	app.post("/cancel", async (c) => {
		const user = c.get("user");

		const result = await db.query<SubscriptionRow>(
			"SELECT * FROM subscriptions WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No subscription found" }, 404);
		}

		const subscription = result.rows[0]!;

		if (subscription.tier === "free") {
			return c.json({ error: "Cannot cancel free tier" }, 400);
		}

		// Mark as canceling at period end
		await db.query(
			`UPDATE subscriptions
			 SET cancel_at_period_end = TRUE, updated_at = NOW()
			 WHERE user_id = $1`,
			[user.sub]
		);

		// TODO: Cancel in Stripe

		return c.json({
			message: "Subscription will be canceled at the end of the billing period",
			cancelAt: subscription.current_period_end,
		});
	});

	// POST /billing/reactivate - Reactivate a canceled subscription
	app.post("/reactivate", async (c) => {
		const user = c.get("user");

		const result = await db.query<SubscriptionRow>(
			"SELECT * FROM subscriptions WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No subscription found" }, 404);
		}

		const subscription = result.rows[0]!;

		if (!subscription.cancel_at_period_end) {
			return c.json({ error: "Subscription is not scheduled for cancellation" }, 400);
		}

		// Remove cancellation
		await db.query(
			`UPDATE subscriptions
			 SET cancel_at_period_end = FALSE, updated_at = NOW()
			 WHERE user_id = $1`,
			[user.sub]
		);

		// TODO: Reactivate in Stripe

		return c.json({
			message: "Subscription reactivated",
		});
	});

	// GET /billing/invoices - Get invoice history
	app.get("/invoices", async (c) => {
		// This would integrate with Stripe to fetch invoice history
		return c.json({
			message: "Invoice history not yet implemented",
			invoices: [],
		});
	});

	// POST /billing/setup-intent - Create a Stripe SetupIntent for adding payment method
	app.post("/setup-intent", async (c) => {
		// This would create a Stripe SetupIntent
		return c.json({
			message: "Payment setup not yet implemented",
		});
	});

	return app;
}
