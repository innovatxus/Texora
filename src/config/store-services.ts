import type { Store } from "@/lib/validation";

type Service = Store["services"][number];

export const STORE_SERVICES: Record<Service, { label: string; description: string }> = {
  returns: {
    label: "Returns",
    description: "Return online orders: bring the items and the QR code from your return page.",
  },
  alterations: {
    label: "Alterations",
    description: "Hemming and simple alterations, usually ready within a week.",
  },
  styling: {
    label: "Personal styling",
    description: "Book a free session with a stylist to build outfits around your wardrobe.",
  },
};

export const SERVICE_ORDER: readonly Service[] = ["returns", "alterations", "styling"];
