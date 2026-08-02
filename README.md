Basic URL-shortener, trying out the new App Router & RSC Next.JS along with some random other tools ([Kysely](https://kysely.dev/), [Turso](https://turso.tech/) etc.)

## Development

You need to setup [Clerk](https://clerk.com/) for auth and [Turso](https://turso.tech/) for DB connection.

```shell
cp .env.example .env.local
pnpm install
pnpm dev
```

## Database

Schema changes are [Kysely migrations](https://kysely.dev/docs/migrations) in
`db_migration/migrations`. They run in order and are recorded in a `kysely_migration`
table, so re-running applies only what is pending.

```shell
DATABASE_URL=<url> pnpm db:status    # read-only: what is applied, what is pending
DATABASE_URL=<url> pnpm db:migrate   # apply everything pending
```

### ⚠️ Migrations are never applied automatically

Nothing runs them for you — not the Vercel build, not CI, not the app at startup.
`next build` only builds. **A schema change reaches production only when a human runs
`pnpm db:migrate` against the production database.**

That means a deploy can ship code expecting a column that does not exist yet. The order
matters:

| Change | Order |
| --- | --- |
| Additive (new table/column, new index) | migrate **first**, then deploy |
| Destructive (drop/rename a column) | deploy code that no longer uses it **first**, then migrate |

### Applying to production

Get the Turso URL (the same `DATABASE_URL` the Vercel project uses), then:

```shell
DATABASE_URL='libsql://<db>.turso.io?authToken=<token>' pnpm db:status
DATABASE_URL='libsql://<db>.turso.io?authToken=<token>' pnpm db:migrate
```

Always run `db:status` first — it connects and reports without changing anything, which
also confirms you are pointed at the database you think you are.

> The production database predates this migration setup and has no `kysely_migration`
> table yet. `0001_initial` is written entirely with `ifNotExists`, so the first
> production run records it as applied **without touching the existing table or data**.
> It is a bookkeeping no-op, and it needs to happen before any later migration can run.

### Local database and types

`pnpm kysely-generate` migrates a local `local.db` and regenerates `types/db.d.ts` from
it. Run it after adding a migration so the generated types match.

Migration behaviour is covered by `pnpm test:unit`, which runs in CI against throwaway
SQLite files — no database required.

## Tests

```shell
pnpm test:unit  # migration + link-creation tests (node --test)
pnpm test:e2e   # end-to-end (Playwright)
```

The e2e suite starts a throwaway [libsql-server](https://github.com/tursodatabase/libsql)
container via testcontainers, migrates it, and runs the app against it, so **Docker must be
running**. A container is used rather than a SQLite file because every route sets
`runtime = "edge"`, where `@libsql/client` is the web build and cannot open local files.

There are two groups:

- **`tests/auth.spec.ts`** — that Clerk is *enforced*: the home page redirects to sign-in,
  `POST /api/create` answers 401, the sign-in page renders. No session is created.
- **`tests/product.spec.ts`** — the shortener itself, with Clerk out of the picture. Links are
  seeded straight into the database and fetched through `/[slug]`, which is a route handler
  and so never renders the ClerkProvider layout.

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is required, because pages render through `ClerkProvider`
and the app cannot serve any page without it. That key is public — it ships in the browser
bundle. **`CLERK_SECRET_KEY` is not used by the suite**; it is an instance admin credential
that can mint a session for any user, and is deliberately kept out of CI.

Slugs are suffixed with a per-run id: `/[slug]` caches lookups with `unstable_cache`, that
cache lives in `.next/cache` and survives between runs, so a slug requested in an earlier run
would keep serving its cached 404.
