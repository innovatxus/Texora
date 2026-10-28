import { TAX_LABEL } from "@/lib/pricing/tax";
import { Column, Hr, Row, Text } from "@react-email/components";
import { formatMoney } from "@/lib/format/money";
import { EMAIL_COLORS, EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

export interface OrderConfirmationProps {
  brandName: string;
  orderNumber: string;
  firstName: string;
  orderUrl: string;
  lines: Array<{ name: string; detail: string; quantity: number; lineTotal: number }>;
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    giftCard: number;
    rewards: number;
    total: number;
  };
  delivery: string;
  paymentNote: string;
}

const { ink: INK, soft: SOFT, subtle: SUBTLE, line: LINE } = EMAIL_COLORS;

/** Order confirmation email: items, totals, delivery and payment, with a link to the order. */
export function OrderConfirmationEmail(props: OrderConfirmationProps) {
  const { brandName, orderNumber, firstName, orderUrl, lines, totals, delivery, paymentNote } =
    props;
  const row = (label: string, value: string, strong = false) => (
    <Row>
      <Column
        style={{
          color: strong ? INK : SOFT,
          fontSize: 14,
          fontWeight: strong ? 600 : 400,
          padding: "4px 0",
        }}
      >
        {label}
      </Column>
      <Column align="right" style={{ color: INK, fontSize: 14, fontWeight: strong ? 600 : 400 }}>
        {value}
      </Column>
    </Row>
  );
  return (
    <EmailLayout
      brandName={brandName}
      preview={`Thank you for your order ${orderNumber}`}
      footer="Questions? Reply to this email or visit our help centre. Free returns within 30 days (final sale items excluded)."
    >
      <EmailHeading>Thank you, {firstName}</EmailHeading>
      <EmailText>
        We&apos;ve received order <strong>{orderNumber}</strong> and will email you again when it
        ships.
      </EmailText>
      <EmailButton href={orderUrl}>View your order</EmailButton>
      <Hr style={{ borderColor: LINE, margin: "24px 0 8px" }} />
      {lines.map((line) => (
        <Row key={line.name + line.detail} style={{ padding: "8px 0" }}>
          <Column>
            <Text style={{ color: INK, fontSize: 14, margin: 0 }}>{line.name}</Text>
            <Text style={{ color: SUBTLE, fontSize: 13, margin: 0 }}>
              {line.detail} · Qty {line.quantity}
            </Text>
          </Column>
          <Column align="right" style={{ color: INK, fontSize: 14 }}>
            {formatMoney(line.lineTotal)}
          </Column>
        </Row>
      ))}
      <Hr style={{ borderColor: LINE, margin: "8px 0" }} />
      {row("Subtotal", formatMoney(totals.subtotal))}
      {totals.discount > 0 && row("Discounts", `−${formatMoney(totals.discount)}`)}
      {row("Shipping", totals.shipping === 0 ? "Free" : formatMoney(totals.shipping))}
      {row(TAX_LABEL, formatMoney(totals.tax))}
      {totals.giftCard > 0 && row("Gift card", `−${formatMoney(totals.giftCard)}`)}
      {totals.rewards > 0 && row("Rewards", `−${formatMoney(totals.rewards)}`)}
      {row("Total", formatMoney(totals.total), true)}
      <Hr style={{ borderColor: LINE, margin: "8px 0 16px" }} />
      <Text style={{ color: SOFT, fontSize: 14, margin: "0 0 8px" }}>
        <strong style={{ color: INK }}>Delivery:</strong> {delivery}
      </Text>
      <Text style={{ color: SOFT, fontSize: 14, margin: 0 }}>
        <strong style={{ color: INK }}>Payment:</strong> {paymentNote}
      </Text>
    </EmailLayout>
  );
}
