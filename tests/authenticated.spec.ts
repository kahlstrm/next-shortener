import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

/**
 * Signed-in behaviour. Needs CLERK_SECRET_KEY and a Clerk user to sign in as;
 * both are absent on forked PRs, so the suite skips rather than fails.
 *
 * E2E_CLERK_USER_EMAIL should be a Clerk test user — an address containing
 * `+clerk_test` never sends real email and is Clerk's documented pattern.
 */
import { TEST_USER_EMAIL } from "./global-setup";

test.describe("signed in", () => {
  // Set by global-setup once the Clerk test user exists.
  test.skip(
    process.env.E2E_CLERK_USER_READY !== "true",
    "requires CLERK_SECRET_KEY and an email identifier enabled on the Clerk instance",
  );

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL });
  });

  test("reaches the home page instead of being redirected", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText("Totally not the worst URL-shortener"),
    ).toBeVisible();
  });

  test("creates a short link that then redirects", async ({ page }) => {
    await page.goto("/");

    // Unique per run so repeated runs against the same database don't collide.
    const shorthand = `e2e${Date.now().toString(36)}`;
    const target = "https://example.com/e2e-target";

    const created = await page.evaluate(
      async ([url, short]) => {
        const res = await fetch("/api/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, shorthand: short }),
        });
        return { status: res.status, body: await res.text() };
      },
      [target, shorthand] as const,
    );

    expect(created.status, created.body).toBe(200);

    // Follow the short link without letting the browser chase the target host.
    const response = await page.request.get(`/${shorthand}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe(target);
  });

  test("shows the created link in the user's list", async ({ page }) => {
    const shorthand = `e2e${Date.now().toString(36)}list`;
    await page.goto("/");
    await page.evaluate(
      async ([short]) => {
        await fetch("/api/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: "https://example.com/listed",
            shorthand: short,
          }),
        });
      },
      [shorthand] as const,
    );

    await page.reload();
    await expect(page.getByText(shorthand)).toBeVisible({ timeout: 15_000 });
  });
});
