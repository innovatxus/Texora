import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/AccountForms";
import { Skeleton } from "@/components/primitives";
import { checkResetCode } from "@/lib/account/auth-service";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

function Expired() {
  return (
    <p role="alert" className="text-lg">
      That reset link has expired.{" "}
      <NextLink href="/auth/forgot-password" className="underline underline-offset-4">
        Request a new one
      </NextLink>
      .
    </p>
  );
}

async function Content({ searchParams }: PageProps<"/auth/reset-password">) {
  const { oobCode } = await searchParams;
  if (typeof oobCode !== "string" || !oobCode) return <Expired />;
  // Checking the code doesn't use it up, so rendering (or prefetching) is safe.
  if (!(await checkResetCode(oobCode))) return <Expired />;
  return <ResetPasswordForm oobCode={oobCode} />;
}

/** `/auth/reset-password?oobCode=…`: choose a new password from the emailed link. */
export default function Page(props: PageProps<"/auth/reset-password">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-5xl">Choose a new password</h1>
        <p className="mt-4 text-ink-soft">You&apos;ll be signed out on every device.</p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-72" />}>
            <Content {...props} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
