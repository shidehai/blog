import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(),".."),
  transpilePackages:["@blog/content-contracts","@blog/markdown"],
  reactStrictMode: true,
  images: { unoptimized: true },
  // lint 门禁由 `pnpm lint`（ESLint CLI + flat config）独立执行；
  // 构建期不再重复 lint，也避免 Next 误报 "plugin was not detected"。
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
