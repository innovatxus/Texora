import type { NextConfig } from "next";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  // The test suite builds into its own folder, so it never replaces the live build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
  poweredByHeader: false,
  // Security headers on every response. Test deployments (STAGING=true) also
  // carry noindex, whatever a page's own metadata says.
  async headers() {
    const headers = securityHeaders({
      dev: process.env.NODE_ENV === "development",
      https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
      emulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
      staging: process.env.STAGING === "true",
    });
    // Storefront photography and hero video: cached for a day by browsers and the
    // CDN, then refreshed in the background (file names aren't hashed, so not immutable).
    const media = [
      {
        key: "Cache-Control",
        value: "public, max-age=86400, stale-while-revalidate=604800",
      },
    ];
    return [
      { source: "/:path*", headers },
      { source: "/media/(hero|stock|assets)/:path*", headers: media },
    ];
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
