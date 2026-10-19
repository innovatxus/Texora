import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  iconCatalog,
  PlusIcon,
  SearchIcon,
  BagIcon,
  HeartIcon,
  CloseIcon,
} from "@/components/icons";
import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  Divider,
  IconButton,
  Input,
  Link,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  VisuallyHidden,
} from "@/components/primitives";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import {
  DismissibleChipDemo,
  LoadingButtonDemo,
  ToggleChipDemo,
} from "./_components/InteractiveDemos";
import { Section, Specimen } from "./_components/Section";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const COLOR_TOKENS = [
  { name: "canvas", usage: "Page background" },
  { name: "surface", usage: "Cards, drawers, modals" },
  { name: "surface-muted", usage: "Image placeholders, chips" },
  { name: "ink", usage: "Primary text, primary buttons" },
  { name: "ink-soft", usage: "Secondary text" },
  { name: "ink-subtle", usage: "Meta, captions, control borders" },
  { name: "line", usage: "Decorative hairlines" },
  { name: "line-strong", usage: "Selected outlines" },
  { name: "accent", usage: "Link hover, loyalty" },
  { name: "sale", usage: "Sale prices, errors" },
  { name: "success", usage: "Confirmation" },
  { name: "warning", usage: "Caution" },
  { name: "focus", usage: "Focus ring only" },
] as const;

const TYPE_SCALE = ["5xl", "4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs"] as const;

const TYPE_CLASS: Record<(typeof TYPE_SCALE)[number], string> = {
  "5xl": "text-5xl",
  "4xl": "text-4xl",
  "3xl": "text-3xl",
  "2xl": "text-2xl",
  xl: "text-xl",
  lg: "text-lg",
  base: "text-base",
  sm: "text-sm",
  xs: "text-xs",
};

const SIZE_OPTIONS = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL", disabled: true },
];

const NAV = [
  ["colour", "Colour"],
  ["typography", "Typography"],
  ["icons", "Icons"],
  ["buttons", "Buttons"],
  ["links", "Links"],
  ["forms", "Form controls"],
  ["badges", "Badges & chips"],
  ["feedback", "Loading & structure"],
] as const;

