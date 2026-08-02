import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formSchema } from "./schemas.ts";

/**
 * Characterises the validation the create API relies on. Written before the
 * zod 3 -> 4 upgrade so the upgrade has to preserve this behaviour, including
 * the exact user-facing messages, which surface in the form.
 */
function messagesFor(input: unknown): string[] {
  const result = formSchema.safeParse(input);
  assert.equal(result.success, false, "expected validation to fail");
  return result.error!.issues.map((i) => i.message);
}

describe("formSchema", () => {
  test("accepts a plain https url", () => {
    const result = formSchema.safeParse({ url: "https://example.com" });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, { url: "https://example.com" });
  });

  test("accepts an optional shorthand", () => {
    const result = formSchema.safeParse({
      url: "https://example.com",
      shorthand: "mine",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.shorthand, "mine");
  });

  test("rejects a url that is not a url at all", () => {
    assert.ok(messagesFor({ url: "http://" }).length > 0);
  });

  test("rejects a non-http scheme", () => {
    assert.ok(
      messagesFor({ url: "ftp://example.com" }).includes("URL must start with http:// or https://"),
    );
  });

  test("rejects a url over 2000 characters", () => {
    const long = `https://example.com/${"a".repeat(2000)}`;
    assert.ok(messagesFor({ url: long }).includes("URL must be shorter than 2000 characters"));
  });

  test("rejects a shorthand over 30 characters", () => {
    assert.ok(
      messagesFor({
        url: "https://example.com",
        shorthand: "s".repeat(31),
      }).includes("shorthand must be less than 30 characters"),
    );
  });

  test("rejects a missing url", () => {
    assert.equal(formSchema.safeParse({}).success, false);
  });
});
