import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/merchant/auth/RecoveryForms";

export const metadata: Metadata = { title: "Forgot password" };

/** `/merchant/forgot-password`: request a reset link (journey §5). */
export default function Page() {
  return (
    <div className="container-page flex justify-center pt-12 pb-24">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl lg:text-5xl">Forgot your password?</h1>
        <p className="mt-4 text-ink-soft">
          Enter your account email and we&apos;ll send you a link to choose a new one.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
