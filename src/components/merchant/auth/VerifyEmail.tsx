"use client";

import { useEffect, useRef, useState } from "react";
import { ButtonLink, Spinner } from "@/components/primitives";
import {
  resendMerchantVerificationAction,
  verifyMerchantEmailAction,
} from "@/lib/merchant/actions/account";
import { MERCHANT_LIMITS } from "@/config/merchant";

type State = "working" | "verified" | "invalid" | "error";

/**
 * Applies the verification code once the page is open in a browser. Doing it
 * from an effect (not during render) means link previews and prefetches can
 * never use up the one-time code.
 */
export function VerifyEmailRunner({ oobCode, signedIn }: { oobCode: string; signedIn: boolean }) {
  const [state, setState] = useState<State>("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void verifyMerchantEmailAction({ oobCode }).then((result) => {
      setState(result.ok ? result.data.status : "error");
    });
  }, [oobCode]);

  if (state === "working") {
    return (
      <p role="status" className="flex items-center gap-3">
        <Spinner /> Verifying your email…
      </p>
    );
  }
  if (state === "verified") {
    return (
      <div role="status" className="flex flex-col items-start gap-6">
        <p className="text-lg">Email verified. You can now submit your shop.</p>
        <ButtonLink href={signedIn ? "/merchant" : "/merchant/sign-in"} size="lg">
          {signedIn ? "Go to your dashboard" : "Sign in"}
        </ButtonLink>
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-6">
      <p className="text-lg">
        {state === "invalid"
          ? "That link has expired or was already used. Send a new one from your dashboard."
          : "Something went wrong on our side. Try opening the link again."}
      </p>
      {signedIn ? (
        <ResendVerificationButton />
      ) : (
        <ButtonLink href="/merchant/sign-in" size="lg">
          Sign in
        </ButtonLink>
      )}
    </div>
  );
}

/** "Resend link" with the 60-second cooldown shown as a countdown. */
export function ResendVerificationButton() {
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setPending(true);
    const result = await resendMerchantVerificationAction({});
    setPending(false);
    if (result.ok) {
      setCooldown(MERCHANT_LIMITS.timing.verifyResendCooldownSeconds);
      setMessage({ tone: "status", text: "Sent. Check your inbox." });
    } else {
      setMessage({ tone: "alert", text: result.error.message });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={resend}
        disabled={pending || cooldown > 0}
        className="min-h-11 text-sm font-medium underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : pending ? "Sending…" : "Resend link"}
      </button>
      <p role={message?.tone ?? "status"} className="text-sm">
        {message?.text}
      </p>
    </div>
  );
}
