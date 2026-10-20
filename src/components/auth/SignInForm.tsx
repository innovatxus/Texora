"use client";

import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut as clientSignOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/primitives";
import { signInWithIdToken } from "@/lib/auth/actions";
import { getFirebaseClient } from "@/lib/firebase/client";

/** Firebase errors in plain words; wrong email and wrong password share one message. */
function message(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/network-request-failed") return "We couldn't connect. Check your connection.";
  return "That email and password don't match. Check them and try again.";
}

/**
 * Email + password sign-in. Firebase verifies the password in the browser;
 * the resulting ID token is exchanged for an HTTP-only session cookie and
 * the client-side Firebase session is dropped again.
 */
export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { auth } = getFirebaseClient();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();
      const result = await signInWithIdToken({ idToken, ...(next ? { next } : {}) });
      // The server session is the source of truth from here on.
      await clientSignOut(auth);
      if (!result.ok) {
        setError(result.error.message);
        setPending(false);
        return;
      }
      router.replace(result.data.redirectTo);
      router.refresh();
    } catch (err) {
      setError(message(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input
        id="signin-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="signin-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
