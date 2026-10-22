"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type FieldValues,
  type Path,
  type UseFormSetError,
  useForm,
  useWatch,
} from "react-hook-form";
import type { z } from "zod";
import { Button, Checkbox, Input } from "@/components/primitives";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { PasswordField } from "@/components/merchant/onboarding/PasswordField";
import { PasswordStrength } from "@/components/merchant/onboarding/PasswordStrength";
import {
  changePasswordAction,
  signOutEverywhereAction,
  updateAccountAction,
  updateNotificationsAction,
} from "@/lib/merchant/actions/settings";
import {
  merchantAccountSettingsSchema,
  merchantChangePasswordSchema,
  merchantNotificationSettingsSchema,
} from "@/lib/validation/merchant";

type ActionFailure = { message: string; fieldErrors?: Record<string, string[] | undefined> };

/** Puts server field errors on their fields; returns the form-level message, if any. */
function applyServerErrors<T extends FieldValues>(
  error: ActionFailure,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string | null {
  let placed = false;
  for (const field of fields) {
    const message = error.fieldErrors?.[field]?.[0];
    if (message) {
      setError(field, { message });
      placed = true;
    }
  }
  return placed ? null : error.message;
}

const ACCOUNT_IDS = {
  displayName: "settings-display-name",
  email: "settings-email",
  username: "settings-username",
} as const;

type AccountValues = z.input<typeof merchantAccountSettingsSchema>;

/** Settings › Account. */
export function AccountForm({
  defaults,
  usernameNote,
}: {
  defaults: AccountValues;
  /** When the username can next change, if it's locked. */
  usernameNote?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(merchantAccountSettingsSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setStatus(null);
      const result = await updateAccountAction(values);
      if (result.ok) {
        const emailChanged = values.email.trim().toLowerCase() !== defaults.email;
        setStatus({
          tone: "success",
          text: emailChanged
            ? `Saved. We sent a verification link to ${values.email.trim().toLowerCase()}.`
            : "Saved.",
        });
        router.refresh();
        return;
      }
      setSubmitted(true);
      const message = applyServerErrors(
        result.error,
        ["displayName", "email", "username"],
        setError,
      );
      if (message) setStatus({ tone: "error", text: message });
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (["displayName", "email", "username"] as const)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: ACCOUNT_IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-6">
      <ErrorSummary errors={summary} />
      <Input
        id={ACCOUNT_IDS.displayName}
        label="Display name"
        autoComplete="name"
        required
        hint="Shown in the portal and to the Texora team. Shoppers see your shop name."
        error={errors.displayName?.message}
        {...register("displayName")}
      />
      <Input
        id={ACCOUNT_IDS.email}
        label="Email"
        type="email"
        autoComplete="email"
        required
        hint="If you change it, you'll need to verify the new address before submitting or publishing."
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        id={ACCOUNT_IDS.username}
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        hint={usernameNote ?? "You can change your username once every 30 days."}
        error={errors.username?.message}
        {...register("username")}
      />
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={isSubmitting}>
        Save changes
      </Button>
    </form>
  );
}

const PASSWORD_IDS = {
  currentPassword: "settings-current-password",
  newPassword: "settings-new-password",
  confirmPassword: "settings-confirm-password",
} as const;

type PasswordValues = z.input<typeof merchantChangePasswordSchema>;

/** Settings › Security: change password. Other devices are signed out. */
export function ChangePasswordForm({ userInputs }: { userInputs: string[] }) {
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(merchantChangePasswordSchema),
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
      const message = applyServerErrors(
        result.error,
        ["currentPassword", "newPassword", "confirmPassword"],
        setError,
      );
      if (message) setStatus({ tone: "error", text: message });
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? (["currentPassword", "newPassword", "confirmPassword"] as const)
        .filter((k) => errors[k]?.message)
        .map((k) => ({ fieldId: PASSWORD_IDS[k], message: errors[k]?.message ?? "" }))
    : [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-6">
      <ErrorSummary errors={summary} />
      <PasswordField
        id={PASSWORD_IDS.currentPassword}
        label="Current password"
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        id={PASSWORD_IDS.newPassword}
        label="New password"
        autoComplete="new-password"
        required
        hint="At least 12 characters. A short phrase is easiest to remember."
        error={errors.newPassword?.message}
        meterId="settings-password-strength"
        meter={
          <PasswordStrength
            id="settings-password-strength"
            password={newPassword}
            userInputs={userInputs}
          />
        }
        {...register("newPassword")}
      />
      <PasswordField
        id={PASSWORD_IDS.confirmPassword}
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

/** Settings › Security: signs out of every device, this one included. */
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
            router.replace(result.data.redirectTo);
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

type NotificationValues = z.input<typeof merchantNotificationSettingsSchema>;

/** Settings › Notifications. Shop status emails are always sent. */
export function NotificationsForm({ defaults }: { defaults: NotificationValues }) {
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NotificationValues>({
    resolver: zodResolver(merchantNotificationSettingsSchema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    const result = await updateNotificationsAction(values);
    setStatus(
      result.ok
        ? { tone: "success", text: "Saved." }
        : { tone: "error", text: result.error.message },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-label">Email me when</legend>
        <Checkbox
          id="notify-new-orders"
          label="A shopper orders one of my products"
          hint="Includes what to ship and where."
          {...register("newOrders")}
        />
        <Checkbox
          id="notify-product-reviews"
          label="Texora reviews a product I submitted"
          hint="Whether it's live or needs changes. You'll also see this on the product."
          {...register("productReviews")}
        />
        <Checkbox
          id="notify-shop-status"
          label="My shop is approved, needs changes or is suspended"
          hint="Always on: these affect whether your shop can sell."
          checked
          disabled
          readOnly
        />
      </fieldset>
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={isSubmitting}>
        Save preferences
      </Button>
    </form>
  );
}
