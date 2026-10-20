import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PendingCardPayment } from "@/components/checkout/PendingCardPayment";
import { CheckIcon } from "@/components/icons";
import { ButtonLink, Skeleton } from "@/components/primitives";
import { clientEnv } from "@/lib/env/client";
import { formatMoney } from "@/lib/format/money";
import { getGiftCardPurchase } from "@/lib/giftcards/service";
import { verifyToken } from "@/lib/orders/token";

export const metadata: Metadata = {
  title: "Your e-gift card",
  robots: { index: false, follow: false },
};

const longDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const formatDay = (yyyyMmDd: string) => longDate.format(new Date(`${yyyyMmDd}T12:00:00Z`));

async function Purchase({ params, searchParams }: PageProps<"/gift-cards/purchase/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const token = typeof query.t === "string" ? query.t : null;
  if (!verifyToken("gift-card-purchase", id, token)) notFound();
  const purchase = await getGiftCardPurchase(id);
  if (!purchase) notFound();

  const returnUrl = new URL(`/gift-cards/purchase/${id}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  returnUrl.searchParams.set("t", token ?? "");

  return (
    <div className="container-page max-w-2xl pt-10 pb-24">
      {purchase.status === "pending_payment" ? (
        <>
          <h1 className="font-display text-5xl">Complete your payment</h1>
          <p className="mt-4 text-ink-soft">
            {formatMoney(purchase.amount)} e-gift card for {purchase.recipientName}.
          </p>
          <div className="mt-8">
            <PendingCardPayment
              orderId={purchase.id}
              amount={purchase.amount}
              returnUrl={returnUrl.toString()}
            />
          </div>
        </>
      ) : purchase.status === "cancelled" ? (
        <>
          <h1 className="font-display text-5xl">Payment didn&apos;t go through</h1>
          <p className="mt-4 text-ink-soft">You haven&apos;t been charged. Please try again.</p>
          <ButtonLink href="/gift-cards/buy" className="mt-8">
            Try again
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-label text-success">
            <CheckIcon /> Payment received
          </p>
          <h1 className="mt-3 font-display text-5xl">Your gift is on its way</h1>
          <p className="mt-4 text-lg text-ink-soft">
            {purchase.status === "delivered"
              ? `We emailed ${purchase.recipientName}'s ${formatMoney(purchase.amount)} gift card to ${purchase.recipientEmail}.`
              : `We'll email a ${formatMoney(purchase.amount)} gift card to ${purchase.recipientName} (${purchase.recipientEmail}) on ${formatDay(purchase.deliverOn)}.`}{" "}
            Your receipt is on its way to {purchase.purchaserEmail}.
          </p>
          <ButtonLink href="/" variant="secondary" className="mt-8">
            Continue shopping
          </ButtonLink>
        </>
      )}
    </div>
  );
}

export default function Page(props: PageProps<"/gift-cards/purchase/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="container-page max-w-2xl pt-10 pb-24">
          <Skeleton className="h-12 w-80" />
          <Skeleton className="mt-8 h-64" />
        </div>
      }
    >
      <Purchase {...props} />
    </Suspense>
  );
}
