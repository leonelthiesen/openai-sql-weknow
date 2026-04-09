import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export const sql = postgres({
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});

export async function checkDatabaseConnection(): Promise<void> {
	await sql`select 1`;
}

export async function runMigrations(migrationsDir: string): Promise<void> {
	await sql`create table if not exists schema_migrations (
		version text primary key,
		applied_at timestamptz not null default now()
	)`;

	const migrationFiles = (await readdir(migrationsDir))
		.filter((fileName) => fileName.endsWith(".sql"))
		.sort();

	for (const fileName of migrationFiles) {
		const existing = await sql<{ version: string }[]>`
			select version
			from schema_migrations
			where version = ${fileName}
		`;

		if (existing.length > 0) {
			continue;
		}

		const migrationPath = path.join(migrationsDir, fileName);
		const migrationSql = await readFile(migrationPath, "utf8");

		await sql.begin(async (transaction) => {
			const tx = transaction as unknown as typeof sql;
			await tx.unsafe(migrationSql);
			await tx`
				insert into schema_migrations (version)
				values (${fileName})
			`;
		});
	}
}
