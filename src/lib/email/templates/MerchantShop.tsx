import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** To the merchant when they submit their shop. */
export function ShopSubmittedEmail({
  brandName,
  shopName,
  link,
}: {
  brandName: string;
  shopName: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`We've received ${shopName}`}>
      <EmailHeading>We&apos;ve received your shop</EmailHeading>
      <EmailText>
        Thanks for submitting {shopName}. We usually reply within 1 business day. You can keep
        adding products in the meantime; they go live when your shop is approved.
      </EmailText>
      <EmailButton href={link}>Go to your dashboard</EmailButton>
    </EmailLayout>
  );
}

/** To the merchant team when a shop is waiting for review. */
export function ShopReviewRequestEmail({
  brandName,
  shopName,
  merchantEmail,
  link,
}: {
  brandName: string;
  shopName: string;
  merchantEmail: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`${shopName} is waiting for review`}>
      <EmailHeading>A shop is waiting for review</EmailHeading>
      <EmailText>
        {shopName} ({merchantEmail}) has been submitted for review.
      </EmailText>
      <EmailButton href={link}>Review the shop</EmailButton>
    </EmailLayout>
  );
}

/** To the merchant when a reviewer decides, or the shop is paused or reinstated. */
export function ShopDecisionEmail({
  brandName,
  shopName,
  decision,
  reasons,
  link,
}: {
  brandName: string;
  shopName: string;
  decision: "approved" | "changes_requested" | "rejected" | "suspended" | "reinstated";
  reasons: readonly string[];
  link: string;
}) {
  const copy = {
    approved: {
      heading: "Your shop is live",
      body: `${shopName} is now live on ${brandName}. Products you publish appear in search and on your shop page.`,
      cta: "Add a product",
    },
    changes_requested: {
      heading: "A few changes before your shop goes live",
      body: `We've reviewed ${shopName} and need a few changes:`,
      cta: "Make changes",
    },
    rejected: {
      heading: "We can't approve your shop yet",
      body: `We've reviewed ${shopName} and can't approve it as it is:`,
      cta: "Go to your dashboard",
    },
    suspended: {
      heading: "Your shop has been paused",
      body: `${shopName} is hidden from shoppers for now. Reason:`,
      cta: "Go to your dashboard",
    },
    reinstated: {
      heading: "Your shop is live again",
      body: `${shopName} is visible to shoppers again.`,
      cta: "Go to your dashboard",
    },
  }[decision];
  return (
    <EmailLayout brandName={brandName} preview={copy.heading}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <EmailText>{copy.body}</EmailText>
      {reasons.map((reason) => (
        <EmailText key={reason}>• {reason}</EmailText>
      ))}
      <EmailButton href={link}>{copy.cta}</EmailButton>
    </EmailLayout>
  );
}
