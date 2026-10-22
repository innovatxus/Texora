import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/AccountForms";
import { Skeleton } from "@/components/primitives";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

async function Form({ searchParams }: PageProps<"/auth/register">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : null;
  return (
    <>
      <RegisterForm next={nextPath} />
      <p className="mt-8 border-t border-line pt-6 text-sm">
        Already have an account?{" "}
        <NextLink
          href={nextPath ? `/auth/signin?next=${encodeURIComponent(nextPath)}` : "/auth/signin"}
          className="font-medium underline underline-offset-4"
        >
          Sign in
        </NextLink>
      </p>
    </>
  );
}

/** Customer sign-up: track orders, save addresses, keep a wishlist and earn rewards. */
export default function Page(props: PageProps<"/auth/register">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-5xl">Create an account</h1>
        <p className="mt-4 text-ink-soft">
          Track orders, start returns, save addresses and earn {brand.name} rewards.
        </p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <Form {...props} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
