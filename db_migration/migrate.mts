import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";

const migrationFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

/** Applies every pending migration. Safe to run repeatedly. */
export async function migrateToLatest(databaseUrl: string) {
  const db = new Kysely<unknown>({
    dialect: new LibsqlDialect({ url: databaseUrl }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    const outcome = result.status === "Success" ? "applied" : result.status;
    console.log(`${outcome}: ${result.migrationName}`);
  }

  await db.destroy();

  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }

  return results ?? [];
}

// Only run when invoked directly, so tests can import migrateToLatest instead.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  migrateToLatest(databaseUrl).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
