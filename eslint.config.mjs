import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// `next lint` was removed in Next.js 16, so ESLint runs directly and the build
// output has to be ignored explicitly — it is no longer excluded for us.
export default defineConfig([
  globalIgnores([".next/**", "next-env.d.ts"]),
  { extends: [...nextCoreWebVitals] },
]);
