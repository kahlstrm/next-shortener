import { auth } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../lib/db";
import ShortUniqueId from "short-unique-id";
import { formSchema } from "../../../lib/schemas";
import { ZodError } from "zod";
import { generateUrl } from "../../../lib/utils";
import { revalidateTag } from "next/cache";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { userId } = auth();
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
          break;
        } catch (e) {
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
  revalidateTag("getUserUrls" + userId);
  return NextResponse.json({ url, shorthand: generateUrl(short) });
}
