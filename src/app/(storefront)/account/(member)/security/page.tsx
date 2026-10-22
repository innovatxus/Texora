import type { Metadata } from "next";
import {
  ChangePasswordForm,
  DeleteAccountForm,
  SignOutEverywhereButton,
} from "@/components/account/SecurityForms";
import { getAccountUser } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Security" };

/** Password, devices, data export and account deletion. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const user = await getAccountUser(session.uid);
  const canDelete = session.role === "customer" || session.role === "loyalty_member";

  return (
    <div className="flex flex-col gap-12">
      <h1 className="font-display text-4xl">Security</h1>
      <section aria-labelledby="password" className="flex flex-col gap-4">
        <h2 id="password" className="text-label">
          Change password
        </h2>
        <ChangePasswordForm email={user?.email ?? ""} />
      </section>

      <section aria-labelledby="devices" className="flex flex-col gap-4">
        <h2 id="devices" className="text-label">
          Devices
        </h2>
        <p className="max-w-prose text-sm text-ink-soft">
          Signed in on a shared computer, or lost a phone? Sign out on every device, including this
          one.
        </p>
        <SignOutEverywhereButton />
      </section>

      <section aria-labelledby="data" className="flex flex-col gap-4">
        <h2 id="data" className="text-label">
          Your data
        </h2>
        <p className="max-w-prose text-sm text-ink-soft">
          Download everything we hold about you: profile, addresses, wishlist, orders, returns and
          rewards history, as a JSON file.
        </p>
        <a
          href="/account/export"
          download
          className="inline-flex min-h-11 items-center self-start border border-ink px-5 text-sm font-medium tracking-wide uppercase hover:bg-ink hover:text-surface"
        >
          Download my data
        </a>
      </section>

      <section aria-labelledby="delete" className="flex flex-col gap-4">
        <h2 id="delete" className="text-label">
          Delete account
        </h2>
        {canDelete ? (
          <>
            <p className="max-w-prose text-sm text-ink-soft">
              This removes your sign-in, profile, addresses, wishlist, saved bag and rewards points.
              It can&apos;t be undone. We keep order and return records as the law requires, without
              linking them to a profile.
            </p>
            <DeleteAccountForm />
          </>
        ) : (
          <p className="max-w-prose text-sm text-ink-soft">
            Staff and merchant accounts are closed by an administrator. Contact support.
          </p>
        )}
      </section>
    </div>
  );
}
