import { Column, Hr, Img, Row, Text } from "@react-email/components";
import { formatMoney } from "@/lib/format/money";
import { EMAIL_COLORS, EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

export interface ReturnInstructionsProps {
  brandName: string;
  returnNumber: string;
  orderNumber: string;
  returnUrl: string;
  method: "mail" | "store";
  storeName?: string;
  /** Absolute URL of the QR code image (signed route; mail clients block data: URLs). */
  qrImageUrl: string;
  lines: Array<{ name: string; detail: string; quantity: number }>;
  refundEstimate: number;
  refundTo: "original" | "store_credit";
  deadline: string;
}

export function ReturnInstructionsEmail(props: ReturnInstructionsProps) {
  const { brandName, returnNumber, orderNumber, returnUrl, method, storeName, qrImageUrl } = props;
  return (
    <EmailLayout brandName={brandName} preview={`Your return ${returnNumber} is ready`}>
      <EmailHeading>Your return is ready</EmailHeading>
      <EmailText>
        Return <strong>{returnNumber}</strong> for order {orderNumber} is approved.{" "}
        {method === "mail"
          ? "Pack the items securely, attach the prepaid label from your return page and drop the parcel at any carrier location."
          : `Bring the items to ${storeName ?? "any of our stores"} and show this QR code at the till.`}{" "}
        Please send them by {props.deadline}.
      </EmailText>
      <Img src={qrImageUrl} width="160" height="160" alt={`QR code for return ${returnNumber}`} />
      <EmailButton href={returnUrl}>View your return</EmailButton>
      <Hr style={{ borderColor: EMAIL_COLORS.line }} />
      {props.lines.map((line) => (
        <Row key={line.name + line.detail} style={{ padding: "6px 0" }}>
          <Column>
            <Text style={{ fontSize: 14, margin: 0 }}>{line.name}</Text>
            <Text style={{ color: EMAIL_COLORS.subtle, fontSize: 13, margin: 0 }}>
              {line.detail} · Qty {line.quantity}
            </Text>
          </Column>
        </Row>
      ))}
      <Hr style={{ borderColor: EMAIL_COLORS.line }} />
      <EmailText>
        Expected refund: <strong>{formatMoney(props.refundEstimate)}</strong>{" "}
        {props.refundTo === "store_credit" ? "as store credit" : "to your original payment method"},
        within 5 business days of the return reaching us.
      </EmailText>
    </EmailLayout>
  );
}
