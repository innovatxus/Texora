import type { Metadata } from "next";
import {
  ChangePasswordForm,
  SignOutEverywhereButton,
} from "@/components/merchant/settings/SettingsForms";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Security" };

export default async function Page() {
  const { merchant } = await getMerchantContext();
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="password-heading" className="flex flex-col gap-4">
        <h2 id="password-heading" className="text-label">
          Change password
        </h2>
        <ChangePasswordForm userInputs={[merchant.email, merchant.username]} />
      </section>
      <section aria-labelledby="sessions-heading" className="flex flex-col gap-4">
        <h2 id="sessions-heading" className="text-label">
          Devices
        </h2>
        <p className="max-w-lg text-sm text-ink-soft">
          Lost a phone or signed in on a shared computer? Sign out on every device, including this
          one.
        </p>
        <SignOutEverywhereButton />
      </section>
    </div>
  );
}
