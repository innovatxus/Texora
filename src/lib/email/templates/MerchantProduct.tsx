import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** To the merchant team when a product is waiting for review. */
export function ProductReviewRequestEmail({
  brandName,
  productName,
  shopName,
  link,
}: {
  brandName: string;
  productName: string;
  shopName: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`${productName} is waiting for review`}>
      <EmailHeading>A product is waiting for review</EmailHeading>
      <EmailText>
        {shopName} submitted {productName}.
      </EmailText>
      <EmailButton href={link}>Review the product</EmailButton>
    </EmailLayout>
  );
}

/** To the merchant when a product is approved or needs changes. */
export function ProductDecisionEmail({
  brandName,
  productName,
  decision,
  reasons,
  link,
}: {
  brandName: string;
  productName: string;
  decision: "approved" | "changes_requested";
  reasons: readonly string[];
  link: string;
}) {
  const approved = decision === "approved";
  return (
    <EmailLayout
      brandName={brandName}
      preview={approved ? `${productName} is live` : `Changes needed for ${productName}`}
    >
      <EmailHeading>
        {approved ? `${productName} is live` : `Changes needed for ${productName}`}
      </EmailHeading>
      <EmailText>
        {approved
          ? `${productName} has been approved and is live on ${brandName} (or will be at the time you scheduled).`
          : "We reviewed your product and need a few changes before it goes live:"}
      </EmailText>
      {reasons.map((reason) => (
        <EmailText key={reason}>• {reason}</EmailText>
      ))}
      <EmailButton href={link}>{approved ? "View your products" : "Make changes"}</EmailButton>
    </EmailLayout>
  );
}
