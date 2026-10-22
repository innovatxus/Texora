import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** Sent after sign-up: what the account is for, and a way back to the shop. */
export function CustomerWelcomeEmail({
  brandName,
  firstName,
  rewards,
  link,
}: {
  brandName: string;
  firstName: string;
  /** Whether they joined rewards at sign-up. */
  rewards: boolean;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`Welcome to ${brandName}, ${firstName}`}>
      <EmailHeading>Welcome, {firstName}</EmailHeading>
      <EmailText>
        Your {brandName} account is ready. Track orders, start returns, save addresses and keep a
        wishlist that follows you between devices.
      </EmailText>
      {rewards && (
        <EmailText>
          You&apos;re a rewards member: every purchase earns points you can spend at checkout.
        </EmailText>
      )}
      <EmailButton href={link}>Go to your account</EmailButton>
      <EmailText>
        If you didn&apos;t create this account, reply to this email and tell us.
      </EmailText>
    </EmailLayout>
  );
}

/** Sent from "Forgot password": a one-hour link to choose a new password. */
export function CustomerPasswordResetEmail({
  brandName,
  link,
}: {
  brandName: string;
  link: string;
}) {
  return (
    <EmailLayout brandName={brandName} preview={`Reset your ${brandName} password`}>
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>
        Choose a new password for your {brandName} account. The link expires in one hour.
      </EmailText>
      <EmailButton href={link}>Choose a new password</EmailButton>
      <EmailText>
        If you didn&apos;t ask for this, you can ignore this email; your password won&apos;t change.
      </EmailText>
    </EmailLayout>
  );
}
