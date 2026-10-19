import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know about our custom utilities so it can resolve
 * conflicts between them and Tailwind's own classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label"] }],
      duration: [{ duration: ["fast", "base", "drawer", "slow"] }],
      ease: [{ ease: ["atelier"] }],
      rounded: [{ rounded: ["chip"] }],
      shadow: [{ shadow: ["overlay"] }],
    },
  },
});

/** Compose class names; later classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
