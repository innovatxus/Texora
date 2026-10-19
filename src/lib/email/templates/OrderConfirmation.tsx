import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { formatMoney } from "@/lib/format/money";

/** Email styles use literal values: mail clients cannot read CSS variables. They mirror the ATELIER tokens. */
const INK = "#1a1a1a";
const SOFT = "#4a4744";
const SUBTLE = "#6e6963";
const LINE = "#ddd7cf";
const CANVAS = "#faf8f5";

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
    <Html lang="en">
      <Head />
      <Preview>{`Thank you for your order ${orderNumber}`}</Preview>
      <Body
        style={{
          backgroundColor: CANVAS,
          color: INK,
          fontFamily: "Helvetica, Arial, sans-serif",
          margin: 0,
        }}
      >
        <Container style={{ maxWidth: 560, padding: "40px 24px" }}>
          <Text
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {brandName}
          </Text>
          <Heading
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              fontSize: 30,
              margin: "32px 0 8px",
            }}
          >
            Thank you, {firstName}
          </Heading>
          <Text style={{ color: SOFT, fontSize: 15, lineHeight: "24px" }}>
            We&apos;ve received order <strong>{orderNumber}</strong> and will email you again when
            it ships.
          </Text>
          <Section style={{ margin: "24px 0" }}>
            <Link
              href={orderUrl}
              style={{
                backgroundColor: INK,
                color: "#ffffff",
                fontSize: 13,
                letterSpacing: "0.08em",
                padding: "14px 24px",
                textDecoration: "none",
                textTransform: "uppercase",
              }}
            >
              View your order
            </Link>
          </Section>
          <Hr style={{ borderColor: LINE }} />
          {lines.map((line) => (
            <Row key={line.name + line.detail} style={{ padding: "8px 0" }}>
              <Column>
                <Text style={{ fontSize: 14, margin: 0 }}>{line.name}</Text>
                <Text style={{ color: SUBTLE, fontSize: 13, margin: 0 }}>
                  {line.detail} · Qty {line.quantity}
                </Text>
              </Column>
              <Column align="right" style={{ fontSize: 14 }}>
                {formatMoney(line.lineTotal)}
              </Column>
            </Row>
          ))}
          <Hr style={{ borderColor: LINE }} />
          {row("Subtotal", formatMoney(totals.subtotal))}
          {totals.discount > 0 && row("Discounts", `−${formatMoney(totals.discount)}`)}
          {row("Shipping", totals.shipping === 0 ? "Free" : formatMoney(totals.shipping))}
          {row("Tax", formatMoney(totals.tax))}
          {totals.giftCard > 0 && row("Gift card", `−${formatMoney(totals.giftCard)}`)}
          {totals.rewards > 0 && row("Rewards", `−${formatMoney(totals.rewards)}`)}
          {row("Total", formatMoney(totals.total), true)}
          <Hr style={{ borderColor: LINE }} />
          <Text style={{ color: SOFT, fontSize: 14 }}>
            <strong style={{ color: INK }}>Delivery:</strong> {delivery}
          </Text>
          <Text style={{ color: SOFT, fontSize: 14 }}>
            <strong style={{ color: INK }}>Payment:</strong> {paymentNote}
          </Text>
          <Text style={{ color: SUBTLE, fontSize: 12, marginTop: 32 }}>
            Questions? Reply to this email or visit our help centre. Free returns within 30 days
            (final sale items excluded).
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
