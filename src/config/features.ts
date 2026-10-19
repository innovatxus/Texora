import "server-only";
import { serverEnv } from "@/lib/env/server";

/** Server-evaluated feature flags. Client-visible flags get their own module when needed. */
export const features = {
  styleguide: serverEnv.ENABLE_STYLEGUIDE,
} as const;
