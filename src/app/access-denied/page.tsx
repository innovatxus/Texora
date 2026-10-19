import type { Metadata } from "next";
import Forbidden from "../forbidden";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

/** Target of the proxy's 403 rewrite; shares the forbidden() page UI. */
export default function AccessDeniedPage() {
  return <Forbidden />;
}
