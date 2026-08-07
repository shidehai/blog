import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      ".astro/**",
      ".data/**",
      ".trellis/.backup-*/**",
      ".trellis/.runtime/**",
      ".trellis/tasks/**/research/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,ts,astro}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
);
