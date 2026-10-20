import type { Metadata } from "next";
import NextLink from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm, UpgradeForm } from "@/components/merchant/auth/RegisterForm";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Skeleton } from "@/components/primitives";
import { brand } from "@/config/brand";
import { isStaffRole } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";

export const metadata: Metadata = { title: "Open your shop" };

/** Picks the form for whoever is visiting: new merchant, shopper upgrading, or neither. */
async function RegisterContent() {
  // The session read marks this request-time, so it goes first.
  const session = await getSession();
  const settings = await getStoreSettings();

  if (session?.role === "vendor") redirect("/merchant");

  if (!settings.features.vendorMarketplace) {
    return (
      <p role="status" className="text-lg">
        Merchant registration is paused. Check back soon or contact merchant support at{" "}
        {brand.support.email}.
      </p>
    );
  }

  if (session && isStaffRole(session.role)) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p>Staff accounts can&apos;t open a shop. Sign out and register with a different email.</p>
        <SignOutButton />
      </div>
    );
  }

  if (session) {
    return (
      <>
        <h1 className="font-display text-4xl lg:text-5xl">Add a shop to your account</h1>
        <p className="mt-4 text-ink-soft">
          Choose a username for your merchant account. You&apos;ll keep shopping with the same
          sign-in.
        </p>
        <div className="mt-8">
          <UpgradeForm email={session.email ?? ""} />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-4xl lg:text-5xl">Open your shop</h1>
      <p className="mt-4 text-ink-soft">
        Create your merchant account. Next you&apos;ll set up your shop: branding, locations and
        policies.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-8 text-sm text-ink-soft">
        Already have a merchant account?{" "}
        <NextLink href="/merchant/sign-in" className="text-ink underline underline-offset-4">
          Sign in
        </NextLink>
        . Shopping with {brand.name} already?{" "}
        <NextLink
          href="/merchant/sign-in?next=/merchant/register"
          className="text-ink underline underline-offset-4"
        >
          Sign in first
        </NextLink>{" "}
        to add a shop to that account.
      </p>
    </>
  );
}

/** `/merchant/register`: new merchant accounts, and shoppers adding a shop (journey §2). */
export default function Page() {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-lg">
        <Suspense fallback={<Skeleton className="h-[36rem]" />}>
          <RegisterContent />
        </Suspense>
      </div>
    </div>
  );
}
