"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const subscribeSchema = z.object({
  email: z.email("Enter a valid email address").max(254).toLowerCase(),
  consent: z.literal(true, { error: "Please confirm you'd like to receive emails" }),
  source: z.enum(["footer", "modal", "checkout"]),
});

/**
 * Email signup with explicit consent. Keyed by a hash of the address, so
 * signing up twice is harmless and the id reveals nothing.
 */
export async function subscribe(input: unknown) {
  return runAction(input, {
    schema: subscribeSchema,
    access: { public: true },
    handler: async ({ email, source }) => {
      const id = createHash("sha256").update(email).digest("hex");
      const now = new Date();
      await getFirebaseAdmin()
        .db.collection("subscribers")
        .doc(id)
        .set({ email, source, consentAt: now, updatedAt: now }, { merge: true });
      return { subscribed: true };
    },
  });
}
