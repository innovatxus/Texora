import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** To a merchant when an order with their items is placed (their lines only). */
export function MerchantNewOrderEmail({
  brandName,
  orderNumber,
  lines,
  link,
}: {
  brandName: string;
  orderNumber: string;
  lines: ReadonlyArray<{ name: string; detail: string }>;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`New order ${orderNumber}`}>
      <EmailHeading>New order {orderNumber}</EmailHeading>
      <EmailText>Ship these items within your processing time:</EmailText>
      {lines.map((line) => (
        <EmailText key={`${line.name}-${line.detail}`}>
          • {line.name} — {line.detail}
        </EmailText>
      ))}
      <EmailButton href={link}>View and ship the order</EmailButton>
    </EmailLayout>
  );
}

/** To the customer when a merchant ships their part of an order. */
export function MerchantShippedEmail({
  brandName,
  orderNumber,
  shopName,
  carrier,
  trackingNumber,
  link,
}: {
  brandName: string;
  orderNumber: string;
  shopName: string;
  carrier: string;
  trackingNumber: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`Part of your order ${orderNumber} has shipped`}>
      <EmailHeading>Your items from {shopName} are on the way</EmailHeading>
      <EmailText>
        Part of your order {orderNumber} has shipped with {carrier}. Tracking number:{" "}
        {trackingNumber}.
      </EmailText>
      <EmailButton href={link}>Track your order</EmailButton>
    </EmailLayout>
  );
}
