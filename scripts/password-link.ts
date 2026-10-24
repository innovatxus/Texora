/**
 * Prints a one-time link to set a new password for an existing account, for
 * when email isn't connected yet (a staging deployment) and "Forgot password"
 * can't reach the inbox. Open the link yourself; it works once and expires
 * within an hour. Nothing changes until the link is used.
 *
 *   npm run password-link -- you@example.com
 *
 * Uses FIREBASE_SERVICE_ACCOUNT and NEXT_PUBLIC_SITE_URL from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  loadEnvConfig(process.cwd());
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@"))
    throw new Error("Usage: npm run password-link -- you@example.com");
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in .env.local");
  const account = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
    projectId: account.project_id,
  });
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const link = await auth.generatePasswordResetLink(
    email,
    site?.startsWith("https://") ? { url: new URL("/auth/signin", site).toString() } : undefined,
  );
  console.log(`\nAccount: ${user.email} (project ${account.project_id})`);
  console.log("Open this link to choose a new password (one use, expires within an hour):\n");
  console.log(link);
  console.log("\nKeep it private: anyone with the link can set the password.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
