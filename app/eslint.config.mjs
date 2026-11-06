import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/purity": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/set-state-in-effect": "off",
      "prefer-const": "warn",
    },
  },
  {
    // Server code logs through the structured logger (src/lib/logger.ts), so
    // every line is JSON and carries the request ID. A plain console call
    // anywhere under the API routes, the library or the storage layer would
    // put an unstructured, uncorrelated line back into the log, so it fails
    // the lint. Client components and hooks are not covered: their console
    // output goes to the browser, not the server log.
    files: ["src/app/api/**/*.ts", "src/lib/**/*.ts", "src/db/**/*.ts"],
    ignores: ["src/lib/logger.ts", "**/__tests__/**", "**/*.test.ts"],
    rules: {
      "no-console": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
