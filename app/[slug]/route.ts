import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../lib/db";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const db = getDB();
  const doc = await db
    .selectFrom("shortened_links")
    .select("url")
    .where("shorthand", "=", pathname.slice(1))
    .executeTakeFirst();
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.redirect(doc.url, { status: 302 });
}
