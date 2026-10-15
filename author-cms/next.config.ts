import type { NextConfig } from "next";
import path from "node:path";
import { CMS_BASE_PATH } from "@blog/content-contracts/paths";

const config: NextConfig = {
  basePath: CMS_BASE_PATH,
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@blog/content-contracts", "@blog/markdown"],
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};
export default config;
