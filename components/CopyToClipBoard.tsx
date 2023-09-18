"use client";
import { CopyIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";

export function CopyToClipBoard({ path }: { path: string }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() =>
        navigator.clipboard.writeText(`${window.location.origin}/${path}`)
      }
    >
      <CopyIcon className="h-4 w-4" />
    </Button>
  );
}
