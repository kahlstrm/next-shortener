import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";

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

  const tag = "getRedirectforPath" + pathname;
  const cached = await unstable_cache(
    () => lookup(shorthand),
    ["getRedirectforPath", pathname],
    { tags: [tag], revalidate: 3600 },
  )();

  // A miss is not trustworthy: the cache holds it for an hour, so a link created
  // after someone first tried the slug would keep 404ing. Hits stay cached —
  // this only costs an extra query on paths that do not resolve.
  if (cached) {
    return NextResponse.redirect(cached.url, { status: 302 });
  }

  const fresh = await lookup(shorthand);
  if (!fresh) {
    return new NextResponse("Not found", { status: 404 });
  }

  // The slug exists after all, so drop the stale negative entry. Without this
  // every request would keep falling through to the database until the entry
  // expired on its own.
  revalidateTag(tag, { expire: 0 });
  return NextResponse.redirect(fresh.url, { status: 302 });
}
