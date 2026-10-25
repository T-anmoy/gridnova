import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-visual/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated reports.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  // The backend URL is read in exactly one place (lib/config.ts) so a missing
  // value can never silently fall back to localhost in production.
  {
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["lib/config.ts", "tests/**", "next.config.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name='NEXT_PUBLIC_API_URL'], Literal[value='NEXT_PUBLIC_API_URL']",
          message: "Import API_BASE_URL from '@/lib/config' instead of reading NEXT_PUBLIC_API_URL.",
        },
      ],
    },
  },
]);

export default eslintConfig;
