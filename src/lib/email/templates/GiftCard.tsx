import { Section, Text } from "@react-email/components";
import { formatMoney } from "@/lib/format/money";
import {
  EMAIL_COLORS,
  EMAIL_DISPLAY,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./Layout";

export interface GiftCardEmailProps {
  brandName: string;
  recipientName: string;
  senderName: string;
  message?: string;
  amount: number;
  code: string;
  expiresOn: string;
  shopUrl: string;
}

/** Sent to the recipient on the chosen delivery date. */
export function GiftCardEmail(props: GiftCardEmailProps) {
  return (
    <EmailLayout
      brandName={props.brandName}
      preview={`${props.senderName} sent you a ${formatMoney(props.amount)} gift card`}
      footer="Use the code at checkout. Keep it safe: anyone with the code can spend the balance."
    >
      <EmailHeading>A gift for you, {props.recipientName}</EmailHeading>
      <EmailText>
        {props.senderName} sent you a {props.brandName} gift card worth{" "}
        <strong>{formatMoney(props.amount)}</strong>.
      </EmailText>
      {props.message && (
        <Text
          style={{
            borderLeft: `2px solid ${EMAIL_COLORS.line}`,
            color: EMAIL_COLORS.ink,
            fontFamily: EMAIL_DISPLAY,
            fontSize: 17,
            fontStyle: "italic",
            lineHeight: "26px",
            paddingLeft: 16,
          }}
        >
          {props.message}
        </Text>
      )}
      <Section
        style={{
          backgroundColor: EMAIL_COLORS.surface,
          border: `1px solid ${EMAIL_COLORS.line}`,
          margin: "24px 0",
          padding: "20px 24px",
        }}
      >
        <Text style={{ color: EMAIL_COLORS.subtle, fontSize: 12, margin: 0 }}>Gift card code</Text>
        <Text style={{ fontFamily: "Courier, monospace", fontSize: 20, letterSpacing: "0.08em" }}>
          {props.code}
        </Text>
        <Text style={{ color: EMAIL_COLORS.subtle, fontSize: 12, margin: 0 }}>
          Valid until {props.expiresOn}
        </Text>
      </Section>
      <EmailButton href={props.shopUrl}>Start shopping</EmailButton>
    </EmailLayout>
  );
}

export interface GiftCardReceiptProps {
  brandName: string;
  amount: number;
  recipientName: string;
  recipientEmail: string;
  deliverOn: string;
  statusUrl: string;
}

/** Sent to the buyer once payment is confirmed. */
export function GiftCardReceiptEmail(props: GiftCardReceiptProps) {
  return (
    <EmailLayout brandName={props.brandName} preview="Your e-gift card is confirmed">
      <EmailHeading>Your gift is on its way</EmailHeading>
      <EmailText>
        Thank you. We&apos;ll email a <strong>{formatMoney(props.amount)}</strong> gift card to{" "}
        {props.recipientName} ({props.recipientEmail}) on {props.deliverOn}.
      </EmailText>
      <EmailButton href={props.statusUrl}>View your purchase</EmailButton>
    </EmailLayout>
  );
}
