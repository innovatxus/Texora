"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import type { z } from "zod";
import { Button, Checkbox, Input } from "@/components/primitives";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { PasswordStrength } from "@/components/merchant/onboarding/PasswordStrength";
import {
  UsernameField,
  type UsernameAvailability,
} from "@/components/merchant/onboarding/UsernameField";
import type { ActionResult } from "@/lib/actions/run-action";
import { registerMerchantAction, upgradeToMerchantAction } from "@/lib/merchant/actions/account";
import { merchantRegisterSchema, merchantUpgradeSchema } from "@/lib/validation/merchant";

const TERMS_LABEL = (
  <>
    I agree to the{" "}
    <NextLink href="/help/merchants/terms" className="underline underline-offset-4">
      Merchant terms
    </NextLink>
    .
  </>
);

/** Field ids, so the error summary can link to each control. */
const IDS = {
  email: "register-email",
  username: "register-username",
  password: "register-password",
  confirmPassword: "register-confirm",
  acceptTerms: "register-terms",
} as const;

type RegisterValues = z.input<typeof merchantRegisterSchema>;
type UpgradeValues = z.input<typeof merchantUpgradeSchema>;

function summaryOf<T extends Record<string, unknown>>(errors: FieldErrors<T>) {
  return (Object.keys(IDS) as Array<keyof typeof IDS>)
    .filter((key) => errors[key as keyof T]?.message)
    .map((key) => ({
      fieldId: IDS[key],
      message: String(errors[key as keyof T]?.message),
    }));
}

/** Whether the last availability answer says the current username is taken. */
function isTaken(answer: UsernameAvailability | null, username: string): boolean {
  return answer !== null && answer.username === username.trim().toLowerCase() && !answer.available;
}

/** Applies server field errors to the form; returns the form-level message, if any. */
function applyServerErrors<T extends Record<string, unknown>>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  setError: (name: Path<T>, error: { message: string }) => void,
): string | null {
  const fields = result.error.fieldErrors ?? {};
  for (const [name, messages] of Object.entries(fields)) {
    if (name in IDS && messages[0]) setError(name as Path<T>, { message: messages[0] });
  }
  return result.error.code === "validation" && Object.keys(fields).length > 0
    ? null
    : result.error.message;
}

/** New merchant registration: email, username, password with meter, terms. */
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(merchantRegisterSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  const [email = "", username = "", password = ""] = useWatch({
    control,
    name: ["email", "username", "password"],
  });
  const onAvailability = useCallback((r: UsernameAvailability) => setAvailability(r), []);
  const usernameTaken = isTaken(availability, username);

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      if (usernameTaken) {
        setError("username", { message: "That username is taken" });
        return;
      }
      const result = await registerMerchantAction(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
        return;
      }
      setSubmitted(true);
      setFormError(applyServerErrors<RegisterValues>(result, setError));
    },
    () => setSubmitted(true),
  );

  const summary = submitted ? summaryOf(errors) : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={summary} />
      <Input
        id={IDS.email}
        label="Email"
        type="email"
        autoComplete="email"
        required
        hint="We'll send a verification link here."
        error={errors.email?.message}
        {...register("email")}
      />
      <UsernameField
        id={IDS.username}
        required
        value={username}
        error={errors.username?.message}
        onAvailability={onAvailability}
        {...register("username")}
      />
      <PasswordField
        id={IDS.password}
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
            userInputs={[email, username]}
          />
        }
        {...register("password")}
      />
      <PasswordField
        id={IDS.confirmPassword}
        label="Confirm password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Checkbox
        id={IDS.acceptTerms}
        label={TERMS_LABEL}
        error={errors.acceptTerms?.message}
        {...register("acceptTerms")}
      />
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Creating your account…" : "Create merchant account"}
      </Button>
    </form>
  );
}

/** Signed-in shoppers add a shop to their existing account: username and terms only. */
export function UpgradeForm({ email }: { email: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpgradeValues>({
    resolver: zodResolver(merchantUpgradeSchema),
    mode: "onTouched",
    defaultValues: { username: "", acceptTerms: false as unknown as true },
  });

  const username = useWatch({ control, name: "username" }) ?? "";
  const onAvailability = useCallback((r: UsernameAvailability) => setAvailability(r), []);
  const usernameTaken = isTaken(availability, username);

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      if (usernameTaken) {
        setError("username", { message: "That username is taken" });
        return;
      }
      const result = await upgradeToMerchantAction(values);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
        return;
      }
      setSubmitted(true);
      setFormError(applyServerErrors<UpgradeValues>(result, setError));
    },
    () => setSubmitted(true),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <ErrorSummary errors={submitted ? summaryOf(errors) : []} />
      <p className="text-sm text-ink-soft">
        Signed in as <strong className="text-ink">{email}</strong>
      </p>
      <UsernameField
        id={IDS.username}
        required
        value={username}
        error={errors.username?.message}
        onAvailability={onAvailability}
        {...register("username")}
      />
      <Checkbox
        id={IDS.acceptTerms}
        label={TERMS_LABEL}
        error={errors.acceptTerms?.message}
        {...register("acceptTerms")}
      />
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" size="lg" loading={isSubmitting}>
        Become a merchant
      </Button>
    </form>
  );
}
