import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { OrderLookupForm } from "@/components/orders/OrderLookupForm";
import { Link } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Track an order",
  description: "Find your order with its number and email to track it or start a return.",
  alternates: { canonical: "/orders/lookup" },
};

export default function Page() {
  return (
    <div className="container-page pt-6 pb-24">
      <Breadcrumbs
        items={[
          { label: "Help", href: "/help" },
          { label: "Track an order", href: "/orders/lookup" },
        ]}
      />
      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <div className="max-w-md">
          <h1 className="font-display text-5xl">Track an order</h1>
          <p className="mt-4 text-ink-soft">
            Enter your order number and email to see where your order is, or to start a return.
          </p>
          <div className="mt-8">
            <OrderLookupForm />
          </div>
        </div>
        <aside className="self-start bg-surface p-6 text-sm md:mt-20">
          <h2 className="text-label">Can&apos;t find your order number?</h2>
          <p className="mt-3 text-ink-soft">
            It starts with TX- and is in the subject of your confirmation email. Still stuck?{" "}
            <Link href="/help/contact">Contact us</Link> and we&apos;ll find it for you.
          </p>
        </aside>
      </div>
    </div>
  );
}
