import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ResendVerificationButton,
  VerifyEmailRunner,
} from "@/components/merchant/auth/VerifyEmail";
import { ButtonLink, Skeleton } from "@/components/primitives";
import { getSession } from "@/lib/auth/session";
import { getMerchant } from "@/lib/merchant/repositories/merchants";

export const metadata: Metadata = { title: "Verify your email" };

async function Content({ searchParams }: PageProps<"/merchant/verify-email">) {
  const [{ oobCode }, session] = await Promise.all([searchParams, getSession()]);
  const signedIn = session?.role === "vendor";

  if (typeof oobCode === "string" && oobCode) {
    return <VerifyEmailRunner oobCode={oobCode} signedIn={signedIn} />;
  }

  // Opened without a code: explain, and let a signed-in merchant resend.
  const merchant = signedIn && session.vendorId ? await getMerchant(session.vendorId) : null;
  if (merchant?.emailVerified) {
    return (
      <div role="status" className="flex flex-col items-start gap-6">
        <p className="text-lg">Your email is already verified.</p>
        <ButtonLink href="/merchant" size="lg">
          Go to your dashboard
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-6">
      <p className="text-lg">
        {merchant
          ? `We sent a verification link to ${merchant.email}. Open it on any device.`
          : "Open the verification link from your email to finish."}
      </p>
      {merchant && <ResendVerificationButton />}
    </div>
  );
}

/** `/merchant/verify-email?oobCode=…` (journey §4). */
export default function Page(props: PageProps<"/merchant/verify-email">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl lg:text-5xl">Verify your email</h1>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-32" />}>
            <Content {...props} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
