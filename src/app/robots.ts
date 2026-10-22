import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env/server";

/** Test deployments block every crawler; production keeps private areas out of search. */
export default function robots(): MetadataRoute.Robots {
  if (serverEnv.STAGING) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/merchant",
        "/api",
        "/auth",
        "/bag",
        "/checkout",
        "/order-confirmation",
        "/orders",
        "/notifications",
        "/styleguide",
      ],
    },
  };
}
