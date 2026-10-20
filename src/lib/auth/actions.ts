"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { safeNextPath } from "./access";
import { isStaffRole } from "./rbac";
import { createSession, destroySession, SessionError } from "./session";

const signInSchema = z.object({
  idToken: z.string().min(1).max(4096),
  next: z.string().max(2048).optional(),
});

/**
 * Called by the sign-in form after Firebase client auth succeeds. Exchanges
 * the ID token for a session cookie; returns where to go next (same-site only).
 */
export async function signInWithIdToken(input: unknown) {
  return runAction(input, {
    schema: signInSchema,
    access: { public: true },
    handler: async ({ idToken, next }) => {
      try {
        const session = await createSession(idToken);
        // Staff land in the back office; customers go home until account pages exist (D-050).
        const fallback = isStaffRole(session.role) ? "/admin" : "/";
        return { role: session.role, redirectTo: safeNextPath(next, fallback) };
      } catch (error) {
        if (error instanceof SessionError) throw new ActionError("unauthenticated", error.message);
        throw error;
      }
    },
  });
}

const signOutSchema = z.object({ everywhere: z.boolean().optional() });

/** Ends the session on this device, or on every device when asked. */
export async function signOut(input: unknown) {
  return runAction(input, {
    schema: signOutSchema,
    access: { public: true },
    handler: async ({ everywhere }) => {
      await destroySession({ everywhere: everywhere ?? false });
      return { redirectTo: "/" };
    },
  });
}
