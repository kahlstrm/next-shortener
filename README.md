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

Migration behaviour is covered by `pnpm test:db`, which runs in CI against throwaway
SQLite files — no database required.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
