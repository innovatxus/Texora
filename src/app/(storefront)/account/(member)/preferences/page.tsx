import type { Metadata } from "next";
import {
  CommunicationForm,
  DetailsForm,
  SizePreferencesForm,
} from "@/components/account/PreferencesForms";
import { getAccountUser } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sizes & preferences" };

/** Details, saved sizes (pre-selected on product pages) and communication choices. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const user = await getAccountUser(session.uid);
  if (!user) return null;

  return (
    <div className="flex flex-col gap-12">
      <h1 className="font-display text-4xl">Sizes &amp; preferences</h1>
      <section aria-labelledby="details" className="flex flex-col gap-4">
        <h2 id="details" className="text-label">
          Your details
        </h2>
        <DetailsForm
          firstName={user.firstName}
          lastName={user.lastName}
          phone={user.phone ?? ""}
          email={user.email}
        />
      </section>
      <section aria-labelledby="sizes" className="flex flex-col gap-4">
        <h2 id="sizes" className="text-label">
          Fit and sizes
        </h2>
        <SizePreferencesForm
          fitFamily={user.preferences.fitFamily ?? null}
          savedSizes={user.savedSizes}
        />
      </section>
      <section aria-labelledby="communication" className="flex flex-col gap-4">
        <h2 id="communication" className="text-label">
          Communication
        </h2>
        <CommunicationForm
          marketingEmail={user.preferences.marketingEmail}
          marketingSms={user.preferences.marketingSms}
        />
      </section>
    </div>
  );
}
