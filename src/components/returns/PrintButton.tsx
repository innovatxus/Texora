"use client";

import { Button } from "@/components/primitives";

/** Prints the page; the return page's print styles reduce it to the label. */
export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      {children}
    </Button>
  );
}
