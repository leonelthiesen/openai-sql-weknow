import { mkdir, readdir, copyFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("src", "migrations");
const targetDir = path.resolve("dist", "migrations");

async function copyMigrations() {
  await mkdir(targetDir, { recursive: true });

  const files = await readdir(sourceDir);
  const sqlFiles = files.filter((fileName) => fileName.endsWith(".sql"));

  await Promise.all(
    sqlFiles.map((fileName) =>
      copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName))
    )
  );

  console.log(`Copiados ${sqlFiles.length} arquivos de migration para ${targetDir}`);
}

copyMigrations().catch((error) => {
  console.error("Falha ao copiar migrations:", error);
  process.exitCode = 1;
});
