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

| Change                                 | Order                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| Additive (new table/column, new index) | migrate **first**, then deploy                             |
| Destructive (drop/rename a column)     | deploy code that no longer uses it **first**, then migrate |

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
pnpm lint          # oxlint + a narrow ESLint pass
pnpm format        # oxfmt (write)
pnpm format:check  # oxfmt (check only)
pnpm test:unit  # migration + link-creation tests (node --test)
pnpm test:e2e   # end-to-end (Playwright)
```

Linting is [oxlint](https://oxc.rs/docs/guide/usage/linter.html), configured in
`.oxlintrc.json`. It runs with `--max-warnings=0`, so warnings fail rather than scroll past.

Enabling a plugin only makes its rules _available_ — oxlint still activates just its
`correctness` category. Rules that `eslint-config-next` enabled but oxlint ranks lower are
switched on explicitly in `rules`; without that, a conditionally-called hook lints clean.

`pnpm lint` runs oxlint and then a **narrow ESLint pass**. oxlint 1.76 does not implement the
React Compiler-era rules from `eslint-plugin-react-hooks@7` — `set-state-in-render`,
`set-state-in-effect`, `immutability`, `purity`, `refs`, `static-components`, `use-memo` — and
they cannot be recovered by configuration, so `eslint.config.mjs` enables just that plugin.

It deliberately does not use `eslint-config-next`: that pulls `eslint-plugin-react`, which has
no ESLint 10 support and would pin the project to ESLint 9. Even with the extra pass the
dependency tree is far smaller — roughly 773 packages against 1353 before.

The e2e suite starts a throwaway [libsql-server](https://github.com/tursodatabase/libsql)
container via testcontainers, migrates it, and runs the app against it, so **Docker must be
running**. A container is used rather than a SQLite file because every route sets
`runtime = "edge"`, where `@libsql/client` is the web build and cannot open local files.

There are two groups:

- **`tests/auth.spec.ts`** — that Clerk is _enforced_: the home page redirects to sign-in,
  `POST /api/create` answers 401, the sign-in page renders. No session is created.
- **`tests/product.spec.ts`** — the shortener itself, with Clerk out of the picture. Links are
  seeded straight into the database and fetched through `/[slug]`, which is a route handler
  and so never renders the ClerkProvider layout.

The product specs need **no Clerk configuration at all** — Playwright waits on `/api/health`,
a route handler outside the proxy matcher, so the server starts without a publishable key. Run
them anywhere, including forked PRs. The auth specs skip when
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent, since pages render through `ClerkProvider` and
cannot load without it. That key is public — it ships in the browser bundle.

The auth specs need **both** Clerk keys — `clerkMiddleware` and `auth.protect` throw
`MissingSecretKey` without `CLERK_SECRET_KEY`. That key is an instance admin credential which
can mint a session for any user, so it is deliberately kept out of CI; the auth specs skip
there and run locally, where `.env.local` supplies both.

Slugs are suffixed with a per-run id: `/[slug]` caches lookups with `unstable_cache`, that
cache lives in `.next/cache` and survives between runs, so a slug requested in an earlier run
would keep serving its cached 404.
