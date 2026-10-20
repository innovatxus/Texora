import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** Sent at registration and on resend: verify the merchant's email address. */
export function MerchantVerifyEmail({
  brandName,
  username,
  link,
}: {
  brandName: string;
  username: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`Verify your email to open your ${brandName} shop`}>
      <EmailHeading>Verify your email, {username}</EmailHeading>
      <EmailText>
        Thanks for registering as a {brandName} merchant. Verify your email so you can submit your
        shop for review and publish products. You can keep building your shop in the meantime.
      </EmailText>
      <EmailButton href={link}>Verify email</EmailButton>
      <EmailText>
        If you didn&apos;t create a merchant account, you can ignore this email.
      </EmailText>
    </EmailLayout>
  );
}

/** Sent from "Forgot password": a one-hour link to choose a new password. */
export function MerchantPasswordResetEmail({
  brandName,
  link,
}: {
  brandName: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`Reset your ${brandName} merchant password`}>
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>
        Choose a new password for your {brandName} merchant account. The link expires in one hour.
      </EmailText>
      <EmailButton href={link}>Choose a new password</EmailButton>
      <EmailText>
        If you didn&apos;t ask for this, you can ignore this email; your password won&apos;t change.
      </EmailText>
    </EmailLayout>
  );
}
