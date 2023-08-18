import { auth } from "@clerk/nextjs";
import { getDB } from "../lib/db";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { generateUrl } from "../lib/utils";
import { unstable_cache } from "next/cache";
import { CopyToClipBoard } from "./CopyToClipBoard";

export async function UrlList() {
  const { userId } = auth();
  if (!userId) {
    return null;
  }

  const userUrls = await unstable_cache(
    async () => {
      console.log("fetching user urls", userId);
      const db = getDB();
      const userUrls = await db
        .selectFrom("shortened_links")
        .select(["url", "shorthand", "last_modified"])
        .where("user_id", "=", userId)
        .execute();
      userUrls.sort((a, b) => {
        return b.last_modified > a.last_modified ? 1 : -1;
      });
      return userUrls;
    },
    ["getUserUrls", userId],
    { tags: ["getUserUrls" + userId], revalidate: 3600 }
  )();

  return (
    <div>
      <Table>
        <TableCaption>Your Generated Shortened Urls</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>URL-target</TableHead>
            <TableHead>Suffix</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Modified at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userUrls.map((item) => (
            <TableRow key={item.shorthand}>
              <TableCell>
                <a
                  className="underline"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.url}
                </a>
              </TableCell>
              <TableCell>{item.shorthand}</TableCell>
              <TableCell>
                <CopyToClipBoard url={generateUrl(item.shorthand)} />
              </TableCell>
              <TableCell>{item.last_modified}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
