import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";
import { GenericContainer } from "testcontainers";

import { migrateToLatest } from "./db_migration/migrate.mts";

// Local convenience: pick up Clerk credentials the same way `next` does. CI
// provides them as real environment variables instead.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const APP_PORT = Number(process.env.E2E_APP_PORT) || 3100;

// The app's routes all run on the edge runtime, where @libsql/client is the web
// build: it speaks HTTP to a libsql server and cannot open a SQLite file. So the
// tests run against a real libsql server in a throwaway container.
//
// This happens at config load rather than in a globalSetup, because Playwright
// starts `webServer` first and does not pass along env vars a globalSetup sets.
// Playwright re-loads this config in every worker process, so without this
// guard each worker would start its own container: the app would talk to one
// database while the specs seeded another. Workers inherit the runner's
// environment, so they reuse the URL rather than starting anything.
async function startDatabase() {
  const container = await new GenericContainer(
    "ghcr.io/tursodatabase/libsql-server:v0.24.32",
  )
    .withExposedPorts(8080)
    .start();

  const url = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
  await migrateToLatest(url);
  return url;
}

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? (await startDatabase());

// The product specs seed links directly, bypassing the authenticated API.
process.env.E2E_DATABASE_URL = DATABASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `pnpm start --port ${APP_PORT}`,
    // /api/health is a route handler outside the proxy matcher, so it answers
    // without Clerk configured. Probing a page instead would make the whole
    // suite — including the Clerk-free product specs — need a publishable key.
    url: `http://127.0.0.1:${APP_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL },
  },
});
