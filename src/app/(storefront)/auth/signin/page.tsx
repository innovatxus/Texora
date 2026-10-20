import type { Metadata } from "next";
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
  const { next } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : null} />;
}

/**
 * Sign in with email and password. Staff use it to reach the back office;
 * customer registration and account pages arrive in the final phase (D-050).
 */
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
