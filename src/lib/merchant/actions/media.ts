"use server";

import { z } from "zod";
import { MEDIA_KINDS } from "@/lib/validation/merchant";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { discardUpload, finalizeUpload, issueUploadToken } from "../media/media-service";

const crop = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .optional();

function vendorOf(session: { vendorId: string | null } | null): string {
  if (!session?.vendorId) throw new ActionError("forbidden", "You don't have a merchant account");
  return session.vendorId;
}

/** A custom token so the browser can upload straight to this merchant's Storage folder. */
export async function getUploadTokenAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "merchant.media.write" },
    handler: async (_input, { session }) => {
      const vendorId = vendorOf(session);
      return { token: await issueUploadToken(session?.uid ?? ""), vendorId };
    },
  });
}

/** Validates and processes a finished upload; returns the stored image or video. */
export async function finalizeUploadAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      shopId: z.string().min(1).max(128),
      kind: z.enum(MEDIA_KINDS),
      uploadId: z.string().min(1).max(64),
      crop,
      alt: z.string().max(200).optional(),
    }),
    access: { permission: "merchant.media.write" },
    handler: async (data, { session }) =>
      finalizeUpload({ ...data, vendorId: vendorOf(session), ownerUid: session?.uid ?? "" }),
  });
}

/** Cancels an upload and removes the raw file. */
export async function discardUploadAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ shopId: z.string().min(1).max(128), uploadId: z.string().min(1).max(64) }),
    access: { permission: "merchant.media.write" },
    handler: async ({ shopId, uploadId }, { session }) => {
      await discardUpload(vendorOf(session), shopId, uploadId);
      return { discarded: true };
    },
  });
}
