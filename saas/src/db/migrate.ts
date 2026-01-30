import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDbClient } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
	console.log("Starting database migration...");

	const db = createDbClient();

	try {
		// Read the schema file
		const schemaPath = path.join(__dirname, "schema.sql");
		const schema = fs.readFileSync(schemaPath, "utf-8");

		// Execute the schema
		console.log("Executing schema...");
		await db.query(schema);

		console.log("Migration completed successfully!");
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	} finally {
		await db.end();
	}
}

migrate();
