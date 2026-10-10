// frontend-v2 owns its ESLint flat config. The root eslint.config.js scopes
// itself to scripts/directus and ignores frontend-v2/**, so deleting this file
// silently turns `pnpm --filter frontend-v2 lint` into a no-op that reports
// green. eslint-config-next is not used: its peer range stops at eslint 9
// while the workspace root runs eslint 10 under strict-peer-dependencies.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx,mts}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // 项目有意使用原生 <img> 而不引入 next/image（09-20 已据此移除
      // images.remotePatterns）；保留该规则只会制造常驻噪音。
      "@next/next/no-img-element": "off",
    },
  },
];
