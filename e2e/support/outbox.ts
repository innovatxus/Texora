/**
 * Reads the development email outbox (`emailOutbox`, used when no Resend key
 * is set) from the Firestore emulator's REST API, so tests can follow the
 * links in verification and reset emails. "Bearer owner" bypasses rules.
 */
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const PROJECT = process.env.E2E_FIREBASE_PROJECT ?? "demo-texora";

interface OutboxEmail {
  subject: string;
  html: string;
  kind: string;
  createdAt: string;
}

type Value = { stringValue?: string; timestampValue?: string };

/** The newest email of a kind sent to an address, waiting briefly for it to arrive. */
export async function latestEmail(
  to: string,
  kind: string,
  timeoutMs = 10_000,
): Promise<OutboxEmail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(
      `http://${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer owner" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "emailOutbox" }],
            where: {
              fieldFilter: { field: { fieldPath: "to" }, op: "EQUAL", value: { stringValue: to } },
            },
          },
        }),
      },
    );
    const rows = (await response.json()) as Array<{ document?: { fields: Record<string, Value> } }>;
    const emails = rows
      .flatMap((r) => (r.document ? [r.document.fields] : []))
      .map((f) => ({
        subject: f.subject?.stringValue ?? "",
        html: f.html?.stringValue ?? "",
        kind: f.kind?.stringValue ?? "",
        createdAt: f.createdAt?.timestampValue ?? "",
      }))
      .filter((e) => e.kind === kind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (emails[0]) return emails[0];
    if (Date.now() > deadline) throw new Error(`No ${kind} email to ${to}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** The app-relative link with a one-time code from an email, e.g. "/merchant/verify-email?oobCode=…". */
export function linkIn(html: string, path: string): string {
  const match = html.match(
    new RegExp(`https?://[^"]*(${path.replace(/\//g, "\\/")}\\?oobCode=[^"]+)`),
  );
  if (!match?.[1]) throw new Error(`No ${path} link in email`);
  return match[1].replace(/&amp;/g, "&");
}

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

/** Creates a plain shopper account (no role claim, so a customer) in the Auth emulator. */
export async function createShopper(email: string, password: string): Promise<void> {
  const response = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error(`Could not create shopper ${email}: ${await response.text()}`);
}
