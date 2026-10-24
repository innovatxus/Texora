import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { Skeleton } from "@/components/primitives";
import { isStaffRole } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Back office sign in" };

async function Form({ searchParams }: PageProps<"/admin/sign-in">) {
  const [{ next, reset }, session] = await Promise.all([searchParams, getSession()]);
  // Already signed in as a team member: straight to the back office.
  if (session && isStaffRole(session.role)) redirect("/admin");
  return (
    <SignInForm
      staff
      next={typeof next === "string" ? next : null}
      {...(reset === "1" ? { notice: "Password changed. Sign in with your new password." } : {})}
    />
  );
}

/** `/admin/sign-in`: the team's sign-in for the back office (staff roles only). */
export default function Page(props: PageProps<"/admin/sign-in">) {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl lg:text-5xl">Back office sign in</h1>
        <p className="mt-4 text-ink-soft">
          For the Texora team: owners, admins, managers and staff.
        </p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-80" />}>
            <Form {...props} />
          </Suspense>
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          New to the team? Ask an admin to invite you; the invitation email lets you set your
          password.
        </p>
      </div>
    </div>
  );
}
