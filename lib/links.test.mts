import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, describe, test } from "node:test";

import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

import { migrateToLatest } from "../db_migration/migrate.mts";
import { createShortLink } from "./links.ts";
import type { DB } from "../types/db";

// Plain Node, so a file-backed database is fine here — no container needed.
// The app itself cannot do this because its routes run on the edge runtime.
const dirs: string[] = [];
let db: Kysely<DB>;

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "shortener-links-"));
  dirs.push(dir);
  const url = `file:${path.join(dir, "test.db")}`;
  await migrateToLatest(url);
  db = new Kysely<DB>({ dialect: new LibsqlDialect({ url }) });
});

after(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("createShortLink", () => {
  test("stores a link at a caller-supplied shorthand", async () => {
    const result = await createShortLink(db, {
      userId: "user_1",
      url: "https://example.com",
      shorthand: "mine",
    });

    assert.deepEqual(result, { ok: true, shorthand: "mine" });

    const row = await db
      .selectFrom("shortened_links")
      .select(["url", "user_id"])
      .where("shorthand", "=", "mine")
      .executeTakeFirst();
    assert.deepEqual(row, { url: "https://example.com", user_id: "user_1" });
  });

  test("reports a taken shorthand instead of throwing", async () => {
    const base = { userId: "user_1", url: "https://example.com" };
    await createShortLink(db, { ...base, shorthand: "dup" });

    const second = await createShortLink(db, { ...base, shorthand: "dup" });
    assert.deepEqual(second, { ok: false, reason: "shorthand-taken" });
  });

  test("generates a shorthand when none is given", async () => {
    const result = await createShortLink(db, {
      userId: "user_1",
      url: "https://example.com",
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.shorthand.length, 4, "should start at the shortest length");
  });

  // The loop this replaced incremented its counter twice on failure, so it
  // retried far fewer times than intended.
  test("retries past a collision", async () => {
    await createShortLink(db, {
      userId: "user_1",
      url: "https://example.com",
      shorthand: "taken",
    });

    const candidates = ["taken", "taken", "free"];
    let i = 0;
    const result = await createShortLink(
      db,
      { userId: "user_1", url: "https://example.com/next" },
      () => candidates[i++]!,
    );

    assert.deepEqual(result, { ok: true, shorthand: "free" });
    assert.equal(i, 3, "should have consumed both collisions before succeeding");
  });

  // The previous `while (!inserted)` loop was unbounded: any persistent insert
  // failure — a database outage, not just a collision — span forever.
  test("gives up rather than looping forever", async () => {
    await createShortLink(db, {
      userId: "user_1",
      url: "https://example.com",
      shorthand: "always",
    });

    await assert.rejects(
      createShortLink(db, { userId: "user_1", url: "https://example.com/x" }, () => "always"),
      /could not allocate a unique shorthand/,
    );
  });
});
