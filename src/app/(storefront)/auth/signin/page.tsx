import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { Skeleton } from "@/components/primitives";
import { brand } from "@/config/brand";

/** Sign-in pages are never indexed. */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

async function Form({ searchParams }: PageProps<"/auth/signin">) {
  const { next, reset } = await searchParams;
  const nextPath = typeof next === "string" ? next : null;
  return (
    <>
      <SignInForm
        next={nextPath}
        {...(reset ? { notice: "Password changed. Sign in with your new password." } : {})}
      />
      <p className="mt-8 border-t border-line pt-6 text-sm">
        New to {brand.name}?{" "}
        <NextLink
          href={nextPath ? `/auth/register?next=${encodeURIComponent(nextPath)}` : "/auth/register"}
          className="font-medium underline underline-offset-4"
        >
          Create an account
        </NextLink>
      </p>
    </>
  );
}

/** Sign in with email and password: shoppers, staff and merchants alike. */
export default function Page(props: PageProps<"/auth/signin">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-5xl">Sign in</h1>
        <p className="mt-4 text-ink-soft">Sign in to your {brand.name} account.</p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-72" />}>
            <Form {...props} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
