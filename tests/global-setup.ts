import { clerkSetup } from "@clerk/testing/playwright";

const CLERK_API = "https://api.clerk.com/v1";

/**
 * `+clerk_test` addresses are Clerk's documented test identities: they never
 * send real email and are safe to create on a development instance.
 */
export const TEST_USER_EMAIL =
  process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

async function clerkApi(path: string, init?: RequestInit) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Clerk ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Creates the test user if it is missing, so CI needs no manual setup. */
async function ensureTestUser() {
  const existing = await clerkApi(
    `/users?email_address=${encodeURIComponent(TEST_USER_EMAIL)}`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return;
  }
  await clerkApi("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [TEST_USER_EMAIL],
      skip_password_requirement: true,
    }),
  });
  console.log(`created Clerk test user ${TEST_USER_EMAIL}`);
}

/**
 * Clerk's testing token lets the authenticated specs bypass bot detection.
 * Without CLERK_SECRET_KEY those specs skip, so the public suite still runs
 * anywhere — including forked PRs, which get no secrets.
 */
export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.log(
      "CLERK_SECRET_KEY not set — authenticated specs will be skipped",
    );
    return;
  }
  await clerkSetup();

  // Provisioning fails when the Clerk instance has no email identifier enabled
  // (a Google-OAuth-only instance rejects `email_address`). That should skip the
  // authenticated specs, not take the whole suite down with it.
  try {
    await ensureTestUser();
    process.env.E2E_CLERK_USER_READY = "true";
  } catch (error) {
    console.log(
      `could not provision ${TEST_USER_EMAIL} — authenticated specs will be skipped\n  ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