export default function StyleguidePage() {
  if (!features.styleguide) notFound();

  return (
    <main className="container-page pb-24">
      <header className="pt-16 pb-8">
        <p className="text-label text-ink-subtle">{brand.name} · Internal</p>
        <h1 className="mt-3 font-display text-5xl">ATELIER styleguide</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          Every design token and primitive in every state. This page is the source for visual
          regression baselines.
        </p>
        <nav aria-label="Styleguide sections" className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
          {NAV.map(([id, label]) => (
            <Link key={id} href={`#${id}`} variant="nav">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <Divider decorative />

      <Section
        id="colour"
        title="Colour"
        description="Ratios for every pairing are in docs/CONTRAST.md."
      >
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <li key={token.name} className="flex flex-col gap-2">
              <span
                className="aspect-[4/3] w-full border border-line"
                style={{ backgroundColor: `var(--color-${token.name})` }}
              />
              <span className="text-sm font-medium">{token.name}</span>
              <span className="text-xs text-ink-subtle">{token.usage}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="typography"
        title="Typography"
        description="Cormorant Garamond for editorial headlines, Inter for everything else. Editorial sizes scale fluidly."
      >
        <div className="flex flex-col gap-6">
          {TYPE_SCALE.map((step) => (
            <div key={step} className="grid gap-2 md:grid-cols-[6rem_1fr] md:items-baseline">
              <span className="text-xs text-ink-subtle">{step}</span>
              <span className={TYPE_CLASS[step]}>
                <span className={step.endsWith("xl") && step !== "xl" ? "font-display" : undefined}>
                  Considered clothing
                </span>
              </span>
            </div>
          ))}
          <Divider decorative />
          <Specimen label="Label (nav, buttons) · uppercase, 0.08em">
            <span className="text-label">New arrivals</span>
          </Specimen>
          <Specimen label="Prices · tabular figures">
            <span className="text-lg tabular-nums">$128.00</span>
            <span className="text-lg text-sale tabular-nums">$89.60</span>
            <span className="text-lg text-ink-subtle tabular-nums line-through">$128.00</span>
          </Specimen>
          <Specimen label="Body">
            <p className="max-w-prose text-ink-soft">
              Cut from a mid-weight linen blend with a soft hand, this shirt has a relaxed fit, a
              camp collar and a straight hem designed to be worn tucked or loose.
            </p>
          </Specimen>
        </div>
      </Section>

      <Section
        id="icons"
        title="Icons"
        description="1.25px stroke at every size, drawn on a 24px grid."
      >
        <ul className="grid grid-cols-3 gap-6 sm:grid-cols-6 lg:grid-cols-9">
          {Object.entries(iconCatalog).map(([name, IconComponent]) => (
            <li key={name} className="flex flex-col items-center gap-3 text-center">
              <span className="flex items-center gap-3">
                <IconComponent size={20} />
                <IconComponent size={24} />
              </span>
              <span className="text-xs text-ink-subtle">{name}</span>
            </li>
          ))}
          <li className="flex flex-col items-center gap-3 text-center">
            <HeartIcon size={24} filled />
            <span className="text-xs text-ink-subtle">heart (filled)</span>
          </li>
        </ul>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-col gap-8">
          {(["primary", "secondary", "tertiary"] as const).map((variant) => (
            <Specimen key={variant} label={`${variant} · sm / md / lg / disabled / loading`}>
              <Button variant={variant} size="sm">
                Shop now
              </Button>
              <Button variant={variant}>Shop now</Button>
              <Button variant={variant} size="lg">
                Shop now
              </Button>
              <Button variant={variant} disabled>
                Shop now
              </Button>
              {variant !== "tertiary" && (
                <Button variant={variant} loading>
                  Shop now
                </Button>
              )}
            </Specimen>
          ))}
          <div className="bg-ink p-6">
            <Specimen label="inverse · on imagery or dark bands" inverse>
              <Button variant="inverse">Discover the edit</Button>
              <Button variant="inverse" disabled>
                Discover the edit
              </Button>
            </Specimen>
          </div>
          <Specimen label="With icon · full width · link styled as button · interactive loading">
            <Button>
              <BagIcon /> Add to bag
            </Button>
            <ButtonLink href="#buttons" variant="secondary">
              View bag
            </ButtonLink>
            <LoadingButtonDemo />
          </Specimen>
          <div className="max-w-sm">
            <Button fullWidth>Checkout</Button>
          </div>
          <Specimen label="Icon buttons · ghost / outline / solid · sm / md · disabled / loading">
            <IconButton label="Search" icon={<SearchIcon />} />
            <IconButton label="Save to wishlist" icon={<HeartIcon />} variant="outline" />
            <span className="bg-surface-muted p-2">
              <IconButton label="Close" icon={<CloseIcon />} variant="solid" />
            </span>
            <IconButton label="Increase quantity" icon={<PlusIcon />} variant="outline" size="sm" />
            <IconButton label="Search (disabled)" icon={<SearchIcon />} disabled />
            <IconButton label="Saving" icon={<HeartIcon />} variant="outline" loading />
          </Specimen>
        </div>
      </Section>

      <Section id="links" title="Links">
        <div className="flex flex-col gap-6">
          <Specimen label="inline">
            <p className="text-ink-soft">
              Read our <Link href="#links">returns policy</Link> before you send an item back.
            </p>
          </Specimen>
          <Specimen label="quiet">
            <Link href="#links" variant="quiet">
              Shipping
            </Link>
            <Link href="#links" variant="quiet">
              Returns
            </Link>
            <Link href="#links" variant="quiet">
              Size guides
            </Link>
          </Specimen>
          <Specimen label="nav">
            <Link href="#links" variant="nav">
              Women
            </Link>
            <Link href="#links" variant="nav">
              Men
            </Link>
            <Link href="#links" variant="nav" className="text-sale">
              Sale
            </Link>
          </Specimen>
        </div>
      </Section>

      <Section
        id="forms"
        title="Form controls"
        description="Labels are always visible except for single-purpose fields such as search."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email" />
            <Input label="Postcode" hint="We use this to estimate delivery." required />
            <Input label="Promo code" defaultValue="WELCOME" error="This code has expired." />
            <Input label="Gift card number" disabled defaultValue="•••• •••• 4821" />
            <Input label="Search products" hideLabel placeholder="Search" size="lg" />
          </div>
          <div className="flex flex-col gap-6">
            <Select
              label="Size"
              options={SIZE_OPTIONS}
              placeholder="Select a size"
              defaultValue=""
            />
            <Select
              label="Country"
              options={[{ value: "us", label: "United States" }]}
              hint="Prices shown in USD."
            />
            <Select
              label="Quantity"
              options={SIZE_OPTIONS}
              error="Choose a quantity."
              defaultValue="m"
            />
            <Select label="Store" options={[{ value: "a", label: "Downtown" }]} disabled />
          </div>
          <div className="flex flex-col gap-4">
            <Checkbox label="Email me about new arrivals and offers" defaultChecked />
            <Checkbox
              label="Save this address for next time"
              hint="Stored securely in your account."
            />
            <Checkbox label="I accept the terms of sale" error="Accept the terms to continue." />
            <Checkbox label="Gift wrap (unavailable)" disabled />
            <Checkbox label="Gift receipt" disabled defaultChecked />
          </div>
          <RadioGroup legend="Delivery method" hint="Order by 2pm for same-day dispatch." required>
            <Radio
              name="sg-delivery"
              value="standard"
              label="Standard · 3–5 business days"
              hint="Free over $150"
              defaultChecked
            />
            <Radio name="sg-delivery" value="express" label="Express · 1–2 business days" />
            <Radio name="sg-delivery" value="pickup" label="Pick up in store" />
            <Radio name="sg-delivery" value="sameday" label="Same day (not available)" disabled />
          </RadioGroup>
          <RadioGroup legend="Fit family" orientation="horizontal" error="Choose a fit.">
            <Radio name="sg-fit" value="regular" label="Regular" />
            <Radio name="sg-fit" value="petite" label="Petite" />
            <Radio name="sg-fit" value="tall" label="Tall" />
          </RadioGroup>
        </div>
      </Section>

      <Section id="badges" title="Badges & chips">
        <div className="flex flex-col gap-8">
          <div className="bg-surface-muted p-6">
            <Specimen label="Badges (on imagery) · priority: Sale → Final sale → Low stock → Back in stock → Exclusive → New">
              <Badge tone="sale">Sale −30%</Badge>
              <Badge tone="sale">Final sale</Badge>
              <Badge tone="warning">Low stock</Badge>
              <Badge tone="success">Back in stock</Badge>
              <Badge tone="inverse">Online exclusive</Badge>
              <Badge>New</Badge>
            </Specimen>
          </div>
          <Specimen label="Badge on page background">
            <Badge tone="muted">New</Badge>
          </Specimen>
          <Specimen label="Toggle chips (filter, fit) · interactive">
            <ToggleChipDemo />
          </Specimen>
          <Specimen label="Dismissible chips (active filters) · interactive">
            <DismissibleChipDemo />
          </Specimen>
        </div>
      </Section>

      <Section id="feedback" title="Loading & structure">
        <div className="flex flex-col gap-8">
          <Specimen label="Skeleton · product card at the final 3:4 layout">
            <div
              role="status"
              aria-busy="true"
              className="grid w-full grid-cols-2 gap-4 md:grid-cols-4"
            >
              <VisuallyHidden>Loading products</VisuallyHidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-3">
                  <Skeleton shape="product" />
                  <Skeleton shape="text" className="w-3/4" />
                  <Skeleton shape="text" className="w-1/3" />
                </div>
              ))}
            </div>
          </Specimen>
          <Specimen label="Divider · subtle / strong / vertical">
            <div className="flex w-full flex-col gap-4">
              <Divider />
              <Divider tone="strong" />
              <div className="flex h-8 items-center gap-4 text-sm">
                <span>Shipping</span>
                <Divider orientation="vertical" />
                <span>Returns</span>
              </div>
            </div>
          </Specimen>
          <Specimen label="Visually hidden · the text below is announced but not shown">
            <Button variant="secondary">
              <BagIcon /> 2<VisuallyHidden> items in your bag</VisuallyHidden>
            </Button>
          </Specimen>
        </div>
      </Section>
    </main>
  );
}
