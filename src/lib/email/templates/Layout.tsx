import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Email styles use literal values: mail clients cannot read CSS variables. They mirror the ATELIER tokens. */
export const EMAIL_COLORS = {
  ink: "#1a1a1a",
  soft: "#4a4744",
  subtle: "#6e6963",
  line: "#ddd7cf",
  canvas: "#faf8f5",
  surface: "#ffffff",
} as const;

/** Shared email frame: brand header, content, footer and optional unsubscribe link. */
export function EmailLayout({
  brandName,
  preview,
  children,
  footer,
  unsubscribeUrl,
}: {
  brandName: string;
  preview: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Shown for marketing-style alerts (back in stock, price drop). */
  unsubscribeUrl?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: EMAIL_COLORS.canvas,
          color: EMAIL_COLORS.ink,
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
          {children}
          <Text style={{ color: EMAIL_COLORS.subtle, fontSize: 12, marginTop: 32 }}>
            {footer ?? "Questions? Reply to this email or visit our help centre."}
          </Text>
          {unsubscribeUrl && (
            <Text style={{ color: EMAIL_COLORS.subtle, fontSize: 12 }}>
              <Link href={unsubscribeUrl} style={{ color: EMAIL_COLORS.subtle }}>
                Stop these emails
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

/** Email headline in the display serif. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 30, margin: "32px 0 8px" }}
    >
      {children}
    </Heading>
  );
}

/** Email body paragraph. */
export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: EMAIL_COLORS.soft, fontSize: 15, lineHeight: "24px" }}>{children}</Text>
  );
}

/** Email call-to-action button (a styled link, which every mail client supports). */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Link
        href={href}
        style={{
          backgroundColor: EMAIL_COLORS.ink,
          color: "#ffffff",
          fontSize: 13,
          letterSpacing: "0.08em",
          padding: "14px 24px",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        {children}
      </Link>
    </Section>
  );
}
