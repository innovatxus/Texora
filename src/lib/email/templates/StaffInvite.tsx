import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./Layout";

/** Back office invitation with a set-password link. */
export function StaffInviteEmail({
  brandName,
  name,
  role,
  link,
}: {
  brandName: string;
  name: string;
  role: string;
  link: string;
}) {
  return (
    <EmailLayout
      brandName={brandName}
      preview={`You've been invited to the ${brandName} back office`}
    >
      <EmailHeading>Welcome, {name}</EmailHeading>
      <EmailText>
        You&apos;ve been given {role} access to the {brandName} back office. Set a password to sign
        in. The link expires in one hour; ask your admin for a new invitation if it does.
      </EmailText>
      <EmailButton href={link}>Set your password</EmailButton>
    </EmailLayout>
  );
}
