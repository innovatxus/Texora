import type { Metadata } from "next";
import { AddressBook } from "@/components/account/AddressBook";
import { listAddresses } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Addresses" };

/** Saved addresses, offered at checkout. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const addresses = await listAddresses(session.uid);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Addresses</h1>
      <p className="max-w-prose text-ink-soft">
        Your default shipping address is filled in for you at checkout.
      </p>
      <AddressBook addresses={addresses} />
    </div>
  );
}
