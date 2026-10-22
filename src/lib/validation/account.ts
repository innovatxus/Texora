/**
 * Customer account forms: sign-up, sign-in, recovery, profile, addresses,
 * preferences and security. Shared by the browser forms and the Server
 * Actions, so both give the same messages.
 */
import { z } from "zod";
import { PASSWORD_MAX_LENGTH, passwordProblem } from "@/lib/auth/password";
import { addressSchema, fitFamilySchema, sizeTypeSchema } from "./common";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address like name@example.com").max(254));

const name = (label: string) =>
  z.string().trim().min(1, `Enter your ${label}`).max(60, `Use 60 characters or fewer`);

const newPassword = z
  .string()
  .min(1, "Enter a password")
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`);

/** Lets password checks run alongside other field errors. */
const always = (payload: { value: unknown }) =>
  typeof payload.value === "object" && payload.value !== null;

export const customerRegisterSchema = z
  .object({
    firstName: name("first name"),
    lastName: name("last name"),
    email,
    password: newPassword,
    marketingEmail: z.boolean().default(false),
    joinRewards: z.boolean().default(true),
    next: z.string().max(500).optional(),
  })
  .superRefine(
    (value, ctx) => {
      if (typeof value.password !== "string" || !value.password) return;
      const problem = passwordProblem(value.password, [
        typeof value.email === "string" ? value.email : "",
        typeof value.firstName === "string" ? value.firstName : "",
        typeof value.lastName === "string" ? value.lastName : "",
      ]);
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    },
    { when: always },
  );
export type CustomerRegisterInput = z.input<typeof customerRegisterSchema>;

export const customerSignInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
  next: z.string().max(500).optional(),
});

export const customerForgotPasswordSchema = z.object({ email });

export const customerResetPasswordSchema = z
  .object({
    oobCode: z.string().min(1).max(2000),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .superRefine(
    (value, ctx) => {
      if (typeof value.password !== "string" || !value.password) return;
      const problem = passwordProblem(value.password);
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
      if (value.password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "The passwords don't match",
        });
      }
    },
    { when: always },
  );

export const customerChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(PASSWORD_MAX_LENGTH),
    newPassword,
    confirmPassword: z.string(),
  })
  .superRefine(
    (value, ctx) => {
      if (typeof value.newPassword !== "string" || !value.newPassword) return;
      const problem = passwordProblem(value.newPassword);
      if (problem) ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
      if (value.newPassword !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "The passwords don't match",
        });
      }
    },
    { when: always },
  );

/** Name and phone on the profile. */
export const profileDetailsSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  phone: z.string().trim().max(30, "Use 30 characters or fewer").optional(),
});

/** An address as entered in the account (the server assigns the id). */
export const addressInputSchema = addressSchema.extend({
  id: z.string().max(128).optional(),
  label: z.string().trim().max(40, "Use 40 characters or fewer").optional(),
  isDefaultShipping: z.boolean().default(false),
  isDefaultBilling: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressInputSchema>;

/** Fit family and preferred sizes, used to pre-select on product pages. */
export const sizePreferencesSchema = z.object({
  fitFamily: fitFamilySchema.optional(),
  savedSizes: z.partialRecord(sizeTypeSchema, z.string().trim().max(16)),
});

export const communicationPreferencesSchema = z.object({
  marketingEmail: z.boolean(),
  marketingSms: z.boolean(),
});

/** Deleting an account asks for the password and a typed confirmation. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
});
