import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeAlerts } from "@/components/marketing/UnsubscribeAlerts";
import { Skeleton } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Stop product alerts",
  robots: { index: false, follow: false },
};

async function Unsubscribe({ searchParams }: PageProps<"/notifications/unsubscribe">) {
  const query = await searchParams;
  const email = typeof query.email === "string" ? query.email : "";
  const token = typeof query.t === "string" ? query.t : "";
  if (!email || !token) {
    return (
      <p className="mt-4 text-ink-soft">
        This link is incomplete. Use the &ldquo;Stop these emails&rdquo; link in your email.
      </p>
    );
  }
  return (
    <>
      <p className="mt-4 text-ink-soft">
        Stop back-in-stock and price-drop alerts for <strong className="text-ink">{email}</strong>?
        This doesn&apos;t affect order emails.
      </p>
      <div className="mt-8">
        <UnsubscribeAlerts email={email} token={token} />
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/notifications/unsubscribe">) {
  return (
    <div className="container-page max-w-2xl pt-10 pb-24">
      <h1 className="font-display text-5xl">Product alerts</h1>
      <Suspense fallback={<Skeleton className="mt-4 h-24" />}>
        <Unsubscribe {...props} />
      </Suspense>
    </div>
  );
}
