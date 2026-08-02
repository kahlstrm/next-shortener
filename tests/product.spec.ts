import { randomBytes } from "node:crypto";

import { LibsqlDialect } from "@libsql/kysely-libsql";
import { expect, test } from "@playwright/test";
import { Kysely, sql } from "kysely";

/**
 * The shortener itself, with Clerk deliberately out of the picture.
 *
 * `/[slug]` is a route handler, so it never renders the ClerkProvider layout,
 * and it is not in the proxy matcher — so it needs no Clerk configuration at
 * all. Verified: with every Clerk key unset, an unknown slug still 404s.
 *
 * That means these run anywhere, including forked PRs that get no secrets.
 * Links are seeded straight into the database rather than created through the
 * authenticated API, which is what keeps auth out of the picture.
 */
const databaseUrl = process.env.E2E_DATABASE_URL!;

// The route caches lookups with `unstable_cache`, and that cache lives in
// .next/cache, which survives between runs. A slug requested in an earlier run
// keeps serving its cached 404 for an hour, so every run needs fresh slugs.
const runId = randomBytes(4).toString("hex");
const slug = (name: string) => `${name}-${runId}`;

function db() {
  return new Kysely<never>({ dialect: new LibsqlDialect({ url: databaseUrl }) });
}

async function seedLink(shorthand: string, url: string) {
  const conn = db();
  try {
    await sql`insert into shortened_links (url, shorthand, user_id)
              values (${url}, ${shorthand}, 'seeded-by-e2e')`.execute(conn);
  } finally {
    await conn.destroy();
  }
}

test.describe("shortener", () => {
  test("redirects a known short link to its target", async ({ request }) => {
    const target = "https://example.com/a-real-target";
    const shorthand = slug("known");
    await seedLink(shorthand, target);

    const response = await request.get(`/${shorthand}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe(target);
  });

  test("404s an unknown short link", async ({ request }) => {
    const response = await request.get(`/${slug("no-such-link")}`, {
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(404);
  });

  test("keeps links distinct", async ({ request }) => {
    const first = slug("first");
    const second = slug("second");
    await seedLink(first, "https://example.com/one");
    await seedLink(second, "https://example.com/two");

    const one = await request.get(`/${first}`, { maxRedirects: 0 });
    const two = await request.get(`/${second}`, { maxRedirects: 0 });

    expect(one.headers()["location"]).toBe("https://example.com/one");
    expect(two.headers()["location"]).toBe("https://example.com/two");
  });

  // Someone hitting a link before it exists must not poison it. `/[slug]`
  // caches through `unstable_cache` with revalidate: 3600, so a cached miss
  // would otherwise keep 404ing for an hour after the link was created.
  test("serves a link created after someone already tried the slug", async ({ request }) => {
    const shorthand = slug("tried-early");

    const before = await request.get(`/${shorthand}`, {
      failOnStatusCode: false,
    });
    expect(before.status()).toBe(404);

    await seedLink(shorthand, "https://example.com/created-later");

    const after = await request.get(`/${shorthand}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(after.status()).toBe(302);
    expect(after.headers()["location"]).toBe("https://example.com/created-later");
  });

  test("treats shorthands as case-sensitive", async ({ request }) => {
    const shorthand = slug("CaseSensitive");
    await seedLink(shorthand, "https://example.com/exact");

    const exact = await request.get(`/${shorthand}`, { maxRedirects: 0 });
    expect(exact.status()).toBe(302);

    const wrongCase = await request.get(`/${shorthand.toLowerCase()}`, {
      failOnStatusCode: false,
    });
    expect(wrongCase.status()).toBe(404);
  });
});
