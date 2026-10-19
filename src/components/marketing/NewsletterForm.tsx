"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, Checkbox, Input } from "@/components/primitives";
import { subscribe } from "@/lib/marketing/actions";
import { cn } from "@/lib/utils/cn";

interface NewsletterFormProps {
  source: "footer" | "modal";
  /** Footer uses the inverse (ink) band styling. */
  tone?: "default" | "inverse";
  onSubscribed?: () => void;
  className?: string;
}

/** Email signup with an explicit consent checkbox; inline errors, no alerts. */
export function NewsletterForm({
  source,
  tone = "default",
  onSubscribed,
  className,
}: NewsletterFormProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("pending");
    const result = await subscribe({ email, consent, source });
    if (result.ok) {
      setStatus("done");
      setErrors({});
      onSubscribed?.();
      return;
    }
    setStatus("idle");
    const fieldErrors = result.error.fieldErrors ?? {};
    setErrors({
      email: fieldErrors.email?.[0] ?? "",
      consent: fieldErrors.consent?.[0] ?? "",
      form: result.error.code === "validation" ? "" : result.error.message,
    });
  };

  if (status === "done") {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center gap-2 text-sm",
          tone === "inverse" ? "text-canvas" : "text-success",
          className,
        )}
      >
        <CheckIcon /> Thank you. Look out for our next letter.
      </p>
    );
  }

  const inverse = tone === "inverse";

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start gap-2">
        <Input
          id={`${id}-email`}
          label="Email address"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email || undefined}
          className="flex-1"
          inputClassName={cn(
            inverse &&
              "border-canvas bg-ink text-canvas placeholder:text-line hover:border-canvas focus-visible:border-canvas",
          )}
        />
        <Button
          type="submit"
          loading={status === "pending"}
          variant={inverse ? "inverse" : "primary"}
        >
          Sign up
        </Button>
      </div>
      <Checkbox
        id={`${id}-consent`}
        label="Yes, email me about new arrivals, offers and events. Unsubscribe anytime."
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        error={errors.consent || undefined}
        className={cn(inverse && "[&_input]:border-canvas [&_label]:text-canvas")}
      />
      {errors.form && (
        <p role="alert" className={cn("text-sm", inverse ? "text-canvas" : "text-sale")}>
          {errors.form}
        </p>
      )}
    </form>
  );
}
