/**
 * Safe access to browser storage and cookies, plus a change signal so hooks
 * built on useSyncExternalStore re-render after our own writes (the native
 * "storage" event only fires for other tabs).
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribes to storage and cookie changes from this tab and others. */
export function subscribeToBrowserState(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Tells subscribers that storage or cookies changed in this tab. */
export function notifyBrowserStateChanged(): void {
  for (const listener of listeners) listener();
}

export type StorageArea = "local" | "session";

function area(kind: StorageArea): Storage {
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

/** Null when the key is missing or storage is unavailable (private mode, blocked). */
export function readStorage(kind: StorageArea, key: string): string | null {
  try {
    return area(kind).getItem(key);
  } catch {
    return null;
  }
}

/** Writes to local or session storage, ignoring blocked storage (e.g. private browsing). */
export function writeStorage(kind: StorageArea, key: string, value: string): void {
  try {
    area(kind).setItem(key, value);
  } catch {
    // Storage is a convenience; the UI keeps working for this page view.
  }
  notifyBrowserStateChanged();
}

/** Reads a cookie value by name, or null. */
export function readCookie(name: string): string | null {
  const match = document.cookie.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
