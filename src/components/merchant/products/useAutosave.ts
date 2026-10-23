"use client";

import { LOCALE, TIME_ZONE } from "@/config/locale";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProductDraftAction } from "@/lib/merchant/actions/products";
import type { DraftSummary, ProductDraftData } from "@/lib/validation/merchant";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "offline" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

/** "10:42" in the merchant's clock. */
export function clock(date: Date): string {
  return date.toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The status line text (journey §9). */
export function saveStateLabel(state: SaveState, dirty: boolean): string {
  switch (state.kind) {
    case "saving":
      return "Saving…";
    case "saved":
      return dirty ? "Unsaved changes" : `Saved ${clock(state.at)}`;
    case "offline":
      return "Offline — changes will sync";
    case "error":
      return "Couldn't save — retrying";
    case "conflict":
      return state.message;
    case "idle":
      return dirty ? "Unsaved changes" : "All changes saved";
  }
}

/**
 * Autosaves the editor 5 seconds after the last change. Saves are
 * version-checked on the server; going offline pauses saving until the
 * connection returns; failures retry with backoff. `saveNow` is the
 * "Save draft" button.
 */
export function useAutosave({
  productId,
  initialVersion,
  data,
  dirty,
  idleMs,
  onSaved,
}: {
  productId: string;
  initialVersion: number;
  data: ProductDraftData;
  dirty: boolean;
  idleMs: number;
  onSaved: (summary: DraftSummary, savedData: ProductDraftData) => void;
}) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const version = useRef(initialVersion);
  const inFlight = useRef(false);
  const retries = useRef(0);
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState({ kind: "offline" });
      return false;
    }
    inFlight.current = true;
    const snapshot = latest.current;
    setState({ kind: "saving" });
    try {
      const result = await saveProductDraftAction({
        productId,
        version: version.current,
        data: snapshot,
      });
      if (result.ok) {
        version.current = result.data.version;
        retries.current = 0;
        setState({ kind: "saved", at: new Date() });
        onSaved(result.data.summary, snapshot);
        return true;
      }
      if (result.error.code === "conflict") {
        setState({ kind: "conflict", message: result.error.message });
        return false;
      }
      setState({ kind: "error", message: result.error.message });
      return false;
    } catch {
      setState(navigator.onLine ? { kind: "error", message: "" } : { kind: "offline" });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [productId, onSaved]);

  // Debounced autosave on every change.
  useEffect(() => {
    if (!dirty || state.kind === "conflict") return;
    const delay =
      state.kind === "error" ? Math.min(30_000, 2_000 * 2 ** retries.current++) : idleMs;
    const timer = setTimeout(() => void saveNow(), delay);
    return () => clearTimeout(timer);
  }, [data, dirty, idleMs, saveNow, state.kind]);

  // Sync as soon as the connection is back.
  useEffect(() => {
    const online = () => {
      if (dirty) void saveNow();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [dirty, saveNow]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return { state, saveNow };
}
