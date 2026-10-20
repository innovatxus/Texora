import { Img } from "@react-email/components";
import { formatMoney } from "@/lib/format/money";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

export interface ProductAlertProps {
  brandName: string;
  kind: "back_in_stock" | "price_drop";
  productName: string;
  productUrl: string;
  imageUrl?: string;
  /** Size that came back (back in stock). */
  size?: string;
  /** Prices in cents (price drop). */
  oldPrice?: number;
  newPrice?: number;
  unsubscribeUrl: string;
}

export function ProductAlertEmail(props: ProductAlertProps) {
  const backInStock = props.kind === "back_in_stock";
  const heading = backInStock ? "It's back in stock" : "The price just dropped";
  return (
    <EmailLayout
      brandName={props.brandName}
      preview={`${props.productName}: ${backInStock ? "back in stock" : "now for less"}`}
      unsubscribeUrl={props.unsubscribeUrl}
      footer="You asked us to tell you about this item. We send each alert once."
    >
      <EmailHeading>{heading}</EmailHeading>
      <EmailText>
        {backInStock ? (
          <>
            <strong>{props.productName}</strong>
            {props.size ? ` in size ${props.size}` : ""} is available again. Popular sizes sell
            quickly, so don&apos;t wait too long.
          </>
        ) : (
          <>
            <strong>{props.productName}</strong> is now{" "}
            <strong>{formatMoney(props.newPrice ?? 0)}</strong>
            {props.oldPrice ? `, down from ${formatMoney(props.oldPrice)}` : ""}.
          </>
        )}
      </EmailText>
      {props.imageUrl && (
        <Img src={props.imageUrl} width="240" alt={props.productName} style={{ marginTop: 16 }} />
      )}
      <EmailButton href={props.productUrl}>Shop now</EmailButton>
    </EmailLayout>
  );
}
