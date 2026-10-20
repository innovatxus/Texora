import NextLink from "next/link";
import { HELP_TOPICS, type HelpGroup } from "@/config/help";
import { cn } from "@/lib/utils/cn";

const GROUPS: Array<{ group: HelpGroup; title: string }> = [
  { group: "help", title: "Help" },
  { group: "about", title: "About us" },
  { group: "legal", title: "Policies" },
];

/** Topic navigation for the help centre, marking the current page. */
export function HelpNav({ current }: { current: string | null }) {
  return (
    <nav aria-label="Help topics" className="flex flex-col gap-8 text-sm">
      <NextLink
        href="/help"
        aria-current={current === null ? "page" : undefined}
        className={cn("hover:underline", current === null && "font-medium underline")}
      >
        Help centre
      </NextLink>
      {GROUPS.map(({ group, title }) => (
        <div key={group}>
          <h2 className="text-label text-ink-subtle">{title}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {group === "help" && (
              <li>
                <NextLink href="/orders/lookup" className="hover:underline">
                  Track an order
                </NextLink>
              </li>
            )}
            {HELP_TOPICS.filter((t) => t.group === group).map((topic) => (
              <li key={topic.slug}>
                <NextLink
                  href={`/help/${topic.slug}`}
                  aria-current={current === topic.slug ? "page" : undefined}
                  className={cn(
                    "hover:underline",
                    current === topic.slug && "font-medium underline underline-offset-4",
                  )}
                >
                  {topic.title}
                </NextLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
