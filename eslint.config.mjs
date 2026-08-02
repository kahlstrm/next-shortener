import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// oxlint does the bulk of the linting. This narrow ESLint pass exists only for
// the React Compiler-era rules in eslint-plugin-react-hooks — set-state-in-render,
// set-state-in-effect, immutability, purity, refs, static-components, use-memo —
// which oxlint 1.76 does not implement and which cannot be recovered by config.
//
// Deliberately not eslint-config-next: that pulls eslint-plugin-react, which has
// no ESLint 10 support and would pin the project to ESLint 9.
const config = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "types/**"],
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    // `configs.recommended` is eslintrc-shaped; `configs.flat` is a namespace of
    // flat configs, so the actual config is one level deeper.
    languageOptions: { parser: tsParser },
    ...reactHooks.configs.flat["recommended-latest"],
  },
];

export default config;
