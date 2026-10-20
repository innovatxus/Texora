"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button, Input } from "@/components/primitives";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { PasswordStrength } from "@/components/merchant/onboarding/PasswordStrength";
import {
  requestMerchantPasswordResetAction,
  resetMerchantPasswordAction,
} from "@/lib/merchant/actions/account";
import {
  merchantForgotPasswordSchema,
  merchantResetPasswordSchema,
} from "@/lib/validation/merchant";

/** Asks for a reset link; the confirmation never reveals whether the account exists. */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof merchantForgotPasswordSchema>>({
    resolver: zodResolver(merchantForgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await requestMerchantPasswordResetAction(values);
      if (result.ok) setSentTo(result.data.email);
      else setFormError(result.error.message);
    },
    () => setSubmitted(true),
  );

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p>
          If there&apos;s a merchant account for <strong>{sentTo}</strong>, a reset link is on its
          way. It expires in 1 hour.
        </p>
        <NextLink href="/merchant/sign-in" className="self-start underline underline-offset-4">
          Back to sign in
        </NextLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary
        errors={
          submitted && errors.email?.message
            ? [{ fieldId: "forgot-email", message: errors.email.message }]
            : []
        }
      />
      <Input
        id="forgot-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

const RESET_IDS = { password: "reset-password", confirmPassword: "reset-confirm" } as const;

/** Chooses a new password from a reset link. */
export function ResetPasswordForm({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof merchantResetPasswordSchema>>({
    resolver: zodResolver(merchantResetPasswordSchema),
    mode: "onTouched",
    defaultValues: { oobCode, password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await resetMerchantPasswordAction(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        return;
      }
      const fieldMessage = result.error.fieldErrors?.password?.[0];
      if (fieldMessage) {
        setSubmitted(true);
        setError("password", { message: fieldMessage });
      } else {
        setFormError(result.error.message);
      }
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (["password", "confirmPassword"] as const)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: RESET_IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={summary} />
      <input type="hidden" {...register("oobCode")} />
      <PasswordField
        id={RESET_IDS.password}
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 12 characters. A short phrase is easiest to remember."
        error={errors.password?.message}
        meterId="reset-password-strength"
        meter={
          <PasswordStrength id="reset-password-strength" password={password} userInputs={[]} />
        }
        {...register("password")}
      />
      <PasswordField
        id={RESET_IDS.confirmPassword}
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        Set new password
      </Button>
    </form>
  );
}
