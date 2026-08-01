import { clerkMiddleware } from "@clerk/nextjs/server";

// Only the routes in the matcher below run through Clerk; everything else
// (notably the /[slug] redirect route) stays public.
// See https://clerk.com/docs/references/nextjs/clerk-middleware
export default clerkMiddleware();

export const config = {
  matcher: ["/", "/api/create"],
};
