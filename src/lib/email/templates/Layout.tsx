import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { clientEnv } from "@/lib/env/client";

/**
 * Email styles use literal values: mail clients can't read CSS variables. They
 * mirror the site's tokens: limestone canvas, white card, ink text and the
 * military-green brand colour.
 */
export const EMAIL_COLORS = {
  ink: "#1a1a1a",
  /** Brand: military green (logo, buttons, accents). */
  brand: "#4b5320",
  brandTint: "#eef0e4",
  soft: "#4a4744",
  subtle: "#6e6963",
  line: "#ddd7cf",
  canvas: "#faf8f5",
  muted: "#f1ede7",
  surface: "#ffffff",
} as const;

/** Display serif with safe fallbacks (Gmail and Outlook ignore web fonts). */
export const EMAIL_DISPLAY = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const EMAIL_SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const site = (path: string) => new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();

const FOOTER_LINKS: ReadonlyArray<[string, string]> = [
  ["Help centre", "/help"],
  ["Track an order", "/orders/lookup"],
  ["Delivery", "/help/shipping"],
  ["Returns", "/help/returns"],
];

/**
 * Shared email frame in Texora's look: the green wordmark over a fine rule, a
 * white card on limestone, and a footer with help links. Content goes in the
 * card; `footer` replaces the default help line.
 */
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
      <Head>
        {/* Web fonts where the client allows them (Apple Mail, iOS); others use the fallbacks. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- an email, not a Next.js page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@400;600&display=swap"
        />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: EMAIL_COLORS.canvas,
          color: EMAIL_COLORS.ink,
          fontFamily: EMAIL_SANS,
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
          <Section style={{ textAlign: "center", padding: "8px 0 24px" }}>
            <Link href={site("/")} style={{ textDecoration: "none" }}>
              <Text
                style={{
                  fontFamily: EMAIL_DISPLAY,
                  fontSize: 26,
                  lineHeight: "32px",
                  color: EMAIL_COLORS.brand,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {brandName}
              </Text>
            </Link>
            <Hr
              style={{
                borderTop: `1px solid ${EMAIL_COLORS.brand}`,
                width: 48,
                margin: "14px auto 0",
              }}
            />
          </Section>

          <Section
            style={{
              backgroundColor: EMAIL_COLORS.surface,
              border: `1px solid ${EMAIL_COLORS.line}`,
              padding: "8px 36px 32px",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "24px 8px 0", textAlign: "center" }}>
            <Text style={{ color: EMAIL_COLORS.soft, fontSize: 13, lineHeight: "20px", margin: 0 }}>
              {footer ?? "Questions? Reply to this email or visit our help centre."}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: "20px", margin: "16px 0 0" }}>
              {FOOTER_LINKS.map(([label, path], i) => (
                <span key={path}>
                  {i > 0 && <span style={{ color: EMAIL_COLORS.line }}>{"  ·  "}</span>}
                  <Link href={site(path)} style={{ color: EMAIL_COLORS.brand }}>
                    {label}
                  </Link>
                </span>
              ))}
            </Text>
            <Text
              style={{
                color: EMAIL_COLORS.subtle,
                fontSize: 11,
                lineHeight: "18px",
                margin: "16px 0 0",
              }}
            >
              {brandName} · Cairo, Egypt
            </Text>
            {unsubscribeUrl && (
              <Text style={{ fontSize: 11, margin: "8px 0 0" }}>
                <Link href={unsubscribeUrl} style={{ color: EMAIL_COLORS.subtle }}>
                  Stop these emails
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Email headline in the display serif. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      style={{
        fontFamily: EMAIL_DISPLAY,
        fontWeight: 400,
        fontSize: 32,
        lineHeight: "38px",
        color: EMAIL_COLORS.ink,
        margin: "28px 0 12px",
      }}
    >
      {children}
    </Heading>
  );
}

/** Email body paragraph. */
export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{ color: EMAIL_COLORS.soft, fontSize: 15, lineHeight: "24px", margin: "0 0 16px" }}
    >
      {children}
    </Text>
  );
}

/** Email call-to-action: a square military-green button (a styled link, which every client supports). */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "28px 0 24px" }}>
      <Link
        href={href}
        style={{
          backgroundColor: EMAIL_COLORS.brand,
          color: "#ffffff",
          display: "inline-block",
          fontFamily: EMAIL_SANS,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.12em",
          padding: "15px 28px",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        {children}
      </Link>
    </Section>
  );
}
