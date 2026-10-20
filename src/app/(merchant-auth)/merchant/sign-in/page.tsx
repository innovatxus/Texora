import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { MerchantSignInForm } from "@/components/merchant/auth/MerchantSignInForm";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Skeleton } from "@/components/primitives";

export const metadata: Metadata = { title: "Merchant sign in" };

async function Form({ searchParams }: PageProps<"/merchant/sign-in">) {
  const { next, reset } = await searchParams;
  return (
    <>
      {reset === "1" && (
        <div className="mb-6">
          <FormMessage tone="success">
            Password changed. Sign in with your new password.
          </FormMessage>
        </div>
      )}
      <MerchantSignInForm next={typeof next === "string" ? next : null} />
    </>
  );
}

/** `/merchant/sign-in`: email or username plus password (journey §3). */
export default function Page(props: PageProps<"/merchant/sign-in">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl lg:text-5xl">Merchant sign in</h1>
        <p className="mt-4 text-ink-soft">Manage your shop, products and orders.</p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <Form {...props} />
          </Suspense>
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          New here?{" "}
          <NextLink href="/merchant/register" className="text-ink underline underline-offset-4">
            Open your shop
          </NextLink>
        </p>
      </div>
    </div>
  );
}
