"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Input } from "@/components/primitives";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { merchantSignInAction } from "@/lib/merchant/actions/account";
import { merchantSignInSchema } from "@/lib/validation/merchant";

type Values = z.input<typeof merchantSignInSchema>;

const IDS = { identifier: "signin-identifier", password: "signin-password" } as const;

/**
 * Merchant sign-in with email or username. The password is checked on the
 * server, which counts failures and locks the account after five; every
 * wrong-credential case gets the same message.
 */
export function MerchantSignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(merchantSignInSchema),
    mode: "onTouched",
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await merchantSignInAction({ ...values, ...(next ? { next } : {}) });
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
    ? (["identifier", "password"] as const)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={summary} />
      <Input
        id={IDS.identifier}
        label="Email or username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={errors.identifier?.message}
        {...register("identifier")}
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
        href="/merchant/forgot-password"
        className="self-start text-sm underline underline-offset-4"
      >
        Forgot password?
      </NextLink>
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
