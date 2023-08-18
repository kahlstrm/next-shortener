"use client";
import { CopyIcon } from "@radix-ui/react-icons";
import { generateUrl } from "../lib/utils";
import { Button } from "./ui/button";

export function CopyToClipBoard({ url }: { url: string }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigator.clipboard.writeText(url)}
    >
      <CopyIcon className="h-4 w-4" />
    </Button>
  );
}
