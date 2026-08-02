import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ZodError } from "zod";

import { getDB } from "../../../lib/db";
import { createShortLink } from "../../../lib/links";
import { formSchema } from "../../../lib/schemas";

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
  let parsed: ReturnType<typeof formSchema.parse>;
  try {
    parsed = formSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues });
    }
    return new NextResponse(undefined, { status: 500 });
  }

  const result = await createShortLink(getDB(), { userId, ...parsed });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Shorthand already exists" },
      { status: 400 }
    );
  }

  // Next 16 requires a cache profile. `{ expire: 0 }` keeps the pre-16 immediate
  // expiry: the client calls router.refresh() straight after this, and "max"
  // (stale-while-revalidate) would serve a list still missing the new link.
  revalidateTag("getUserUrls" + userId, { expire: 0 });
  return NextResponse.json({ url: parsed.url, shorthand: result.shorthand });
}
