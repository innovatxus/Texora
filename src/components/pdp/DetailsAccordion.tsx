"use client";

import * as Accordion from "@radix-ui/react-accordion";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

export function DetailsAccordion({
  sections,
  defaultOpen,
}: {
  sections: Array<{ id: string; title: string; content: ReactNode }>;
  /** Sections open on first render; the first one by default. */
  defaultOpen?: string[];
}) {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={defaultOpen ?? sections.slice(0, 1).map((s) => s.id)}
      className="border-t border-line"
    >
      {sections.map((section) => (
        <Accordion.Item key={section.id} value={section.id} className="border-b border-line">
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between py-5 text-label">
              {section.title}
              <ChevronDownIcon
                size={20}
                className="size-4 transition-transform duration-fast group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-6 text-sm text-ink-soft">
            {section.content}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
