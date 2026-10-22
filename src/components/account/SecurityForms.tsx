"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { PasswordStrength } from "@/components/merchant/onboarding/PasswordStrength";
import { Button, Input } from "@/components/primitives";
import {
  changePasswordAction,
  deleteAccountAction,
  signOutEverywhereAction,
} from "@/lib/account/actions/account";
import { customerChangePasswordSchema, deleteAccountSchema } from "@/lib/validation/account";
import { usePreferencesStore } from "@/stores/preferences";
import { useWishlistStore } from "@/stores/wishlist";

const PW_IDS = {
  currentPassword: "security-current",
  newPassword: "security-new",
  confirmPassword: "security-confirm",
} as const;
type PwValues = z.input<typeof customerChangePasswordSchema>;

/** Change password: other devices are signed out, this one stays signed in. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PwValues>({
    resolver: zodResolver(customerChangePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";

  const onSubmit = handleSubmit(
    async (values) => {
      setStatus(null);
      const result = await changePasswordAction(values);
      if (result.ok) {
        reset();
        setSubmitted(false);
        setStatus({
          tone: "success",
          text: "Password changed. You've been signed out on your other devices.",
        });
        return;
      }
      setSubmitted(true);
      let placed = false;
      for (const key of ["currentPassword", "newPassword", "confirmPassword"] as const) {
        const message = result.error.fieldErrors?.[key]?.[0];
        if (message) {
          setError(key, { message });
          placed = true;
        }
      }
      if (!placed) setStatus({ tone: "error", text: result.error.message });
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (Object.keys(PW_IDS) as Array<keyof typeof PW_IDS>)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: PW_IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-6">
      <ErrorSummary errors={summary} />
      <PasswordField
        id={PW_IDS.currentPassword}
        label="Current password"
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        id={PW_IDS.newPassword}
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 12 characters. A short phrase is easiest to remember."
        error={errors.newPassword?.message}
        meterId="security-strength"
        meter={
          <PasswordStrength id="security-strength" password={newPassword} userInputs={[email]} />
        }
        {...register("newPassword")}
      />
      <PasswordField
        id={PW_IDS.confirmPassword}
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}

/** Signs out of every device, this one included. */
export function SignOutEverywhereButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await signOutEverywhereAction({});
          if (result.ok) {
            usePreferencesStore.getState().clear();
            useWishlistStore.setState({ items: [] });
            router.replace(result.data.redirectTo);
            router.refresh();
            return;
          }
          setPending(false);
          setError(result.error.message);
        }}
      >
        Sign out everywhere
      </Button>
      {error && <FormMessage>{error}</FormMessage>}
    </div>
  );
}

type DeleteValues = z.input<typeof deleteAccountSchema>;

/** Permanently deletes the account after the password and a typed confirmation. */
export function DeleteAccountForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteValues>({
    resolver: zodResolver(deleteAccountSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirm: "" as "DELETE" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await deleteAccountAction(values);
    if (result.ok) {
      usePreferencesStore.getState().clear();
      useWishlistStore.setState({ items: [] });
      router.replace(result.data.redirectTo);
      router.refresh();
      return;
    }
    const message = result.error.fieldErrors?.password?.[0];
    if (message) setError("password", { message });
    else setFormError(result.error.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-6">
      <PasswordField
        id="delete-password"
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <Input
        id="delete-confirm"
        label="Type DELETE to confirm"
        autoComplete="off"
        autoCapitalize="characters"
        required
        error={errors.confirm?.message}
        {...register("confirm")}
      />
      {formError && <FormMessage>{formError}</FormMessage>}
      <Button type="submit" className="self-start" loading={isSubmitting}>
        Delete my account
      </Button>
    </form>
  );
}
