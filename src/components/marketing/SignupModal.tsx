"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Modal } from "@/components/feedback/Modal";
import { useCookie } from "@/lib/browser/hooks";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { NewsletterForm } from "./NewsletterForm";

const SEEN_KEY = "texora-signup-seen";
const FREQUENCY_DAYS = 14;
const DELAY_MS = 20_000;
const SCROLL_DEPTH = 0.5;
/** Never interrupt purchase, sign-in or account flows. */
const SUPPRESSED = ["/checkout", "/bag", "/auth", "/account", "/admin", "/styleguide"];

function recentlySeen(): boolean {
  try {
    const seen = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    return Date.now() - seen < FREQUENCY_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // Without storage the modal is simply shown at most once per page view.
  }
}

/** Delayed email signup: after 20s or half-page scroll, once per 14 days, after consent. */
export function SignupModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The modal waits until the visitor has answered the cookie banner.
  const consentDecided = parseConsent(useCookie(CONSENT_COOKIE)) !== null;

  const suppressed = SUPPRESSED.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (suppressed || !consentDecided || recentlySeen()) return;
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      markSeen();
      setOpen(true);
    };
    const timer = window.setTimeout(show, DELAY_MS);
    const onScroll = () => {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth >= SCROLL_DEPTH) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [suppressed, consentDecided]);

  return (
    <Modal
      open={open && !suppressed}
      onOpenChange={setOpen}
      title="15% off your first order"
      description="Join our list for new arrivals, early sale access and a welcome code."
      aside={
        <span className="relative block h-full min-h-80">
          <ProductImage
            src="/media/stock/womenSweaters-tile.jpg"
            alt="A woman in an oatmeal cable-knit cardigan and olive ribbed skirt"
            fill
            sizes="384px"
          />
        </span>
      }
    >
      <NewsletterForm
        source="modal"
        onSubscribed={() => window.setTimeout(() => setOpen(false), 2500)}
      />
    </Modal>
  );
}
