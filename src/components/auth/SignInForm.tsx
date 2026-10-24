"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { Button, Input } from "@/components/primitives";
import { signInCustomerAction, signInStaffAction } from "@/lib/account/actions/auth";
import { customerSignInSchema } from "@/lib/validation/account";

const IDS = { email: "signin-email", password: "signin-password" } as const;

/**
 * Email and password sign-in, checked on the server (rate-limited, with a
 * per-account lockout) and exchanged for an HTTP-only session cookie. With
 * `staff`, it is the back office sign-in: only team accounts get a session.
 */
export function SignInForm({
  next,
  notice,
  staff = false,
}: {
  next: string | null;
  notice?: string;
  staff?: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof customerSignInSchema>>({
    resolver: zodResolver(customerSignInSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", ...(next ? { next } : {}) },
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await (staff ? signInStaffAction : signInCustomerAction)(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
        return;
      }
      setFormError(result.error.message);
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (["email", "password"] as const)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      <ErrorSummary errors={summary} />
      <Input
        id={IDS.email}
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        id={IDS.password}
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <NextLink
        href="/auth/forgot-password"
        className="-mt-3 self-start text-sm underline underline-offset-4"
      >
        Forgot your password?
      </NextLink>
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
