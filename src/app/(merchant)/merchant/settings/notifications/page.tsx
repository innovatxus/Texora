import type { Metadata } from "next";
import { NotificationsForm } from "@/components/merchant/settings/SettingsForms";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page() {
  const { merchant } = await getMerchantContext();
  return (
    <section aria-labelledby="notifications-heading" className="flex flex-col gap-4">
      <h2 id="notifications-heading" className="text-label">
        Email notifications
      </h2>
      <p className="max-w-lg text-sm text-ink-soft">We send these to {merchant.email}.</p>
      <NotificationsForm defaults={merchant.notifications} />
    </section>
  );
}
