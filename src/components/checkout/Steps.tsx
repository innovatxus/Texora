"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Redemptions } from "@/components/bag/BagParts";
import { useBagPricing } from "@/components/bag/useBagPricing";
import { TruckIcon } from "@/components/icons";
import { Button, ButtonLink, Checkbox, Input, Link, Skeleton } from "@/components/primitives";
import { estimateDelivery } from "@/lib/catalog/variant-selection";
import { formatMoney } from "@/lib/format/money";
import { getCheckoutOptions, submitOrder } from "@/lib/orders/actions";
import { cn } from "@/lib/utils/cn";
import { useBagStore } from "@/stores/bag";
import { useCheckoutStore, type DeliveryChoice } from "@/stores/checkout";
import { writeStorage } from "@/lib/browser/storage";
import { AddressForm } from "./AddressForm";
import { CLIENT_SECRET_KEY } from "./CardPayment";

type CheckoutOptions = Extract<
  Awaited<ReturnType<typeof getCheckoutOptions>>,
  { ok: true }
>["data"];

/** Shipping rates and payment methods offered by the server. */
function useCheckoutOptions(): CheckoutOptions | null {
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getCheckoutOptions({}).then((r) => {
      if (!cancelled && r.ok) setOptions(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

// ------------------------------------------------------------------ contact

const contactSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  marketingOptIn: z.boolean(),
});

/** Contact step: email (prefilled when signed in), marketing opt-in and a sign-in prompt for guests. */
export function ContactStep() {
  const router = useRouter();
  const options = useCheckoutOptions();
  const { email, marketingOptIn, setContact } = useCheckoutStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    values: { email: email ?? options?.email ?? "", marketingOptIn },
  });

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section aria-labelledby="guest-title">
        <h2 id="guest-title" className="text-label">
          {options?.signedIn ? "Your email" : "Continue as guest"}
        </h2>
        <form
          noValidate
          onSubmit={handleSubmit((values) => {
            setContact(values.email.toLowerCase(), values.marketingOptIn);
            router.push("/checkout/shipping");
          })}
          className="mt-5 flex flex-col gap-5"
        >
          <Input
            id="checkout-email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            hint="We'll send your order confirmation here."
            error={errors.email?.message}
            {...register("email")}
          />
          <Checkbox
            label="Email me about new arrivals and offers"
            {...register("marketingOptIn")}
          />
          <Button type="submit" size="lg">
            Continue to shipping
          </Button>
        </form>
      </section>
      {!options?.signedIn && (
        <section aria-labelledby="signin-title" className="bg-surface p-6">
          <h2 id="signin-title" className="text-label">
            Have an account?
          </h2>
          <p className="mt-3 text-sm text-ink-soft">
            Sign in to check out faster, use saved addresses and earn rewards.
          </p>
          <ButtonLink href="/auth/signin?next=/checkout" variant="secondary" className="mt-5">
            Sign in
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- shipping

/** Shipping step: address form validated with the server's schema. */
export function ShippingStep() {
  const router = useRouter();
  const { shippingAddress, setShippingAddress } = useCheckoutStore();
  return (
    <AddressForm
      section="shipping"
      defaultValues={shippingAddress}
      submitLabel="Continue to delivery"
      onSubmit={(address) => {
        setShippingAddress(address);
        router.push("/checkout/delivery");
      }}
    />
  );
}

// ----------------------------------------------------------------- delivery

/** Delivery step: standard or express, with arrival dates and prices. */
export function DeliveryStep() {
  const router = useRouter();
  const name = useId();
  const options = useCheckoutOptions();
  const { delivery, setDelivery, shippingAddress } = useCheckoutStore();
  const [choice, setChoice] = useState<DeliveryChoice>(delivery ?? { method: "standard" });
  const { bag } = useBagPricing({
    shippingMethod: "standard",
    region: shippingAddress?.region ?? null,
  });
  const freeStandard = bag ? bag.freeShippingRemaining === 0 : false;
  const now = new Date();

  if (!options) return <Skeleton className="h-64" />;

  const window = (method: "standard" | "express") => {
    const { from, to } = estimateDelivery(method, now);
    return `${dateFormat.format(from)} – ${dateFormat.format(to)}`;
  };

  const option = (
    value: DeliveryChoice["method"],
    title: string,
    detail: string,
    price: string,
    icon: React.ReactNode,
  ) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-4 border p-5",
        choice.method === value ? "border-line-strong" : "border-line hover:border-ink-subtle",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={choice.method === value}
        onChange={() => setChoice({ method: value })}
        className="mt-1 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-ink-subtle checked:border-[6px] checked:border-ink"
      />
      <span className="flex flex-1 flex-col gap-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon} {title}
        </span>
        <span className="text-ink-soft">{detail}</span>
      </span>
      <span className="text-sm font-medium tabular-nums">{price}</span>
    </label>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setDelivery(choice);
        router.push("/checkout/payment");
      }}
      className="flex flex-col gap-4"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label">Delivery method</legend>
        {option(
          "standard",
          "Standard",
          `Arrives ${window("standard")}`,
          freeStandard ? "Free" : formatMoney(options.rates.standard),
          <TruckIcon />,
        )}
        {option(
          "express",
          "Express",
          `Arrives ${window("express")}`,
          formatMoney(options.rates.express),
          <TruckIcon />,
        )}
      </fieldset>
      <Button type="submit" size="lg" className="mt-4 self-start">
        Continue to payment
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ payment

/** Payment step: method, gift card and rewards, and billing address. */
export function PaymentStep() {
  const router = useRouter();
  const name = useId();
  const options = useCheckoutOptions();
  const {
    paymentMethod,
    billingSameAsShipping,
    billingAddress,
    shippingAddress,
    delivery,
    setPayment,
  } = useCheckoutStore();
  const [method, setMethod] = useState(paymentMethod ?? null);
  const [sameAsShipping, setSameAsShipping] = useState(billingSameAsShipping);
  const [error, setError] = useState<string | null>(null);
  const { bag } = useBagPricing({
    shippingMethod: delivery?.method ?? "standard",
    region: shippingAddress?.region ?? null,
  });

  if (!options) return <Skeleton className="h-64" />;
  const methods = [
    ...(options.cardPayments
      ? [{ value: "card" as const, title: "Credit or debit card", detail: "Secure card payment." }]
      : []),
    ...(options.cashOnDelivery
      ? [
          {
            value: "cod" as const,
            title: "Pay on delivery",
            detail: "Pay by card or cash when your order arrives.",
          },
        ]
      : []),
  ];
  const chosen = method ?? methods[0]?.value ?? null;

  const next = (billing: typeof billingAddress) => {
    if (!chosen) {
      setError("Choose a payment method");
      return;
    }
    setPayment({ method: chosen, billingSameAsShipping: sameAsShipping, billingAddress: billing });
    router.push("/checkout/review");
  };

  return (
    <div className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-label">Payment method</legend>
        {methods.length === 0 && (
          <p className="text-sm text-sale">No payment methods are available right now.</p>
        )}
        {methods.map((m) => (
          <label
            key={m.value}
            className={cn(
              "flex cursor-pointer items-start gap-4 border p-5",
              chosen === m.value ? "border-line-strong" : "border-line hover:border-ink-subtle",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={chosen === m.value}
              onChange={() => setMethod(m.value)}
              className="mt-1 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-ink-subtle checked:border-[6px] checked:border-ink"
            />
            <span className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{m.title}</span>
              <span className="text-ink-soft">{m.detail}</span>
            </span>
          </label>
        ))}
        {chosen === "card" && (
          <p className="text-sm text-ink-soft">
            You&apos;ll enter your card details securely on the next step.
          </p>
        )}
      </fieldset>

      <section aria-labelledby="redeem-title">
        <h2 id="redeem-title" className="text-label">
          Gift card and rewards
        </h2>
        <div className="mt-4">
          <Redemptions bag={bag} />
        </div>
      </section>

      <section aria-labelledby="billing-title" className="flex flex-col gap-5">
        <h2 id="billing-title" className="text-label">
          Billing address
        </h2>
        <Checkbox
          label="Same as shipping address"
          checked={sameAsShipping}
          onChange={(e) => setSameAsShipping(e.target.checked)}
        />
        {error && (
          <p role="alert" className="text-sm text-sale">
            {error}
          </p>
        )}
        {sameAsShipping && shippingAddress ? (
          <Button size="lg" className="self-start" onClick={() => next(shippingAddress)}>
            Review order
          </Button>
        ) : (
          <AddressForm
            section="billing"
            defaultValues={billingAddress}
            submitLabel="Review order"
            onSubmit={(address) => next(address)}
          />
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------- review

function AddressBlock({
  title,
  address,
  editHref,
}: {
  title: string;
  address: {
    firstName: string;
    lastName: string;
    line1: string;
    line2?: string | undefined;
    city: string;
    region: string;
    postalCode: string;
  };
  editHref: string;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-label">{title}</h3>
        <Link href={editHref} className="text-xs">
          Edit
        </Link>
      </div>
      <address className="mt-2 text-ink-soft not-italic">
        {address.firstName} {address.lastName}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.city}, {address.region} {address.postalCode}
      </address>
    </div>
  );
}

/** Review step: summary of every choice and the Place order button. */
export function ReviewStep() {
  const router = useRouter();
  const checkout = useCheckoutStore();
  const lines = useBagStore((s) => s.lines);
  const promoCodes = useBagStore((s) => s.promoCodes);
  const giftCardCode = useBagStore((s) => s.giftCardCode);
  const rewardsValue = useBagStore((s) => s.rewardsValue);
  const [state, setState] = useState<"idle" | "placing">("idle");
  const [error, setError] = useState<{ message: string; reviewBag: boolean } | null>(null);
  const { delivery, shippingAddress, billingAddress, billingSameAsShipping, paymentMethod, email } =
    checkout;
  const billing = billingSameAsShipping ? shippingAddress : billingAddress;

  const place = async () => {
    if (!email || !delivery || !shippingAddress || !billing || !paymentMethod) return;
    setState("placing");
    setError(null);
    const result = await submitOrder({
      idempotencyKey: checkout.idempotencyKey,
      email,
      lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      promoCodes,
      delivery,
      shippingAddress,
      billingAddress: billing,
      paymentMethod,
      ...(giftCardCode ? { giftCardCode } : {}),
      ...(rewardsValue ? { rewardsValue } : {}),
      marketingOptIn: checkout.marketingOptIn,
    });
    if (!result.ok) {
      setState("idle");
      setError({ message: result.error.message, reviewBag: result.error.code === "conflict" });
      return;
    }
    const { orderId, accessToken, payment } = result.data;
    if (payment.kind === "card") {
      // Card details are collected by the payment provider on the confirmation page.
      writeStorage("session", CLIENT_SECRET_KEY(orderId), payment.clientSecret);
      router.push(`/order-confirmation/${orderId}?t=${encodeURIComponent(accessToken)}`);
      return;
    }
    // The confirmation page clears the bag once it is showing (see ClearAfterOrder).
    router.push(`/order-confirmation/${orderId}?t=${encodeURIComponent(accessToken)}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="text-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-label">Contact</h3>
            <Link href="/checkout" className="text-xs">
              Edit
            </Link>
          </div>
          <p className="mt-2 text-ink-soft">{email}</p>
        </div>
        <div className="text-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-label">Delivery</h3>
            <Link href="/checkout/delivery" className="text-xs">
              Edit
            </Link>
          </div>
          <p className="mt-2 text-ink-soft">
            {delivery?.method === "express" ? "Express delivery" : "Standard delivery"}
          </p>
        </div>
        {shippingAddress && (
          <AddressBlock title="Ship to" address={shippingAddress} editHref="/checkout/shipping" />
        )}
        {billing && <AddressBlock title="Billing" address={billing} editHref="/checkout/payment" />}
        <div className="text-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-label">Payment</h3>
            <Link href="/checkout/payment" className="text-xs">
              Edit
            </Link>
          </div>
          <p className="mt-2 text-ink-soft">
            {paymentMethod === "card" ? "Credit or debit card" : "Pay on delivery"}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-surface-muted p-4 text-sm text-sale">
          {error.message}{" "}
          {error.reviewBag && (
            <NextLink href="/bag" className="text-ink underline underline-offset-4">
              Review your bag
            </NextLink>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={place} loading={state === "placing"} className="self-start">
          Place order
        </Button>
        <p className="text-xs text-ink-subtle">
          By placing your order you agree to our <Link href="/help/terms">terms of sale</Link> and{" "}
          <Link href="/help/privacy">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
