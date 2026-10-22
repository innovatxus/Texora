import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Enables forbidden() / unauthorized() and their 403/401 pages.
    authInterrupts: true,
  },
  cacheComponents: true,
  images: {
    // Product placeholders and processed merchant media are both served from /media (D-064).
    localPatterns: [{ pathname: "/media/**" }],
    qualities: [75],
  },
  partialPrefetching: true,
  // Test deployments (STAGING=true) must never be indexed, whatever a page's own metadata says.
  async headers() {
    if (process.env.STAGING !== "true") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
