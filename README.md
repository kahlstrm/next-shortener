A URL shortener, and a place to try out App Router / RSC Next.js with
[Kysely](https://kysely.dev/), [Turso](https://turso.tech/) and [Clerk](https://clerk.com/).

Deployed at [l.kalski.xyz](https://l.kalski.xyz).

## Getting started

Toolchain versions are pinned in `mise.toml` ([mise](https://mise.jdx.dev)):

```shell
mise install                # Node + pnpm
cp .env.example .env.local  # then fill it in, see below
pnpm install
pnpm dev
```

You need a [Clerk](https://clerk.com/) application for auth and a
[Turso](https://turso.tech/) database.

### Environment

| Variable                                               | Notes                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `DATABASE_URL`                                         | `libsql://…turso.io?authToken=…`                                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                    | public; the app cannot render a page without it                    |
| `CLERK_SECRET_KEY`                                     | **instance admin credential** — see [Checks](#checks)              |
| `NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_URL`                   | `/sign-in`, `/sign-up`                                             |
| `NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_FALLBACK_REDIRECT_URL` | `/` — note the name: `AFTER_SIGN_IN_URL` etc. are silently ignored |

## Architecture

**Every route runs on the edge runtime.** That is the constraint behind most of the
decisions here: on edge, `@libsql/client` resolves to its web build, which speaks HTTP to a
libsql server and cannot open a local SQLite file. So there is no "just use a file locally"
option — see [Tests](#tests).

Auth is Clerk middleware, in `proxy.ts`:

| Path                   | Behaviour                                                              |
| ---------------------- | ---------------------------------------------------------------------- |
| `/`                    | **protected** — `auth.protect()` redirects to sign-in                  |
| `/api/create`          | middleware runs; the handler checks `auth()` itself and answers 401    |
| `/sign-in`, `/sign-up` | middleware runs so Clerk's handshake can complete                      |
| `/[slug]`              | **public** — a route handler, outside the matcher, never touches Clerk |
| `/api/health`          | **public** — liveness, no Clerk                                        |

`clerkMiddleware()` protects nothing on its own — the protected set above is what does it.
Removing that call makes `/` public with no error anywhere.

`/[slug]` caches lookups with `unstable_cache`, but never trusts a cached miss — a link
created after someone first tried the slug would otherwise keep 404ing for an hour.

## Database

Schema changes are [Kysely migrations](https://kysely.dev/docs/migrations) in
`db_migration/migrations`. They run in order and are recorded in a `kysely_migration` table,
so re-running applies only what is pending.

```shell
DATABASE_URL=<url> pnpm db:status    # read-only: applied vs pending
DATABASE_URL=<url> pnpm db:migrate   # apply everything pending
```

`pnpm kysely-generate` migrates a local `local.db` and regenerates `types/db.d.ts` from it.
Run it after adding a migration so the generated types match.

### ⚠️ Migrations are never applied automatically

Nothing runs them for you — not the Vercel build, not CI, not the app at startup. **A schema
change reaches production only when a human runs `pnpm db:migrate` against it.**

So a deploy can ship code expecting a column that does not exist. Order matters:

| Change                             | Order                                                     |
| ---------------------------------- | --------------------------------------------------------- |
| Additive (new table/column/index)  | migrate **first**, then deploy                            |
| Destructive (drop/rename a column) | deploy code that stopped using it **first**, then migrate |

Run `db:status` before `db:migrate` — it connects and reports without changing anything,
which also confirms you are pointed at the database you think you are.

## Checks

```shell
pnpm lint          # oxlint
pnpm format        # oxfmt, write
pnpm format:check  # oxfmt, check only
pnpm test:unit     # node --test
pnpm test:e2e      # Playwright
```

CI runs `lint`, `format:check`, `test:unit`, `test:e2e` and the build on every push and pull
request.

### Linting

[oxlint](https://oxc.rs/docs/guide/usage/linter.html), configured in `.oxlintrc.json`, with
`--max-warnings=0` so warnings fail rather than scroll past.

Enabling a plugin only makes its rules _available_ — oxlint activates just its `correctness`
category. Anything below that is switched on explicitly under `rules`; without that, a
conditionally-called hook lints clean.

**Not checked.** `rules-of-hooks` and `exhaustive-deps` are enforced, but the React
Compiler-era rules are not — oxlint does not implement them. Calling `setState` during render
or in an effect, mutating props, or reading a ref during render will all lint clean.

### Tests

`pnpm test:unit` covers migrations, link creation, the zod schema and the react-hook-form
resolver. Plain Node, file-backed SQLite, no browser.

`pnpm test:e2e` starts a throwaway [libsql-server](https://github.com/tursodatabase/libsql)
container via testcontainers, migrates it and runs the app against it — so **Docker must be
running**. Two groups:

- **`tests/auth.spec.ts`** — that Clerk is _enforced_: `/` redirects to sign-in,
  `POST /api/create` answers 401, the sign-in page renders. Needs **both** Clerk keys, since
  `auth.protect` throws `MissingSecretKey` without the secret one.
- **`tests/product.spec.ts`** — the shortener itself, needing **no Clerk configuration at
  all**. Links are seeded straight into the database and fetched through `/[slug]`; Playwright
  waits on `/api/health` so the server starts without a publishable key.

`CLERK_SECRET_KEY` can mint a session for any user in the instance, so it is deliberately
**not** in CI. The auth specs skip there and run locally. That is why CI reports
`5 passed, 4 skipped`.

## Deployment

Vercel, on push. `next build` only builds — it does not migrate.

### ⚠️ `ENABLE_EXPERIMENTAL_COREPACK=1` is required

Set on Production and Preview. **Do not remove it.**

Vercel [supports pnpm 6–10 natively](https://vercel.com/docs/package-managers) and infers the
version from `lockfileVersion`, which pnpm 11 leaves at `9.0`. Without corepack, Vercel picks
pnpm 9, which rejects a `pnpm-workspace.yaml` that has no `packages:` field — and this one
intentionally has only `allowBuilds` and `overrides`. The build fails with
`ERROR packages field missing or empty`. With the variable set, Vercel reads `packageManager`
from `package.json` instead.

## Gotchas

- **`@types/node` is pinned to the 24.x line** to match the Node version in `mise.toml`.
  Tooling keeps offering newer majors; they describe APIs that do not exist in Node 24, so
  code would type-check and then fail at runtime. Bump it only alongside the runtime.
- **`pnpm-workspace.yaml` carries real configuration** — `allowBuilds` (pnpm 11 blocks
  dependency build scripts by default) and an `overrides` entry deduping `postcss`, which Next
  pins to a version carrying advisories.
