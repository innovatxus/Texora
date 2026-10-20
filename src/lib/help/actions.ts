"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

/** Customer care enquiry. Stored for the CS queue in the back office. */
export async function submitContactRequest(input: unknown) {
  return runAction(input, {
    schema: z.object({
      name: z.string().trim().min(1, "Enter your name").max(80),
      email: z.email("Enter a valid email address").max(254).toLowerCase(),
      topic: z.enum(["order", "return", "product", "payment", "other"], "Choose a topic"),
      orderNumber: z
        .string()
        .trim()
        .toUpperCase()
        .max(20)
        .refine((v) => v === "" || /^(TX-?)?\d{6,12}$/.test(v), "Order numbers look like TX-100482")
        .optional(),
      message: z
        .string()
        .trim()
        .min(10, "Tell us a little more (at least 10 characters)")
        .max(2000, "Keep your message under 2,000 characters"),
    }),
    access: { public: true },
    handler: async ({ orderNumber, ...request }) => {
      const ref = await getFirebaseAdmin()
        .db.collection("contactRequests")
        .add({
          ...request,
          ...(orderNumber ? { orderNumber: `TX-${orderNumber.replace(/^TX-?/, "")}` } : {}),
          status: "open",
          createdAt: new Date(),
        });
      return { reference: ref.id.slice(0, 8).toUpperCase() };
    },
  });
}
