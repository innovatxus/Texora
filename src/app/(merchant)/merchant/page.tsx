import type { Metadata } from "next";
import { CheckIcon } from "@/components/icons";
import { getMerchantContext } from "@/lib/merchant/context";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Home" };

/** Merchant home: account status and what to do next (journey §7). */
export default async function Page() {
  const { merchant, shops } = await getMerchantContext();
  const checklist = [
    { label: "Create your merchant account", done: true },
    { label: "Verify your email", done: merchant.emailVerified },
    { label: "Set up your shop", done: shops.length > 0 },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl">Welcome, {merchant.displayName}</h1>
        <p className="mt-2 text-ink-soft">
          {shops.length === 0
            ? "Your merchant account is ready. Next, set up your shop: name, branding, locations and policies."
            : "Here's where your shop stands."}
        </p>
      </div>

      <section aria-labelledby="checklist-title" className="border border-line bg-surface p-6">
        <h2 id="checklist-title" className="text-label">
          Getting started
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 items-center justify-center border",
                  item.done ? "border-ink bg-ink text-surface" : "border-ink-subtle",
                )}
              >
                {item.done && <CheckIcon className="size-4" />}
              </span>
              <span className={cn(item.done && "text-ink-soft")}>
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
