import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";

import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely, sql } from "kysely";

import { migrateToLatest } from "./migrate.mts";

const tempDirs: string[] = [];

/** A fresh, empty database file that is cleaned up when the run finishes. */
async function tempDbUrl() {
  const dir = await mkdtemp(path.join(tmpdir(), "shortener-migrate-"));
  tempDirs.push(dir);
  return `file:${path.join(dir, "test.db")}`;
}

function connect(url: string) {
  return new Kysely<never>({ dialect: new LibsqlDialect({ url }) });
}

/** Structural description of the schema, independent of DDL formatting. */
async function describeSchema(url: string) {
  const db = connect(url);
  try {
    const columns = await sql<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>`pragma table_info("shortened_links")`.execute(db);

    const indexes = await sql<{
      name: string;
      unique: number;
      origin: string;
    }>`pragma index_list("shortened_links")`.execute(db);

    return {
      columns: columns.rows
        .map((c) => `${c.name}:${c.type}:notnull=${c.notnull}:pk=${c.pk}:default=${c.dflt_value ?? "-"}`)
        .sort(),
      indexes: indexes.rows
        .map((i) => `${i.name}:unique=${i.unique}:origin=${i.origin}`)
        .sort(),
    };
  } finally {
    await db.destroy();
  }
}

after(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("migrations", () => {
  test("create the expected schema on an empty database", async () => {
    const url = await tempDbUrl();
    await migrateToLatest(url);

    const schema = await describeSchema(url);

    assert.deepEqual(schema.columns, [
      "last_modified:datetime:notnull=1:pk=0:default=current_timestamp",
      "shorthand:TEXT:notnull=1:pk=1:default=-",
      "url:TEXT:notnull=1:pk=0:default=-",
      "user_id:TEXT:notnull=1:pk=0:default=-",
    ]);
    assert.deepEqual(schema.indexes, [
      "idx_name:unique=0:origin=c",
      "sqlite_autoindex_shortened_links_1:unique=1:origin=pk",
    ]);
  });

  test("are idempotent", async () => {
    const url = await tempDbUrl();

    const first = await migrateToLatest(url);
    assert.equal(first.length, 1, "first run should apply the initial migration");

    const second = await migrateToLatest(url);
    assert.equal(second.length, 0, "second run should apply nothing");
  });

  // The production database predates the migration table, so the first run there
  // must record the migration without disturbing existing rows.
  test("preserve data when baselining an existing database", async () => {
    const url = await tempDbUrl();
    const db = connect(url);
    await sql`create table shortened_links (
      url text not null,
      shorthand text not null primary key,
      user_id text not null,
      last_modified datetime not null default current_timestamp
    )`.execute(db);
    await sql`create index idx_name on shortened_links (user_id)`.execute(db);
    await sql`insert into shortened_links (url, shorthand, user_id)
              values ('https://example.com', 'keepme', 'user_1')`.execute(db);
    await db.destroy();

    await migrateToLatest(url);

    const after = connect(url);
    try {
      const rows = await sql<{
        shorthand: string;
        url: string;
      }>`select shorthand, url from shortened_links`.execute(after);
      assert.deepEqual(rows.rows, [
        { shorthand: "keepme", url: "https://example.com" },
      ]);
    } finally {
      await after.destroy();
    }
  });
});
