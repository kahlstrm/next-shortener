import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../lib/db";
import ShortUniqueId from "short-unique-id";
import { formSchema } from "../../../lib/schemas";
import { ZodError } from "zod";
import { revalidateTag } from "next/cache";

export const runtime = "edge";
export const preferredRegion = ["fra1", "iad1"];
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json(
      { error: "You must be logged in" },
      { status: 401 }
    );
  const body = await req.json();
  try {
    formSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues });
    }
    return new NextResponse(undefined, { status: 500 });
  }

  const { url, shorthand } = formSchema.parse(body);
  const db = getDB();
  let short: string;
  if (!shorthand) {
    let length = 4;
    short = new ShortUniqueId({ length }).randomUUID();
    let inserted = false;
    while (!inserted) {
      for (let tries = 0; tries < 5; ++tries) {
        try {
          await db
            .insertInto("shortened_links")
            .values({ user_id: userId, url, shorthand: short })
            .executeTakeFirstOrThrow();
          inserted = true;
          break;
        } catch (e) {
          console.error(e);
          short = new ShortUniqueId({ length }).randomUUID();
          tries++;
        }
      }
      length++;
    }
  } else {
    short = shorthand;
    try {
      await db
        .insertInto("shortened_links")
        .values({ user_id: userId, url, shorthand: short })
        .executeTakeFirstOrThrow();
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: "Shorthand already exists" },
        { status: 400 }
      );
    }
  }
  // Next 16 requires a cache profile. `{ expire: 0 }` keeps the pre-16 immediate
  // expiry: the client calls router.refresh() straight after this, and "max"
  // (stale-while-revalidate) would serve a list still missing the new link.
  revalidateTag("getUserUrls" + userId, { expire: 0 });
  return NextResponse.json({ url, shorthand: short });
}
