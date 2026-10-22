import NextLink from "next/link";

const TABS = [
  { href: "/merchant/settings/account", label: "Account" },
  { href: "/merchant/settings/security", label: "Security" },
  { href: "/merchant/settings/notifications", label: "Notifications" },
] as const;

/** Account settings (journey §13): about the person, not the shop. */
export default function SettingsLayout({ children }: LayoutProps<"/merchant/settings">) {
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <h1 className="font-display text-4xl">Settings</h1>
      <nav aria-label="Settings" className="overflow-x-auto border-b border-line">
        <ul className="flex gap-6 text-sm">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <NextLink
                href={tab.href}
                className="flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {tab.label}
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
