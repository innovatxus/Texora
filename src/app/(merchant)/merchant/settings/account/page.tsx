import type { Metadata } from "next";
import { AccountForm } from "@/components/merchant/settings/SettingsForms";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { formatDate } from "@/lib/format/date";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Account settings" };

export default async function Page() {
  const { merchant } = await getMerchantContext();
  const days = MERCHANT_LIMITS.username.changeEveryDays;
  const next = merchant.usernameChangedAt
    ? new Date(merchant.usernameChangedAt.getTime() + days * 86_400_000)
    : null;
  const usernameNote =
    next && next > new Date()
      ? `You can change your username again on ${formatDate(next)}.`
      : undefined;
  return (
    <section aria-labelledby="account-heading" className="flex flex-col gap-4">
      <h2 id="account-heading" className="text-label">
        Account
      </h2>
      <AccountForm
        defaults={{
          displayName: merchant.displayName,
          email: merchant.email,
          username: merchant.username,
        }}
        usernameNote={usernameNote}
      />
    </section>
  );
}
