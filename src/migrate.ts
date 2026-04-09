import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations, sql } from "./db";

async function main(): Promise<void> {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirPath = path.dirname(currentFilePath);
  const migrationsDir = path.join(currentDirPath, "migrations");

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
