"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { PasswordStrength } from "@/components/merchant/onboarding/PasswordStrength";
import { Button, Checkbox, Input } from "@/components/primitives";
import {
  registerCustomerAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/account/actions/auth";
import {
  customerForgotPasswordSchema,
  customerRegisterSchema,
  customerResetPasswordSchema,
} from "@/lib/validation/account";

type Failure = { message: string; fieldErrors?: Record<string, string[] | undefined> };

/** Server field errors go on their fields; anything else is a form-level message. */
function fieldOrForm<K extends string>(
  error: Failure,
  fields: readonly K[],
  set: (field: K, message: string) => void,
): string | null {
  let placed = false;
  for (const f of fields) {
    const message = error.fieldErrors?.[f]?.[0];
    if (message) {
      set(f, message);
      placed = true;
    }
  }
  return placed ? null : error.message;
}

const REGISTER_IDS = {
  firstName: "register-first-name",
  lastName: "register-last-name",
  email: "register-email",
  password: "register-password",
} as const;
type RegisterField = keyof typeof REGISTER_IDS;

/** Customer sign-up: name, email, password, and opt-ins for rewards and email. */
export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof customerRegisterSchema>>({
    resolver: zodResolver(customerRegisterSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      joinRewards: true,
      marketingEmail: false,
      ...(next ? { next } : {}),
    },
  });
  const [email = "", firstName = "", lastName = "", password = ""] = useWatch({
    control,
    name: ["email", "firstName", "lastName", "password"],
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await registerCustomerAction(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
        return;
      }
      setSubmitted(true);
      setFormError(
        fieldOrForm<RegisterField>(
          result.error,
          ["firstName", "lastName", "email", "password"],
          (f, message) => setError(f, { message }),
        ),
      );
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (Object.keys(REGISTER_IDS) as RegisterField[])
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: REGISTER_IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={summary} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id={REGISTER_IDS.firstName}
          label="First name"
          autoComplete="given-name"
          required
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          id={REGISTER_IDS.lastName}
          label="Last name"
          autoComplete="family-name"
          required
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      <Input
        id={REGISTER_IDS.email}
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        id={REGISTER_IDS.password}
        label="Password"
        autoComplete="new-password"
        required
        hint="At least 12 characters. A short phrase is easiest to remember."
        error={errors.password?.message}
        meterId="register-password-strength"
        meter={
          <PasswordStrength
            id="register-password-strength"
            password={password}
            userInputs={[email, firstName, lastName]}
          />
        }
        {...register("password")}
      />
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Options</legend>
        <Checkbox
          id="register-rewards"
          label="Join rewards"
          hint="Earn points on every purchase and spend them at checkout. Free."
          {...register("joinRewards")}
        />
        <Checkbox
          id="register-marketing"
          label="Email me about new arrivals and offers"
          hint="You can change this any time in your account."
          {...register("marketingEmail")}
        />
      </fieldset>
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

/** Asks for a reset link; the confirmation never reveals whether the account exists. */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof customerForgotPasswordSchema>>({
    resolver: zodResolver(customerForgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await requestPasswordResetAction(values);
      if (result.ok) setSentTo(result.data.email);
      else setFormError(result.error.message);
    },
    () => setSubmitted(true),
  );

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p>
          If there&apos;s an account for <strong>{sentTo}</strong>, a reset link is on its way. It
          expires in 1 hour.
        </p>
        <NextLink href="/auth/signin" className="self-start underline underline-offset-4">
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
  } = useForm<z.input<typeof customerResetPasswordSchema>>({
    resolver: zodResolver(customerResetPasswordSchema),
    mode: "onTouched",
    defaultValues: { oobCode, password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await resetPasswordAction(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        return;
      }
      setSubmitted(true);
      setFormError(
        fieldOrForm(result.error, ["password"] as const, (f, message) => setError(f, { message })),
      );
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
