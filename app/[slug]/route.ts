import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../lib/db";
import { unstable_cache } from "next/cache";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shorthand = decodeURI(pathname).slice(1);
  console.log(shorthand);
  const doc = await unstable_cache(
    async () => {
      console.log("fetching path", shorthand);
      const db = getDB();
      const doc = await db
        .selectFrom("shortened_links")
        .select(["url"])
        .where("shorthand", "=", shorthand)
        .executeTakeFirst();

      return doc;
    },
    ["getRedirectforPath", pathname],
    { tags: ["getRedirectforPath" + pathname], revalidate: 3600 }
  )();

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.redirect(doc.url, { status: 302 });
}
