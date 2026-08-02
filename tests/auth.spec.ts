import { expect, test } from "@playwright/test";

/**
 * Unauthenticated behaviour. These need no Clerk credentials and no seeded data.
 *
 * The first test is the regression guard for the Clerk v4 -> v7 migration: v4's
 * `authMiddleware({})` protected every matched route by default, v5+'s
 * `clerkMiddleware()` protects nothing. When that was missed, `/` silently
 * became public and there was no way to sign in — build, lint and type checks
 * all still passed.
 */
test.describe("unauthenticated", () => {
  // ClerkProvider throws MissingPublishableKey without a key, so these can only
  // assert anything when Clerk is configured. The product specs cover the
  // shortener itself and need none of this.
  test.skip(
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    "requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  );

  test("the home page requires signing in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("the sign-in page renders Clerk's form", async ({ page }) => {
    await page.goto("/sign-in");
    // Completing Clerk's handshake is what actually proves the middleware
    // matcher covers this route.
    await expect(page).toHaveURL(/\/sign-in/);
    // Assert an interactive control, not the wrapper: .cl-rootBox mounts even
    // when the handshake stalls and no usable form ever appears.
    await expect(
      page.locator(".cl-rootBox button, .cl-rootBox input").first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("an unknown short link 404s", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-real-slug-xyz");
    expect(response?.status()).toBe(404);
  });

  test("creating a link without a session is rejected", async ({ request }) => {
    const response = await request.post("/api/create", {
      data: { url: "https://example.com" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "You must be logged in" });
  });
});
