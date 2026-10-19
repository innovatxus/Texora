"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import { Button, Checkbox, Link } from "@/components/primitives";
import { useCookie } from "@/lib/browser/hooks";
import { readCookie } from "@/lib/browser/storage";
import {
  CONSENT_COOKIE,
  OPEN_CONSENT_EVENT,
  parseConsent,
  writeConsent,
  type ConsentChoices,
} from "@/lib/consent";

/**
 * Cookie consent with category toggles. Nothing beyond necessary cookies runs
 * until the visitor decides; analytics loaders listen for the consent event.
 */
export function ConsentBanner() {
  const raw = useCookie(CONSENT_COOKIE);
  // Unknown on the server: render nothing until the client knows.
  const decided = raw === undefined || parseConsent(raw) !== null;
  const [customising, setCustomising] = useState(false);
  const [choices, setChoices] = useState<ConsentChoices>({ analytics: false, marketing: false });

  const openSettings = useCallback(() => {
    const current = parseConsent(readCookie(CONSENT_COOKIE));
    setChoices({ analytics: current?.analytics ?? false, marketing: current?.marketing ?? false });
    setCustomising(true);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_CONSENT_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, openSettings);
  }, [openSettings]);

  const save = (next: ConsentChoices) => {
    writeConsent(next);
    setChoices(next);
    setCustomising(false);
  };

  return (
    <>
      {!decided && (
        <section
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-40 animate-fade-in border-t border-line bg-surface shadow-overlay"
        >
          <div className="container-page flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-3xl text-sm text-ink-soft">
              We use necessary cookies to run the site and, with your permission, analytics and
              marketing cookies to improve it and show you relevant offers.{" "}
              <Link href="/help/privacy">Privacy policy</Link>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="secondary" onClick={openSettings}>
                Customise
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => save({ analytics: false, marketing: false })}
              >
                Necessary only
              </Button>
              <Button size="sm" onClick={() => save({ analytics: true, marketing: true })}>
                Accept all
              </Button>
            </div>
          </div>
        </section>
      )}

      <Modal
        open={customising}
        onOpenChange={setCustomising}
        title="Cookie settings"
        description="Choose which optional cookies we may use. You can change this at any time from the footer."
      >
        <div className="flex flex-col gap-5">
          <Checkbox
            label="Necessary"
            hint="Required for the bag, checkout and security. Always on."
            checked
            disabled
            readOnly
          />
          <Checkbox
            label="Analytics"
            hint="Helps us understand how the site is used so we can improve it."
            checked={choices.analytics}
            onChange={(e) => setChoices((c) => ({ ...c, analytics: e.target.checked }))}
          />
          <Checkbox
            label="Marketing"
            hint="Lets us measure campaigns and show relevant offers elsewhere."
            checked={choices.marketing}
            onChange={(e) => setChoices((c) => ({ ...c, marketing: e.target.checked }))}
          />
          <div className="mt-2 flex flex-wrap gap-3">
            <Button onClick={() => save(choices)}>Save choices</Button>
            <Button variant="secondary" onClick={() => save({ analytics: true, marketing: true })}>
              Accept all
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
