"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { createSession, destroySession, type Session } from "@/lib/auth/session";
import {
  addressInputSchema,
  communicationPreferencesSchema,
  customerChangePasswordSchema,
  deleteAccountSchema,
  profileDetailsSchema,
  sizePreferencesSchema,
} from "@/lib/validation/account";
import { cartSchema } from "@/lib/validation/commerce";
import {
  changePassword,
  deleteAccount,
  deleteAddress,
  getSavedCart,
  listWishlist,
  mergeWishlist,
  removeFromWishlist,
  saveAddress,
  saveCart,
  updateCommunication,
  updateDetails,
  updateSizePreferences,
} from "../account-service";

function uidOf(session: Session | null): string {
  if (!session || session.role === "guest") {
    throw new ActionError("unauthenticated", "Sign in to continue.");
  }
  return session.uid;
}

export async function updateDetailsAction(input: unknown) {
  return runAction(input, {
    schema: profileDetailsSchema,
    access: { permission: "account.manage" },
    handler: async (details, { session }) => {
      await updateDetails(uidOf(session), details);
      return { saved: true };
    },
  });
}

export async function saveAddressAction(input: unknown) {
  return runAction(input, {
    schema: addressInputSchema,
    access: { permission: "addresses.manage" },
    handler: async (address, { session }) => ({ id: await saveAddress(uidOf(session), address) }),
  });
}

export async function deleteAddressAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ id: z.string().min(1).max(128) }),
    access: { permission: "addresses.manage" },
    handler: async ({ id }, { session }) => {
      await deleteAddress(uidOf(session), id);
      return { deleted: true };
    },
  });
}

export async function updateSizePreferencesAction(input: unknown) {
  return runAction(input, {
    schema: sizePreferencesSchema,
    access: { permission: "account.manage" },
    handler: async (prefs, { session }) => {
      await updateSizePreferences(uidOf(session), prefs);
      return { saved: true };
    },
  });
}

export async function updateCommunicationAction(input: unknown) {
  return runAction(input, {
    schema: communicationPreferencesSchema,
    access: { permission: "account.manage" },
    handler: async (prefs, { session }) => {
      await updateCommunication(uidOf(session), prefs);
      return { saved: true };
    },
  });
}

const wishlistEntry = z.object({
  productId: z.string().min(1).max(128),
  color: z.string().max(40).optional(),
  priceAtAdd: z.number().int().nonnegative(),
  addedAt: z.number().int().nonnegative(),
});

/** Merges this device's wishlist into the account and returns the account's list. */
export async function syncWishlistAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ items: z.array(wishlistEntry).max(200) }),
    access: { permission: "wishlist.sync" },
    handler: async ({ items }, { session }) => {
      const merged = await mergeWishlist(uidOf(session), items);
      return {
        items: merged.map((w) => ({
          productId: w.productId,
          ...(w.color ? { color: w.color } : {}),
          priceAtAdd: w.priceAtAdd,
          addedAt: w.addedAt.getTime(),
        })),
      };
    },
  });
}

export async function removeWishlistAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ productId: z.string().min(1).max(128) }),
    access: { permission: "wishlist.sync" },
    handler: async ({ productId }, { session }) => {
      await removeFromWishlist(uidOf(session), productId);
      return { removed: true };
    },
  });
}

/** The account's wishlist (for devices that haven't saved anything locally). */
export async function getWishlistAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "wishlist.sync" },
    handler: async (_input, { session }) => ({
      items: (await listWishlist(uidOf(session))).map((w) => ({
        productId: w.productId,
        ...(w.color ? { color: w.color } : {}),
        priceAtAdd: w.priceAtAdd,
        addedAt: w.addedAt.getTime(),
      })),
    }),
  });
}

const bagLine = z.object({
  sku: z.string().min(1).max(64),
  productId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(10),
  addedAt: z.number().int().nonnegative(),
});

/** The bag saved to the account, for merging on another device. */
export async function getSavedBagAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "account.manage" },
    handler: async (_input, { session }) => {
      const cart = await getSavedCart(uidOf(session));
      const toLine = (l: NonNullable<typeof cart>["lines"][number]) => ({
        sku: l.sku,
        productId: l.productId,
        quantity: l.quantity,
        addedAt: l.addedAt.getTime(),
      });
      return {
        lines: (cart?.lines ?? []).filter((l) => !l.savedForLater).map(toLine),
        savedForLater: (cart?.lines ?? []).filter((l) => l.savedForLater).map(toLine),
        promoCodes: cart?.promoCodes ?? [],
      };
    },
  });
}

/** Saves this device's bag to the account (cross-device bag). */
export async function saveBagAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      lines: z.array(bagLine).max(50),
      savedForLater: z.array(bagLine).max(50),
      promoCodes: z.array(z.string().max(40)).max(5),
    }),
    access: { permission: "account.manage" },
    handler: async ({ lines, savedForLater, promoCodes }, { session }) => {
      const toCart = (l: z.infer<typeof bagLine>, saved: boolean) => ({
        sku: l.sku,
        productId: l.productId,
        quantity: l.quantity,
        savedForLater: saved,
        addedAt: new Date(l.addedAt),
      });
      const all = [
        ...lines.map((l) => toCart(l, false)),
        ...savedForLater.map((l) => toCart(l, true)),
      ];
      cartSchema.shape.lines.parse(all);
      await saveCart(uidOf(session), all, promoCodes);
      return { saved: true };
    },
  });
}

/** Changes the password; other devices are signed out, this one stays signed in. */
export async function changePasswordAction(input: unknown) {
  return runAction(input, {
    schema: customerChangePasswordSchema,
    access: { permission: "account.manage" },
    handler: async ({ currentPassword, newPassword }, { session }) => {
      uidOf(session);
      const idToken = await changePassword(session as Session, currentPassword, newPassword);
      await createSession(idToken);
      return { changed: true };
    },
  });
}

/** Signs out of every device, including this one. */
export async function signOutEverywhereAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "account.manage" },
    handler: async () => {
      await destroySession({ everywhere: true });
      return { redirectTo: "/auth/signin" };
    },
  });
}

/** Deletes the account (password and typed confirmation), then signs out. */
export async function deleteAccountAction(input: unknown) {
  return runAction(input, {
    schema: deleteAccountSchema,
    access: { permission: "account.manage" },
    handler: async ({ password }, { session }) => {
      uidOf(session);
      await deleteAccount(session as Session, password);
      await destroySession();
      return { redirectTo: "/?account=deleted" };
    },
  });
}
