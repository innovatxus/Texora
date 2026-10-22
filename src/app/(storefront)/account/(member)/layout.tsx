import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountNav } from "@/components/account/AccountNav";
import { PreferencesSync } from "@/components/account/PreferencesForms";
import { SignOutLink } from "@/components/account/SignOutLink";
import { Skeleton } from "@/components/primitives";
import { getAccountUser } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";

/** Account pages are private: never indexed. */
export const metadata: Metadata = {
  title: { template: "%s · Your account", default: "Your account" },
  robots: { index: false, follow: false },
};

async function Greeting() {
  // The proxy gates /account; this re-checks the live session.
  const session = await getSession();
  if (!session || session.role === "guest") redirect("/auth/signin?next=/account");
  const user = await getAccountUser(session.uid);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-label text-ink-subtle">Your account</p>
        <p className="mt-2 font-display text-4xl">
          {user?.firstName ? `Hello, ${user.firstName}` : "Hello"}
        </p>
      </div>
      <SignOutLink />
      {user && (
        <PreferencesSync
          fitFamily={user.preferences.fitFamily ?? null}
          savedSizes={user.savedSizes}
        />
      )}
    </div>
  );
}

/** Account shell: greeting, section menu and the section itself (spec 7.8). */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="container-page pt-10 pb-24">
      <Suspense fallback={<Skeleton className="h-16 w-72" />}>
        <Greeting />
      </Suspense>
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <AccountNav />
        <div className="min-w-0">
          {/* Every account page reads the session at request time. */}
          <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
