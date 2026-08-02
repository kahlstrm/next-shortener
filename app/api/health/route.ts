export const runtime = "edge";

/**
 * Liveness probe. Deliberately outside the proxy matcher and not a page, so it
 * answers without Clerk configured — which is what lets the e2e suite wait for
 * the server without requiring a publishable key.
 */
export function GET() {
  return new Response("ok");
}
