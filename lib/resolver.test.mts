import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { zodResolver } from "@hookform/resolvers/zod";

import { formSchema } from "./schemas.ts";

/**
 * `zodResolver` is the seam between zod and react-hook-form, and the only place
 * the two majors meet. `UrlForm` sits behind authentication so the e2e suite
 * cannot reach it; this covers the adapter directly instead.
 */
const resolve = zodResolver(formSchema);
const options = { fields: {}, shouldUseNativeValidation: false } as never;

describe("zodResolver", () => {
  test("passes valid input through", async () => {
    const result = await resolve({ url: "https://example.com" }, undefined, options);

    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.values, { url: "https://example.com" });
  });

  test("surfaces the schema's message on the offending field", async () => {
    const result = await resolve({ url: "ftp://example.com" }, undefined, options);

    assert.deepEqual(result.values, {});
    assert.equal(
      (result.errors as Record<string, { message?: string }>).url?.message,
      "URL must start with http:// or https://",
    );
  });

  test("reports a missing url rather than throwing", async () => {
    const result = await resolve({}, undefined, options);
    assert.ok("url" in result.errors);
  });
});
