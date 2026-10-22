"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives";
import { useBagStore } from "@/stores/bag";

/**
 * Puts an order's items back in the bag. The bag re-prices every line and
 * flags anything no longer available, so nothing stale reaches checkout.
 */
export function ReorderButton({
  lines,
}: {
  lines: ReadonlyArray<{ sku: string; productId: string; quantity: number }>;
}) {
  const router = useRouter();
  const add = useBagStore((s) => s.add);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        for (const line of lines) add(line);
        router.push("/bag");
      }}
    >
      Buy it again
    </Button>
  );
}
