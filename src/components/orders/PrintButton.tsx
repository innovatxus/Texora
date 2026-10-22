"use client";

import { Button } from "@/components/primitives";

/** Opens the browser's print dialog (save as PDF from there). */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
