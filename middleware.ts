import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// Clerk's recommended matcher. The v4 `authMiddleware` worked with a narrow
// ["/", "/api/create"] list, but `clerkMiddleware` must also run on the sign-in
// and sign-up routes and on Clerk's own /__clerk endpoints — otherwise the
// dev-browser handshake never completes and sign-in silently fails.
// https://clerk.com/docs/references/nextjs/clerk-middleware
export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless referenced in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
