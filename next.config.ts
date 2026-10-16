import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Railway restores .next/cache between builds; overlapping builds corrupted Turbopack's on-disk cache once
    // (a panic in turbo-persistence), so production builds start cold instead.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
