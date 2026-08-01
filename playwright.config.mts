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
// This has to happen at config load rather than in globalSetup, because
// Playwright starts `webServer` before globalSetup and does not pass along
// environment variables it sets.
const container = await new GenericContainer(
  "ghcr.io/tursodatabase/libsql-server:v0.24.32",
)
  .withExposedPorts(8080)
  .start();

const DATABASE_URL = `http://${container.getHost()}:${container.getMappedPort(8080)}`;

await migrateToLatest(DATABASE_URL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `pnpm start --port ${APP_PORT}`,
    url: `http://127.0.0.1:${APP_PORT}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL },
  },
});
