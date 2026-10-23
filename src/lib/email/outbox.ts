import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { extractLinks } from "./outbox-links";

/** An email that was written to the outbox instead of being sent. */
export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  kind: string;
  text: string;
  /** Links in the message, e.g. "Verify your email" or "Set your password". */
  links: Array<{ label: string; href: string }>;
  createdAt: Date;
}

/** Newest outbox emails, optionally for one recipient. */
export async function listOutbox(
  options: { to?: string; limit?: number } = {},
): Promise<OutboxEmail[]> {
  const outbox = getFirebaseAdmin().db.collection("emailOutbox");
  const limit = options.limit ?? 50;
  // One recipient has few emails: filter, then sort in memory (no composite index needed).
  const snapshot = options.to
    ? await outbox.where("to", "==", options.to.trim().toLowerCase()).limit(200).get()
    : await outbox.orderBy("createdAt", "desc").limit(limit).get();
  const emails = snapshot.docs.map((doc) => {
    const data = doc.data();
    const created = data.createdAt as { toDate?: () => Date } | Date | undefined;
    return {
      id: doc.id,
      to: String(data.to ?? ""),
      subject: String(data.subject ?? ""),
      kind: String(data.kind ?? ""),
      text: String(data.text ?? ""),
      links: extractLinks(String(data.html ?? "")),
      createdAt: created instanceof Date ? created : (created?.toDate?.() ?? new Date(0)),
    };
  });
  return emails.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
