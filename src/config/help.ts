/**
 * Help centre content. Typed and versioned with the code for now; the
 * content team moves it to the CMS with the back office (Phase 8).
 * Numbers here must match the rules in code: shipping rates and thresholds
 * (settings), the return window (lib/returns/policy) and loyalty tiers.
 */
import { brand } from "./brand";
import { MERCHANT_FEES, MERCHANT_LIMITS } from "./merchant";

export type HelpGroup = "help" | "about" | "legal" | "merchants";

export interface HelpSection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
}

export interface HelpTopic {
  slug: string;
  title: string;
  summary: string;
  group: HelpGroup;
  sections: HelpSection[];
}

/** FAQ groups, in display order. */
export const FAQ_CATEGORIES = [
  "Orders & delivery",
  "Returns & refunds",
  "Payment & gift cards",
  "Sizing & products",
  `${brand.name} Rewards`,
  "Stores",
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export interface FaqEntry {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  /** Related help topic or page. */
  link?: { label: string; href: string };
}

/** Every FAQ entry, used by the help search and the FAQ page. */
export const FAQ: readonly FaqEntry[] = [
  {
    id: "track-order",
    category: "Orders & delivery",
    question: "How do I track my order?",
    answer:
      "Use the link in your order confirmation email, or look your order up with its number and the email you used at checkout. You'll see each step from preparing to delivered, with tracking numbers once it ships.",
    link: { label: "Track an order", href: "/orders/lookup" },
  },
  {
    id: "delivery-times",
    category: "Orders & delivery",
    question: "How long does delivery take?",
    answer:
      "In Cairo and Giza, Standard delivery takes 1–3 days and Express arrives the next day. Elsewhere in Egypt, Standard takes 3–5 days and Express 2–3 days. Couriers deliver Saturday to Thursday; orders placed before 2pm leave our warehouse the same day.",
    link: { label: "Shipping information", href: "/help/shipping" },
  },
  {
    id: "shipping-cost",
    category: "Orders & delivery",
    question: "How much does delivery cost?",
    answer:
      "In Cairo and Giza, Standard delivery is EGP 60 and Express EGP 120. Elsewhere in Egypt, Standard is EGP 95 and Express EGP 180. Standard delivery is free on orders over EGP 2,500. Prices exclude 14% VAT, which is added at checkout.",
  },
  {
    id: "change-order",
    category: "Orders & delivery",
    question: "Can I change or cancel my order?",
    answer:
      "We start preparing orders quickly, so contact us as soon as possible. If your order hasn't been prepared yet we can cancel it; once it has shipped, you can return it free of charge.",
    link: { label: "Contact us", href: "/help/contact" },
  },
  {
    id: "store-pickup",
    category: "Orders & delivery",
    question: "Can I pick up my online order in a store?",
    answer:
      "Not at the moment: online orders are delivered to your address. You can still return online orders in any of our stores.",
  },
  {
    id: "return-policy",
    category: "Returns & refunds",
    question: "What is your return policy?",
    answer:
      "You can return unworn items with their tags within 30 days of delivery, free of charge, by courier collection or in any store. Items marked final sale can't be returned.",
    link: { label: "Returns & exchanges", href: "/help/returns" },
  },
  {
    id: "start-return",
    category: "Returns & refunds",
    question: "How do I start a return?",
    answer:
      "Find your order, choose Start a return, pick the items and tell us why. For courier collection you'll get a QR code and the courier picks the parcel up from your address; for in-store returns, just bring the items and the QR code.",
    link: { label: "Find your order", href: "/orders/lookup" },
  },
  {
    id: "refund-time",
    category: "Returns & refunds",
    question: "When will I get my refund?",
    answer:
      "We refund within 5 business days of receiving your return, to your original payment method or as store credit if you chose that. Your bank may take a few more days to show it. Original shipping charges are not refunded.",
  },
  {
    id: "exchange",
    category: "Returns & refunds",
    question: "Can I exchange an item for another size?",
    answer:
      "The quickest way is to return the original for a refund and place a new order for the size you need, so it isn't held up while the return travels back to us.",
  },
  {
    id: "payment-methods",
    category: "Payment & gift cards",
    question: "Which payment methods do you accept?",
    answer:
      "We accept Visa, Mastercard and Meeza cards, mobile wallets such as Vodafone Cash, and cash on delivery. You can also use a gift card or your rewards toward any order. Card and wallet payments are processed securely by Paymob.",
  },
  {
    id: "gift-card-balance",
    category: "Payment & gift cards",
    question: "How do I check my gift card balance?",
    answer:
      "Enter the card number on our gift cards page to see the remaining balance and expiry date. You can use a gift card across as many orders as you like until the balance runs out.",
    link: { label: "Check a balance", href: "/gift-cards#balance" },
  },
  {
    id: "buy-gift-card",
    category: "Payment & gift cards",
    question: "Can I send an e-gift card?",
    answer:
      "Yes. Choose an amount from EGP 250 to EGP 25,000, add a message and pick a delivery date. We email the card to the recipient on that day and send you a receipt.",
    link: { label: "Send an e-gift card", href: "/gift-cards/buy" },
  },
  {
    id: "find-size",
    category: "Sizing & products",
    question: "How do I find my size?",
    answer:
      "Each product page has a size guide with body measurements, and reviews tell you whether an item runs small, true to size or large. Petite is cut for 160 cm and under, Tall for 175 cm and over.",
    link: { label: "Size guides", href: "/help/size-guides" },
  },
  {
    id: "back-in-stock",
    category: "Sizing & products",
    question: "My size is sold out. Will it come back?",
    answer:
      "Often, yes. Select the sold-out size on the product page and choose Notify me: we'll email you once when it's back in stock.",
  },
  {
    id: "price-drop",
    category: "Sizing & products",
    question: "Can you tell me if something goes on sale?",
    answer:
      "Yes. On any product page, choose Email me if the price drops and we'll send you one email if the price goes down.",
  },
  {
    id: "care",
    category: "Sizing & products",
    question: "How should I care for my clothes?",
    answer:
      "Follow the care label: it's specific to each fabric. In general, wash less often, wash cool, and dry flat or on a line to keep shape and colour.",
    link: { label: "Materials & care", href: "/help/materials" },
  },
  {
    id: "rewards-earn",
    category: `${brand.name} Rewards`,
    question: "How do I earn points?",
    answer:
      "Members earn 1 point for every EGP 1 spent on merchandise. Enthusiast members (from EGP 25,000 a year) earn 25% more, and Icon members (from EGP 75,000 a year) earn 50% more.",
  },
  {
    id: "rewards-redeem",
    category: `${brand.name} Rewards`,
    question: "How do I use my points?",
    answer:
      "Every 500 points is worth EGP 50 off. In your bag or at checkout, choose how much of your rewards to apply.",
  },
  {
    id: "store-returns",
    category: "Stores",
    question: "Can I return online orders in a store?",
    answer:
      "Yes, at any of our stores. Start the return online and choose drop off in store, then bring the items and your QR code.",
    link: { label: "Find a store", href: "/stores" },
  },
  {
    id: "alterations",
    category: "Stores",
    question: "Do you offer alterations?",
    answer:
      "All our stores offer hemming and simple alterations, and our Zamalek store also offers personal styling appointments.",
    link: { label: "Find a store", href: "/stores" },
  },
];

/** Help centre topics: the slug, title, group and content of each page. */
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    slug: "shipping",
    title: "Shipping",
    summary: "Delivery options, costs and times.",
    group: "help",
    sections: [
      {
        heading: "Delivery options",
        list: [
          "Cairo and Giza: Standard 1–3 days, EGP 60; Express next day, EGP 120.",
          "Other governorates: Standard 3–5 days, EGP 95; Express 2–3 days, EGP 180.",
          "Standard delivery is free on orders over EGP 2,500. Prices exclude 14% VAT.",
        ],
      },
      {
        heading: "When your order leaves us",
        paragraphs: [
          "Orders placed before 2pm on a business day leave our warehouse the same day. Orders placed later, or on a Friday, leave the next business day. Your delivery estimate at checkout already allows for this.",
        ],
      },
      {
        heading: "Tracking",
        paragraphs: [
          "Once your order ships we add the carrier and tracking number to your order page. Use the link in your confirmation email or look your order up with its number and email.",
        ],
      },
      {
        heading: "Where we deliver",
        paragraphs: [
          "We deliver to addresses in all 27 governorates of Egypt. Prices are in Egyptian pounds (EGP).",
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns & exchanges",
    summary: "Free returns within 30 days, by courier collection or in store.",
    group: "help",
    sections: [
      {
        heading: "Our policy",
        paragraphs: [
          "Return unworn, unwashed items with their tags within 30 days of delivery for a full refund of the price you paid. Returns are free by courier collection and in any of our stores. Items marked final sale can't be returned.",
        ],
      },
      {
        heading: "How to return",
        list: [
          "Find your order and choose Start a return.",
          "Select the items, the quantity and the reason.",
          "Choose courier collection (we give you a QR code and a courier collects from your address) or drop off in store.",
          "Pack the items securely and send them, or bring them to a store with your QR code.",
        ],
      },
      {
        heading: "Refunds",
        paragraphs: [
          "We refund within 5 business days of receiving your return, to your original payment method or as store credit. Original shipping charges aren't refunded. Points earned on returned items are removed from your rewards balance.",
        ],
      },
      {
        heading: "Exchanges",
        paragraphs: [
          "To get a different size or colour quickly, return the original and place a new order.",
        ],
      },
    ],
  },
  {
    slug: "size-guides",
    title: "Size guides",
    summary: "Body measurements for every size and fit family.",
    group: "help",
    sections: [],
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    summary: "Quick answers about orders, returns, payment and more.",
    group: "help",
    sections: [],
  },
  {
    slug: "contact",
    title: "Contact us",
    summary: "Talk to our customer care team.",
    group: "help",
    sections: [],
  },
  {
    slug: "about",
    title: "Our story",
    summary: `Why ${brand.name} makes clothes the way it does.`,
    group: "about",
    sections: [
      {
        paragraphs: [
          `${brand.name} makes considered clothing: tailored essentials and seasonal collections designed to be worn for years. We cut our core styles in Regular, Petite and Tall fits, because a good fit shouldn't be an afterthought.`,
          "We work with a small number of mills and makers, choose natural and recycled fibres where we can, and design pieces that work together season after season.",
        ],
      },
    ],
  },
  {
    slug: "materials",
    title: "Materials & care",
    summary: "The fibres we use and how to look after them.",
    group: "about",
    sections: [
      {
        heading: "Linen",
        paragraphs: [
          "Breathable and stronger when wet. Wash cool, reshape while damp and line dry. Creases are part of its character.",
        ],
      },
      {
        heading: "Wool, merino and cashmere",
        paragraphs: [
          "Naturally odour-resistant, so wash rarely. Hand wash cold or use a wool cycle, dry flat, and fold rather than hang.",
        ],
      },
      {
        heading: "Cotton and denim",
        paragraphs: [
          "Wash inside out in cold water to keep colour, and skip the dryer to avoid shrinking.",
        ],
      },
    ],
  },
  {
    slug: "careers",
    title: "Careers",
    summary: `Work with ${brand.name}.`,
    group: "about",
    sections: [
      {
        paragraphs: [
          `We hire for our stores, studio and customer care team. To hear about openings, email ${brand.support.email} with the role you're interested in.`,
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary: "How we collect, use and protect your information.",
    group: "legal",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "The details you give us when you order, create an account or contact us (such as your name, email, addresses and order history), and, with your consent, how you use our site.",
        ],
      },
      {
        heading: "How we use it",
        list: [
          "To process and deliver your orders and returns.",
          "To provide customer care and keep your account secure.",
          "To send marketing only if you've opted in. You can unsubscribe at any time.",
          "To measure and improve the site, only with your cookie consent.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          `You can change cookie settings from the link in the footer and ask us for a copy of your data, or for it to be deleted, by emailing ${brand.support.email}. We never sell your personal information.`,
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of use",
    summary: "The terms that apply when you use our site and buy from us.",
    group: "legal",
    sections: [
      {
        paragraphs: [
          "Prices and availability can change until you place your order. Your order is a request to buy; the contract is formed when we confirm it by email. We may cancel an order and refund you in full if an item is mispriced or unavailable.",
          "Promotions can't be exchanged for cash and are subject to their own terms. Gift cards are valid for five years from purchase and can't be redeemed for cash except where required by law.",
        ],
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    summary: "Our commitment to an accessible site.",
    group: "legal",
    sections: [
      {
        paragraphs: [
          "We design and test this site to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, including full keyboard support, screen-reader labels and sufficient colour contrast.",
          `If something doesn't work for you, tell us at ${brand.support.email} or ${brand.support.phone} and we'll help you complete your order and fix the problem.`,
        ],
      },
    ],
  },
  {
    slug: "merchants",
    title: `Selling on ${brand.name}`,
    summary: "How the merchant programme works, from registering to your first order.",
    group: "merchants",
    sections: [
      {
        paragraphs: [
          `Merchants sell their own fashion on ${brand.name}. Your products appear in our search, filters and category pages under ${brand.name}, and shoppers check out with us as usual. Your shop name and details stay private to you and the ${brand.name} team.`,
        ],
      },
      {
        heading: "How it works",
        list: [
          "Register a merchant account with your email, a username and a password.",
          "Build your shop: name and address, logo, contact details, policies and locations.",
          "Submit your shop for review. We usually reply within 1 business day.",
          "Add products with colours, fits, sizes, prices, stock and photos. They go live once your shop is approved.",
          "Ship orders from your own location and add the carrier and tracking number in your dashboard.",
        ],
      },
      {
        heading: "Fees",
        paragraphs: [
          `There are no monthly or listing fees. We take a ${MERCHANT_FEES.commissionPercent}% commission on each item sold. Payouts are arranged with our merchant team while self-serve payouts are being built.`,
        ],
      },
    ],
  },
  {
    slug: "merchants/getting-started",
    title: "Setting up your shop",
    summary: "What each onboarding step needs and how review works.",
    group: "merchants",
    sections: [
      {
        heading: "What you'll need",
        list: [
          `A square logo, at least ${MERCHANT_LIMITS.logo.minWidth}×${MERCHANT_LIMITS.logo.minHeight} px (PNG, JPG, WebP or SVG, up to 5 MB).`,
          "A public contact email, and optionally a phone number, website and social handles.",
          "At least one ship-from location in Egypt. Retail stores can be listed too.",
        ],
      },
      {
        heading: "Review",
        paragraphs: [
          "You can save each step and come back on any device. When everything is ready, submit your shop from the review step. You need to verify your email first.",
          "If we need changes, you'll see exactly what to fix on your dashboard and by email. Fix them and submit again.",
        ],
      },
    ],
  },
  {
    slug: "merchants/products",
    title: "Listing products",
    summary: "Options, variants, photos and what we check before a product goes live.",
    group: "merchants",
    sections: [
      {
        heading: "Options and variants",
        paragraphs: [
          "Add each colour you make, the fits (regular, petite, tall or plus) and the sizes. We build every combination for you; switch off the ones you don't make and set the price and stock for the rest.",
        ],
      },
      {
        heading: "Photos",
        list: [
          `1 to ${MERCHANT_LIMITS.productImage.maxPerColor} photos per colour, at least ${MERCHANT_LIMITS.productImage.minLongEdge} px on the long edge, in a 3:4 portrait crop.`,
          "The first photo is the main image and the second shows on hover.",
          "Every photo needs a short description (alt text) for shoppers using screen readers.",
        ],
      },
      {
        heading: "Before a product goes live",
        list: [
          "Your shop is approved and your email is verified.",
          "At least one colour has a photo, and every photo has alt text.",
          "Every variant you make has a price, and at least one has stock or allows backorder.",
          "The category's required details, such as material, are filled in.",
        ],
      },
    ],
  },
  {
    slug: "merchants/orders",
    title: "Orders and shipping",
    summary: "Seeing your orders and marking them shipped.",
    group: "merchants",
    sections: [
      {
        paragraphs: [
          "When a shopper buys your products, the order appears in your dashboard with only your items and the delivery address. Ship within the processing time you set, then add the carrier and tracking number. We email the customer for you.",
          "Shoppers pay our standard delivery rates at checkout. Returns follow the policy shown on your products: ours (30 days) or your own.",
        ],
      },
    ],
  },
  {
    slug: "merchants/terms",
    title: "Merchant terms",
    summary: `The terms for selling on ${brand.name}.`,
    group: "merchants",
    sections: [
      {
        heading: "Eligibility",
        paragraphs: [
          "You must be a business or sole trader in Egypt with a ship-from address in Egypt, and be authorised to sell everything you list.",
        ],
      },
      {
        heading: "Listings",
        paragraphs: [
          "Listings must be accurate: real photos, correct sizing, materials and care, and prices you honour. We may decline, pause or remove listings that break these terms or our content standards.",
        ],
      },
      {
        heading: "Orders, returns and fees",
        paragraphs: [
          `You ship each order within your stated processing time (1–2 or 3–5 business days), and every shop follows Texora's returns policy: 30-day returns, unworn with tags. We charge a ${MERCHANT_FEES.commissionPercent}% commission on the item price of each sale, with no monthly or listing fees.`,
        ],
      },
      {
        heading: "Suspension and closing",
        paragraphs: [
          "We may suspend a shop that breaks these terms; we'll tell you why and how to resolve it. You can close your shop at any time and reopen it within 30 days.",
        ],
      },
    ],
  },
];

/** The help topic for a URL slug, if there is one. */
export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}

/** Topics a customer can choose on the contact form. */
export const CONTACT_TOPICS = [
  { value: "order", label: "An existing order" },
  { value: "return", label: "Returns and refunds" },
  { value: "product", label: "Products and sizing" },
  { value: "payment", label: "Payment and gift cards" },
  { value: "other", label: "Something else" },
] as const;
