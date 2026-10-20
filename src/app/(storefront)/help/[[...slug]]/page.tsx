import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/help/ContactForm";
import { HelpNav } from "@/components/help/HelpNav";
import { HelpSearch } from "@/components/help/HelpSearch";
import { ReturnIcon, StoreIcon, TruckIcon } from "@/components/icons";
import { Breadcrumbs, type Crumb } from "@/components/navigation/Breadcrumbs";
import { DetailsAccordion } from "@/components/pdp/DetailsAccordion";
import { HowToMeasure, SizeGuideTable } from "@/components/pdp/SizeGuideContent";
import { Link } from "@/components/primitives";
import { brand } from "@/config/brand";
import { FAQ, FAQ_CATEGORIES, getHelpTopic, HELP_TOPICS, type HelpTopic } from "@/config/help";
import { ALL_SIZE_GUIDES } from "@/config/size-guides";

type Params = PageProps<"/help/[[...slug]]">["params"];

async function resolve(params: Params): Promise<{ topic: HelpTopic | null } | null> {
  const { slug } = await params;
  if (!slug || slug.length === 0) return { topic: null };
  if (slug.length > 1) return null;
  const topic = getHelpTopic(slug[0] ?? "");
  return topic ? { topic } : null;
}

/** Prerenders the help centre home and every topic. */
export function generateStaticParams() {
  return [{ slug: [] }, ...HELP_TOPICS.map((t) => ({ slug: [t.slug] }))];
}

/** Title, description and canonical URL for the help home or a topic. */
export async function generateMetadata({
  params,
}: PageProps<"/help/[[...slug]]">): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return { title: "Page not found", robots: { index: false } };
  const { topic } = resolved;
  return topic
    ? {
        title: topic.title,
        description: topic.summary,
        alternates: { canonical: `/help/${topic.slug}` },
      }
    : {
        title: "Help centre",
        description: `Answers about orders, delivery, returns, sizing and ${brand.name} Rewards.`,
        alternates: { canonical: "/help" },
      };
}

const QUICK_LINKS = [
  {
    href: "/orders/lookup",
    title: "Track an order",
    text: "See where your order is.",
    icon: TruckIcon,
  },
  {
    href: "/orders/lookup",
    title: "Start a return",
    text: "Free within 30 days.",
    icon: ReturnIcon,
  },
  { href: "/stores", title: "Find a store", text: "Hours, services, directions.", icon: StoreIcon },
] as const;

function ContactMethods() {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-3">
      <div className="bg-surface p-5">
        <dt className="text-label">Call us</dt>
        <dd className="mt-2">
          <Link href={`tel:${brand.support.phone.replace(/[^\d+]/g, "")}`}>
            {brand.support.phone}
          </Link>
        </dd>
      </div>
      <div className="bg-surface p-5">
        <dt className="text-label">Email</dt>
        <dd className="mt-2">
          <Link href={`mailto:${brand.support.email}`}>{brand.support.email}</Link>
        </dd>
      </div>
      <div className="bg-surface p-5">
        <dt className="text-label">Hours</dt>
        <dd className="mt-2 text-ink-soft">{brand.support.hours}</dd>
      </div>
    </dl>
  );
}

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

function HelpHome() {
  return (
    <>
      <h1 className="font-display text-5xl">How can we help?</h1>
      <div className="mt-8 max-w-2xl">
        <HelpSearch />
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map(({ href, title, text, icon: Icon }) => (
          <li key={title}>
            <NextLink
              href={href}
              className="flex h-full flex-col gap-2 border border-line bg-surface p-5 transition-colors hover:border-ink"
            >
              <Icon />
              <span className="font-medium">{title}</span>
              <span className="text-sm text-ink-soft">{text}</span>
            </NextLink>
          </li>
        ))}
      </ul>
      <section aria-labelledby="topics-title" className="mt-14">
        <h2 id="topics-title" className="text-label">
          Popular topics
        </h2>
        <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {HELP_TOPICS.filter((t) => t.group === "help").map((topic) => (
            <li key={topic.slug}>
              <Link href={`/help/${topic.slug}`} className="font-medium">
                {topic.title}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">{topic.summary}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="contact-title" className="mt-14">
        <h2 id="contact-title" className="text-label">
          Still need help?
        </h2>
        <div className="mt-5">
          <ContactMethods />
        </div>
      </section>
    </>
  );
}

function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }}
      />
      <div className="mt-8 max-w-2xl">
        <HelpSearch />
      </div>
      {FAQ_CATEGORIES.map((category) => {
        const entries = FAQ.filter((e) => e.category === category);
        if (entries.length === 0) return null;
        return (
          <section key={category} aria-label={category} className="mt-12">
            <h2 className="mb-2 font-display text-2xl">{category}</h2>
            <DetailsAccordion
              defaultOpen={[]}
              sections={entries.map((entry) => ({
                id: entry.id,
                title: entry.question,
                content: (
                  <div className="max-w-prose">
                    <p>{entry.answer}</p>
                    {entry.link && (
                      <Link href={entry.link.href} className="mt-3 inline-block">
                        {entry.link.label}
                      </Link>
                    )}
                  </div>
                ),
              }))}
            />
          </section>
        );
      })}
    </>
  );
}

function TopicBody({ topic }: { topic: HelpTopic }) {
  if (topic.slug === "faq") return <FaqPage />;
  if (topic.slug === "contact") {
    return (
      <>
        <div className="mt-8">
          <ContactMethods />
        </div>
        <section aria-labelledby="form-title" className="mt-12 max-w-2xl">
          <h2 id="form-title" className="text-label">
            Send us a message
          </h2>
          <p className="mt-2 text-sm text-ink-soft">We reply within one business day.</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </section>
      </>
    );
  }
  if (topic.slug === "size-guides") {
    return (
      <>
        {ALL_SIZE_GUIDES.map((guide) => (
          <section key={guide.title} aria-label={guide.title} className="mt-12">
            <h2 className="mb-4 font-display text-2xl">{guide.title}</h2>
            <SizeGuideTable guide={guide} />
          </section>
        ))}
        <section className="mt-6">
          <HowToMeasure headingLevel={2} />
        </section>
      </>
    );
  }
  return (
    <div className="mt-8 flex max-w-prose flex-col gap-8">
      {topic.sections.map((section, i) => (
        <section key={section.heading ?? i}>
          {section.heading && <h2 className="font-display text-2xl">{section.heading}</h2>}
          {section.paragraphs?.map((p) => (
            <p key={p} className="mt-3 text-ink-soft">
              {p}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-ink-soft">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** Unknown topics answer 404 before streaming; every topic is prerendered. */
export const instant = false;

/** Help centre: search and quick links on the home page, topic content otherwise. */
export default async function Page({ params }: PageProps<"/help/[[...slug]]">) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { topic } = resolved;
  const crumbs: Crumb[] = [
    { label: "Help", href: "/help" },
    ...(topic ? [{ label: topic.title, href: `/help/${topic.slug}` }] : []),
  ];

  return (
    <div className="container-page pt-6 pb-24">
      <Breadcrumbs items={crumbs} />
      <div className="mt-8 grid gap-12 lg:grid-cols-[14rem_1fr]">
        <aside className="order-last lg:order-first">
          <HelpNav current={topic?.slug ?? null} />
        </aside>
        <div className="min-w-0">
          {topic ? (
            <>
              <h1 className="font-display text-5xl">{topic.title}</h1>
              <p className="mt-4 text-lg text-ink-soft">{topic.summary}</p>
              <TopicBody topic={topic} />
            </>
          ) : (
            <HelpHome />
          )}
        </div>
      </div>
    </div>
  );
}
