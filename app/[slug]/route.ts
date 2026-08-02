import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getDB } from "../../lib/db";

export const runtime = "edge";
export const preferredRegion = ["fra1", "iad1"];

function lookup(shorthand: string) {
  return getDB()
    .selectFrom("shortened_links")
    .select(["url"])
    .where("shorthand", "=", shorthand)
    .executeTakeFirst();
}

export async function GET(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shorthand = decodeURI(pathname).slice(1);

  const cached = await unstable_cache(
    () => lookup(shorthand),
    ["getRedirectforPath", pathname],
    { tags: ["getRedirectforPath" + pathname], revalidate: 3600 },
  )();

  // A miss is not trustworthy: the cache holds it for an hour, so a link created
  // after someone first tried the slug would keep 404ing. Hits stay cached —
  // this only costs an extra query on paths that do not resolve.
  const doc = cached ?? (await lookup(shorthand));

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.redirect(doc.url, { status: 302 });
}
