import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  template: ReactElement;
  /** Groups messages for analytics and resend tooling, e.g. "order_confirmation". */
  kind: string;
  /** Related record, e.g. the order id, so staff can resend from the back office. */
  ref?: string;
}

let resend: Resend | null = null;

/**
 * Sends transactional email through Resend. Without an API key (local
 * development only; production requires one) mail is written to the
 * Firestore `emailOutbox` collection so it can be inspected.
 */
export async function sendEmail(
  message: EmailMessage,
): Promise<{ id: string; transport: "resend" | "outbox" }> {
  const [html, text] = await Promise.all([
    render(message.template),
    render(message.template, { plainText: true }),
  ]);

  if (serverEnv.RESEND_API_KEY) {
    resend ??= new Resend(serverEnv.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: serverEnv.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html,
      text,
      tags: [{ name: "kind", value: message.kind }],
    });
    if (error || !data) {
      logger.error("email.send_failed", {
        kind: message.kind,
        ref: message.ref,
        error: error?.message,
      });
      throw new Error("Email could not be sent");
    }
    return { id: data.id, transport: "resend" };
  }

  const ref = await getFirebaseAdmin()
    .db.collection("emailOutbox")
    .add({
      to: message.to,
      from: serverEnv.EMAIL_FROM,
      subject: message.subject,
      kind: message.kind,
      ref: message.ref ?? null,
      html,
      text,
      createdAt: new Date(),
    });
  return { id: ref.id, transport: "outbox" };
}
