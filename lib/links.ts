import type { Kysely } from "kysely";
import ShortUniqueId from "short-unique-id";

import type { DB } from "../types/db";

/** Attempts per shorthand length before trying a longer one. */
const ATTEMPTS_PER_LENGTH = 5;
const FIRST_LENGTH = 4;
const MAX_LENGTH = 10;

export type CreateLinkResult =
  | { ok: true; shorthand: string }
  | { ok: false; reason: "shorthand-taken" };

/** Injectable so tests can force collisions instead of relying on chance. */
export type ShorthandGenerator = (length: number) => string;

const randomShorthand: ShorthandGenerator = (length) => new ShortUniqueId({ length }).randomUUID();

async function insert(db: Kysely<DB>, values: { user_id: string; url: string; shorthand: string }) {
  await db.insertInto("shortened_links").values(values).executeTakeFirstOrThrow();
}

/**
 * Creates a short link, either at a caller-supplied shorthand or a generated
 * one. Generated shorthands start at {@link FIRST_LENGTH} characters and grow
 * when they keep colliding.
 *
 * Deliberately knows nothing about authentication: the caller supplies userId,
 * which keeps this testable without Clerk.
 */
export async function createShortLink(
  db: Kysely<DB>,
  { userId, url, shorthand }: { userId: string; url: string; shorthand?: string },
  generate: ShorthandGenerator = randomShorthand,
): Promise<CreateLinkResult> {
  if (shorthand) {
    try {
      await insert(db, { user_id: userId, url, shorthand });
    } catch {
      return { ok: false, reason: "shorthand-taken" };
    }
    return { ok: true, shorthand };
  }

  for (let length = FIRST_LENGTH; length <= MAX_LENGTH; length++) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LENGTH; attempt++) {
      const candidate = generate(length);
      try {
        await insert(db, { user_id: userId, url, shorthand: candidate });
        return { ok: true, shorthand: candidate };
      } catch {
        // Assume a collision and try again. Bounded, unlike the previous
        // `while (!inserted)` loop, which spun forever when inserts failed for
        // any other reason — a database outage, say.
      }
    }
  }

  throw new Error(`could not allocate a unique shorthand up to ${MAX_LENGTH} characters`);
}
