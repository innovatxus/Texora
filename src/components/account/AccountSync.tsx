"use client";

import { useEffect } from "react";
import {
  getSavedBagAction,
  getWishlistAction,
  removeWishlistAction,
  saveBagAction,
  syncWishlistAction,
} from "@/lib/account/actions/account";
import { mergeBagLines } from "@/lib/account/merge";
import { useBagStore } from "@/stores/bag";
import { useWishlistStore } from "@/stores/wishlist";

/** Which account this device last synced with; cleared when nobody is signed in. */
const SYNCED_KEY = "texora-synced-uid";

function syncedUid(): string | null {
  try {
    return localStorage.getItem(SYNCED_KEY);
  } catch {
    return null;
  }
}

function setSyncedUid(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(SYNCED_KEY, uid);
    else localStorage.removeItem(SYNCED_KEY);
  } catch {
    // Storage blocked: syncing still works, it just merges again next time.
  }
}

/** Waits for persisted stores to load from localStorage. */
async function hydrated(): Promise<void> {
  await Promise.all(
    [useBagStore, useWishlistStore].map(
      (store) =>
        new Promise<void>((resolve) => {
          if (store.persist.hasHydrated()) resolve();
          else {
            const off = store.persist.onFinishHydration(() => {
              off();
              resolve();
            });
          }
        }),
    ),
  );
}

/**
 * Cross-device bag and wishlist for signed-in shoppers (spec 7.6, 7.8). On
 * sign-in the device's guest items are merged into the account; after that
 * the account's copy is loaded on each visit and every change is saved.
 */
export function AccountSync({ uid }: { uid: string | null }) {
  useEffect(() => {
    if (!uid) {
      setSyncedUid(null);
      return;
    }
    let active = true;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: Array<() => void> = [];

    void (async () => {
      await hydrated();
      if (!active) return;
      const firstTime = syncedUid() !== uid;

      // Wishlist: merge guest saves the first time, then follow the account.
      const local = useWishlistStore.getState().items;
      const wish = firstTime
        ? await syncWishlistAction({ items: local })
        : await getWishlistAction({});
      if (!active) return;
      if (wish.ok) useWishlistStore.setState({ items: wish.data.items });

      // Bag: the larger quantity of each line wins, so nothing is lost or doubled.
      const saved = await getSavedBagAction({});
      if (!active || !saved.ok) return;
      const bag = useBagStore.getState();
      const merged = {
        lines: firstTime ? mergeBagLines(bag.lines, saved.data.lines) : saved.data.lines,
        savedForLater: firstTime
          ? mergeBagLines(bag.savedForLater, saved.data.savedForLater)
          : saved.data.savedForLater,
        promoCodes: [...new Set([...bag.promoCodes, ...saved.data.promoCodes])].slice(0, 5),
      };
      useBagStore.setState(merged);
      if (firstTime) await saveBagAction(merged);
      setSyncedUid(uid);

      // From here on, save each change.
      unsubscribers.push(
        useWishlistStore.subscribe((state, prev) => {
          const before = new Set(prev.items.map((i) => i.productId));
          const after = new Set(state.items.map((i) => i.productId));
          const added = state.items.filter((i) => !before.has(i.productId));
          const removed = [...before].filter((id) => !after.has(id));
          if (added.length) void syncWishlistAction({ items: added });
          for (const productId of removed) void removeWishlistAction({ productId });
        }),
        useBagStore.subscribe((state, prev) => {
          if (
            state.lines === prev.lines &&
            state.savedForLater === prev.savedForLater &&
            state.promoCodes === prev.promoCodes
          ) {
            return;
          }
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            const { lines, savedForLater, promoCodes } = useBagStore.getState();
            void saveBagAction({ lines, savedForLater, promoCodes });
          }, 800);
        }),
      );
    })();

    return () => {
      active = false;
      clearTimeout(saveTimer);
      for (const off of unsubscribers) off();
    };
  }, [uid]);

  return null;
}
