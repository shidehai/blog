import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@blog/content-contracts", "@blog/markdown"],
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};
export default config;
