import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import { readBuildEnv } from "./scripts/env.mjs";

const env = readBuildEnv();

export default defineConfig({
  adapter: node({ mode: "standalone" }),
  compressHTML: true,
  markdown: {
    shikiConfig: { theme: "github-dark-default" },
  },
  output: "server",
  site: env.SITE_URL,
});
