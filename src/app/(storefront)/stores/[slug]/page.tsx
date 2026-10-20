import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReturnIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ButtonLink, Link } from "@/components/primitives";
import { StoreOpenStatus } from "@/components/stores/StoreOpenStatus";
import { brand } from "@/config/brand";
import { SERVICE_ORDER, STORE_SERVICES } from "@/config/store-services";
import { getStores } from "@/lib/catalog/queries";
import { clientEnv } from "@/lib/env/client";
import { DAY_NAMES, directionsUrl, weeklyHours } from "@/lib/stores/hours";
import type { Store } from "@/lib/validation";

async function getStoreBySlug(slug: string): Promise<Store | null> {
  return (await getStores()).find((s) => s.slug === slug && s.status !== "closed") ?? null;
}

export async function generateStaticParams() {
  return (await getStores()).filter((s) => s.status !== "closed").map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/stores/[slug]">): Promise<Metadata> {
  const store = await getStoreBySlug((await params).slug);
  if (!store) return { title: "Store not found", robots: { index: false } };
  return {
    title: store.name,
    description: `Opening hours, services and directions for ${store.name}, ${store.address.line1}, ${store.address.city}.`,
    alternates: { canonical: `/stores/${store.slug}` },
  };
}

/** schema.org ClothingStore with opening hours, for rich results. */
function storeJsonLd(store: Store) {
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: store.name,
    brand: { "@type": "Brand", name: brand.name },
    url: new URL(`/stores/${store.slug}`, clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
    telephone: store.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address.line1,
      addressLocality: store.address.city,
      addressRegion: store.address.region,
      postalCode: store.address.postalCode,
      addressCountry: store.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: store.geo.lat, longitude: store.geo.lng },
    openingHoursSpecification: store.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_NAMES[h.day]}`,
      opens: h.open,
      closes: h.close,
    })),
  };
}

/** Unknown slugs answer 404 before streaming; every store is prerendered. */
export const instant = false;

export default async function Page({ params }: PageProps<"/stores/[slug]">) {
  const store = await getStoreBySlug((await params).slug);
  if (!store) notFound();
  const others = (await getStores()).filter((s) => s.id !== store.id && s.status !== "closed");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(storeJsonLd(store)).replace(/</g, "\\u003c"),
        }}
      />
      <div className="container-page pt-6 pb-24">
        <Breadcrumbs
          items={[
            { label: "Stores", href: "/stores" },
            { label: store.name, href: `/stores/${store.slug}` },
          ]}
        />
        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div>
            <h1 className="font-display text-5xl">{store.name}</h1>
            <address className="mt-4 text-lg text-ink-soft not-italic">
              {store.address.line1}, {store.address.city}, {store.address.region}{" "}
              {store.address.postalCode}
            </address>
            <StoreOpenStatus store={store} className="mt-3" />
            <div className="mt-6 flex flex-wrap gap-4">
              <ButtonLink
                href={directionsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
              >
                Get directions<span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
              <ButtonLink href={`tel:${store.phone.replace(/[^\d+]/g, "")}`} variant="secondary">
                Call {store.phone}
              </ButtonLink>
            </div>

            <section aria-labelledby="services-title" className="mt-12">
              <h2 id="services-title" className="text-label">
                Services
              </h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {SERVICE_ORDER.filter((s) => store.services.includes(s)).map((service) => (
                  <li key={service} className="bg-surface p-5 text-sm">
                    <p className="font-medium">{STORE_SERVICES[service].label}</p>
                    <p className="mt-1 text-ink-soft">{STORE_SERVICES[service].description}</p>
                  </li>
                ))}
              </ul>
            </section>

            {store.services.includes("returns") && (
              <p className="mt-8 flex items-start gap-3 bg-surface-muted p-5 text-sm">
                <ReturnIcon />
                <span>
                  Returning an online order here? Start your return online, choose drop off in store
                  and bring the QR code. <Link href="/orders/lookup">Find your order</Link>
                </span>
              </p>
            )}
          </div>

          <aside className="self-start">
            <section aria-labelledby="hours-title" className="border border-line bg-surface p-6">
              <h2 id="hours-title" className="text-label">
                Opening hours
              </h2>
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">Opening hours, local time</caption>
                <tbody>
                  {weeklyHours(store).map(({ day, text }) => (
                    <tr key={day} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 text-left font-normal">
                        {DAY_NAMES[day]}
                      </th>
                      <td className="py-2 text-right tabular-nums">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-ink-subtle">Local time. Holiday hours may vary.</p>
            </section>

            {others.length > 0 && (
              <section aria-labelledby="other-stores" className="mt-8 text-sm">
                <h2 id="other-stores" className="text-label">
                  Other stores
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {others.map((s) => (
                    <li key={s.id}>
                      <Link href={`/stores/${s.slug}`}>{s.name}</Link>
                      <span className="text-ink-soft">
                        {" "}
                        · {s.address.city}, {s.address.region}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
