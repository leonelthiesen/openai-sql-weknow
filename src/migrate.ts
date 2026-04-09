import "dotenv/config";
import path from "node:path";
import { runMigrations, sql } from "./db";

async function main(): Promise<void> {
  const migrationsDir = path.join(__dirname, "migrations");

  await runMigrations(migrationsDir);
  console.log("Migracoes executadas com sucesso.");
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao executar migracoes:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
