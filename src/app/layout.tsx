import type { Metadata, Viewport } from "next";
import { HydrationMarker } from "@/components/HydrationMarker";
import { brand } from "@/config/brand";
import { clientEnv } from "@/lib/env/client";
import { cn } from "@/lib/utils/cn";
import { fontDisplay, fontSans } from "@/styles/fonts";
import "@/styles/globals.css";

/** Site-wide metadata defaults: base URL, title template and description. */
export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  // The share image is app/opengraph-image.jpg and app/twitter-image.jpg (the home hero),
  // used everywhere a page doesn't set its own (products and shops show theirs).
  openGraph: {
    siteName: brand.name,
    type: "website",
    locale: "en_EG",
  },
  twitter: { card: "summary_large_image" },
};

/** Browser theme colour and colour scheme. */
export const viewport: Viewport = {
  themeColor: brand.themeColor,
  colorScheme: "light",
};

/** Root HTML document: fonts, language and the hydration marker used by tests. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={brand.locale} className={cn(fontSans.variable, fontDisplay.variable, "h-full")}>
      <body className="flex min-h-full flex-col">
        {children}
        <HydrationMarker />
      </body>
    </html>
  );
}
