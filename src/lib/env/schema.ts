import { z } from "zod";

/**
 * Environment schemas. Kept free of `process.env` access so they can be unit
 * tested and shared between the client and server entry points.
 */

/** Public environment variables (safe in the browser bundle). */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: z.stringbool().default(false),
  NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: z.string().min(1).default("127.0.0.1"),
  /** Enables card payments (Stripe Elements). Omit to offer only Cash on Delivery. */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.email(),
  private_key: z.string().min(1),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

/** Server-only environment variables; some are required in production. */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_STORAGE_BUCKET: z.string().min(1),
    /** Base64-encoded service-account JSON. Required unless using emulators. */
    FIREBASE_SERVICE_ACCOUNT: z
      .string()
      .min(1)
      .transform((value, ctx) => {
        try {
          const json: unknown = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
          return serviceAccountSchema.parse(json);
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "FIREBASE_SERVICE_ACCOUNT must be base64-encoded service-account JSON",
          });
          return z.NEVER;
        }
      })
      .optional(),
    USE_FIREBASE_EMULATORS: z.stringbool().default(false),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
    FIREBASE_STORAGE_EMULATOR_HOST: z.string().min(1).optional(),
    /** Serves the internal /styleguide route. Never enable on a public deployment. */
    ENABLE_STYLEGUIDE: z.stringbool().default(false),
    /** Signs guest order-confirmation links. At least 32 random characters. */
    ORDER_TOKEN_SECRET: z.string().min(32),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    /** Transactional email via Resend; without it, mail goes to the Firestore outbox (dev only). */
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    EMAIL_FROM: z.string().min(3).default("Texora <orders@texora.test>"),
    /** Shared secret for scheduled maintenance calls (reservation release). */
    CRON_SECRET: z.string().min(32).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.USE_FIREBASE_EMULATORS) {
      for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when USE_FIREBASE_EMULATORS=true`,
          });
        }
      }
      return;
    }
    if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required in production when emulators are off",
      });
    }
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "STRIPE_WEBHOOK_SECRET is required when Stripe is enabled",
      });
    }
    if (env.NODE_ENV === "production" && !env.FIREBASE_SERVICE_ACCOUNT) {
      ctx.addIssue({
        code: "custom",
        path: ["FIREBASE_SERVICE_ACCOUNT"],
        message: "FIREBASE_SERVICE_ACCOUNT is required in production when emulators are off",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parse an env source and throw a readable, aggregated error on failure. */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
  label: string,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment variables:\n${details}`);
  }
  return result.data;
}
