import { Cormorant_Garamond, Inter } from "next/font/google";

/** UI and body copy. Variable font, so all weights ship in one file. */
export const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Editorial headlines only (hero and section titles). */
export const fontDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-cormorant",
});
