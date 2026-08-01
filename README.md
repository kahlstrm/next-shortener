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
`db_migration/migrations`, applied with:

```shell
DATABASE_URL=<url> pnpm db:migrate
```

Migrations run in order and are recorded in a `kysely_migration` table, so re-running
is a no-op. `pnpm kysely-generate` migrates a local `local.db` and regenerates
`types/db.d.ts` from it.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
