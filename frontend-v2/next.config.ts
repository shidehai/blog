import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // lint 门禁由 `pnpm lint`（ESLint CLI + flat config）独立执行；
  // 构建期不再重复 lint，也避免 Next 误报 "plugin was not detected"。
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
