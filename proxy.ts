import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// v4's `authMiddleware({})` protected every matched route by default; v5+'s
// `clerkMiddleware()` protects nothing unless asked. Only the home page relied
// on that redirect — `/api/create` checks `auth()` itself and answers 401, and
// forcing protection there turns its JSON 401 into a 405.
const isProtectedRoute = createRouteMatcher(["/"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// Wider than the protected set on purpose: `clerkMiddleware` must also run on
// the sign-in and sign-up routes or the handshake never completes and sign-in
// silently fails. `/[slug]` is deliberately excluded — it is the public
// redirect hot path and must not be pulled into Clerk's handshake.
export const config = {
  matcher: ["/", "/api/create", "/sign-in(.*)", "/sign-up(.*)"],
};
