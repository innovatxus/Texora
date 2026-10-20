"use client";

import { useDeferredValue, useId, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Input, Link } from "@/components/primitives";
import { FAQ } from "@/config/help";
import { searchFaq } from "@/lib/help/search";

/** Instant FAQ search: results update as you type, with the answer inline. */
export function HelpSearch() {
  const id = useId();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = searchFaq(FAQ, deferred).slice(0, 6);
  const searching = deferred.trim().length > 0;

  return (
    <div role="search" className="flex flex-col gap-6">
      <div className="relative">
        <Input
          id={`${id}-q`}
          type="search"
          size="lg"
          label="Search help"
          hideLabel
          placeholder="Search for answers, e.g. refund, delivery, gift card"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputClassName="pl-12"
        />
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" />
      </div>
      <p aria-live="polite" className="sr-only">
        {searching ? `${results.length} answers found` : ""}
      </p>
      {searching &&
        (results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {results.map((entry) => (
              <li key={entry.id} className="py-5">
                <h3 className="font-medium">{entry.question}</h3>
                <p className="mt-2 text-sm text-ink-soft">{entry.answer}</p>
                {entry.link && (
                  <Link href={entry.link.href} className="mt-2 inline-block text-sm">
                    {entry.link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            No answers match &ldquo;{deferred.trim()}&rdquo;. Try another word, or{" "}
            <Link href="/help/contact">contact us</Link>.
          </p>
        ))}
    </div>
  );
}
