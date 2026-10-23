import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminField, AdminPageHeader, adminControl, FilterBar } from "@/components/admin/ui";
import { requirePagePermission } from "@/lib/auth/guard";
import { listOutbox } from "@/lib/email/outbox";
import { serverEnv } from "@/lib/env/server";

/** Email outbox title. */
export const metadata: Metadata = { title: "Email outbox" };

/**
 * Emails the store couldn't send because no email provider is connected yet
 * (a staging deployment). Admins open them here to pass on verification,
 * invitation and password links while testing. Once RESEND_API_KEY is set,
 * emails are delivered and nothing new appears.
 */
async function Outbox({ searchParams }: PageProps<"/admin/emails">) {
  await requirePagePermission("emails.outbox.read");
  const sp = await searchParams;
  const to = typeof sp.to === "string" && sp.to.trim() ? sp.to.trim() : undefined;
  const emails = await listOutbox(to ? { to } : {});
  const delivering = Boolean(serverEnv.RESEND_API_KEY);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Email outbox"
        description={
          delivering
            ? "Emails are delivered through your email provider. Messages listed here are from before it was connected."
            : "No email provider is connected yet, so emails are kept here instead of being sent. Open a message to copy its link (verify email, set password, reset password) and pass it on. Treat these links like passwords."
        }
      />
      <FilterBar action="/admin/emails">
        <AdminField label="Recipient email">
          <input
            name="to"
            type="email"
            defaultValue={to}
            placeholder="name@example.com"
            className={`${adminControl} w-72`}
          />
        </AdminField>
      </FilterBar>
      {emails.length === 0 ? (
        <p className="border border-line bg-surface p-6 text-sm text-ink-soft">
          {to ? `No emails for ${to}.` : "The outbox is empty."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {emails.map((email) => (
            <li key={email.id} className="border border-line bg-surface">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-6 gap-y-1 p-4 text-sm">
                  <span className="font-medium">{email.subject}</span>
                  <span className="text-ink-soft">
                    {email.to} · {email.kind.replace(/_/g, " ")} · {formatDateTime(email.createdAt)}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 border-t border-line p-4 text-sm">
                  {email.links.length > 0 && (
                    <ul aria-label="Links in this email" className="flex flex-col gap-2">
                      {email.links.map((link) => (
                        <li key={link.href} className="flex flex-col gap-1">
                          <span className="text-label">{link.label}</span>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs break-all underline underline-offset-4 hover:text-brand"
                          >
                            {link.href}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <pre className="max-h-96 overflow-auto bg-surface-muted p-4 text-xs whitespace-pre-wrap">
                    {email.text}
                  </pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page(props: PageProps<"/admin/emails">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Outbox {...props} />
    </Suspense>
  );
}
