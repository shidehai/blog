import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      ".data/**",
      ".trellis/.backup-*/**",
      ".trellis/.runtime/**",
      ".trellis/tasks/**/research/**",
      "coverage/**",
      "dist/**",
      "frontend-v2/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
);
