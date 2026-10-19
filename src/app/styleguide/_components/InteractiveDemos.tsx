"use client";

import { useState } from "react";
import { Button, Chip } from "@/components/primitives";

const FIT_FAMILIES = ["Regular", "Petite", "Tall"] as const;

export function ToggleChipDemo() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(["Regular"]));

  function toggle(fit: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fit)) next.delete(fit);
      else next.add(fit);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Fit family">
      {FIT_FAMILIES.map((fit) => (
        <Chip key={fit} label={fit} selected={selected.has(fit)} onClick={() => toggle(fit)} />
      ))}
      <Chip label="Unavailable" selected={false} disabled />
    </div>
  );
}

const INITIAL_FILTERS = ["Size: M", "Colour: Navy", "Linen"];

export function DismissibleChipDemo() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Chip
          key={filter}
          variant="dismissible"
          label={filter}
          onClick={() => setFilters((current) => current.filter((f) => f !== filter))}
        />
      ))}
      {filters.length === 0 ? (
        <Button variant="tertiary" onClick={() => setFilters(INITIAL_FILTERS)}>
          Reset demo
        </Button>
      ) : (
        <Button variant="tertiary" onClick={() => setFilters([])}>
          Clear all
        </Button>
      )}
    </div>
  );
}

export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.setTimeout(() => setLoading(false), 1500);
      }}
    >
      Place order
    </Button>
  );
}
