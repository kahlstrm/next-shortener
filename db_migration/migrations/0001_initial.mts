import type { Kysely} from "kysely";
import { sql } from "kysely";

/**
 * Reproduces the schema Atlas previously applied from schema.hcl.
 *
 * Everything is `ifNotExists` on purpose: the production Turso database and any
 * existing local.db already have this table, and they predate the migration
 * table. Running this against them records the migration without touching data.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("shortened_links")
    .ifNotExists()
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("shorthand", "text", (col) => col.notNull().primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("last_modified", sql`datetime`, (col) =>
      col.notNull().defaultTo(sql`current_timestamp`),
    )
    .execute();

  await db.schema
    .createIndex("idx_name")
    .ifNotExists()
    .on("shortened_links")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_name").ifExists().execute();
  await db.schema.dropTable("shortened_links").ifExists().execute();
}
