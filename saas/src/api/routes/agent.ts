import { Hono } from "hono";
import { authMiddleware } from "../../auth/middleware.js";
import type { DbClient, TenantRow } from "../../db/client.js";

export function createAgentRoutes(db: DbClient): Hono {
	const app = new Hono();

	// All agent routes require authentication
	app.use("*", authMiddleware);

	// GET /agent/status - Get tenant agent status
	app.get("/status", async (c) => {
		const user = c.get("user");

		const result = await db.query<TenantRow>(
			`SELECT * FROM tenants WHERE user_id = $1`,
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({
				status: "not_provisioned",
				message: "No agent instance found. Please provision one.",
			});
		}

		const tenant = result.rows[0]!;

		return c.json({
			status: tenant.status,
			namespace: tenant.namespace,
			resources: {
				cpu: tenant.cpu_limit,
				memory: tenant.memory_limit,
				storage: tenant.storage_limit,
			},
			lastActivityAt: tenant.last_activity_at,
			scaledDownAt: tenant.scaled_down_at,
			createdAt: tenant.created_at,
		});
	});

	// POST /agent/provision - Provision a new agent instance
	app.post("/provision", async (c) => {
		const user = c.get("user");

		// Check if tenant already exists
		const existingResult = await db.query<TenantRow>(
			"SELECT id, status FROM tenants WHERE user_id = $1",
			[user.sub]
		);

		if (existingResult.rows.length > 0) {
			const existing = existingResult.rows[0]!;
			if (existing.status !== "terminated") {
				return c.json(
					{ error: "Agent instance already exists" },
					400
				);
			}
		}

		// Generate namespace name
		const namespace = `tenant-${user.sub.slice(0, 8)}`;

		// Create tenant record
		const insertResult = await db.query<TenantRow>(
			`INSERT INTO tenants (user_id, namespace, status)
			 VALUES ($1, $2, 'provisioning')
			 ON CONFLICT (user_id) DO UPDATE SET
			   status = 'provisioning',
			   namespace = $2,
			   updated_at = NOW()
			 RETURNING *`,
			[user.sub, namespace]
		);

		const tenant = insertResult.rows[0]!;

		// TODO: Trigger Kubernetes provisioning via orchestrator
		// This would be done via a message queue or direct API call

		return c.json(
			{
				message: "Agent provisioning started",
				tenantId: tenant.id,
				namespace: tenant.namespace,
				status: tenant.status,
			},
			202
		);
	});

	// POST /agent/wake - Wake up a scaled-down agent
	app.post("/wake", async (c) => {
		const user = c.get("user");

		const result = await db.query<TenantRow>(
			"SELECT * FROM tenants WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No agent instance found" }, 404);
		}

		const tenant = result.rows[0]!;

		if (tenant.status === "active" && !tenant.scaled_down_at) {
			return c.json({ message: "Agent is already running" });
		}

		if (tenant.status === "terminated") {
			return c.json(
				{ error: "Agent has been terminated. Please provision a new one." },
				400
			);
		}

		// Update status and clear scaled_down_at
		await db.query(
			`UPDATE tenants
			 SET scaled_down_at = NULL,
			     last_activity_at = NOW()
			 WHERE id = $1`,
			[tenant.id]
		);

		// TODO: Trigger Kubernetes wake-up via orchestrator

		return c.json({
			message: "Agent wake-up initiated",
			status: "waking",
		});
	});

	// POST /agent/restart - Restart the agent
	app.post("/restart", async (c) => {
		const user = c.get("user");

		const result = await db.query<TenantRow>(
			"SELECT * FROM tenants WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No agent instance found" }, 404);
		}

		const tenant = result.rows[0]!;

		if (tenant.status !== "active") {
			return c.json(
				{ error: `Cannot restart agent in ${tenant.status} state` },
				400
			);
		}

		// TODO: Trigger Kubernetes pod restart via orchestrator

		return c.json({
			message: "Agent restart initiated",
		});
	});

	// DELETE /agent - Terminate the agent instance
	app.delete("/", async (c) => {
		const user = c.get("user");

		const result = await db.query<TenantRow>(
			"SELECT * FROM tenants WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No agent instance found" }, 404);
		}

		const tenant = result.rows[0]!;

		// Update status to terminated
		await db.query(
			`UPDATE tenants SET status = 'terminated' WHERE id = $1`,
			[tenant.id]
		);

		// TODO: Trigger Kubernetes cleanup via orchestrator

		return c.json({
			message: "Agent termination initiated",
		});
	});

	// GET /agent/logs - Get recent agent logs
	app.get("/logs", async (c) => {
		const user = c.get("user");
		const lines = parseInt(c.req.query("lines") ?? "100", 10);

		const result = await db.query<TenantRow>(
			"SELECT * FROM tenants WHERE user_id = $1",
			[user.sub]
		);

		if (result.rows.length === 0) {
			return c.json({ error: "No agent instance found" }, 404);
		}

		const tenant = result.rows[0]!;

		if (tenant.status !== "active") {
			return c.json(
				{ error: "Agent is not running" },
				400
			);
		}

		// TODO: Fetch logs from Kubernetes via orchestrator

		return c.json({
			logs: [],
			message: "Log retrieval not yet implemented",
		});
	});

	return app;
}
