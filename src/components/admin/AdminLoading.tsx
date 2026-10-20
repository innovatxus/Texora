import { Skeleton } from "@/components/primitives";

/** Placeholder while an admin page loads its request-time data. */
export function AdminLoading() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-6 h-12" />
      <Skeleton className="mt-4 h-96" />
    </div>
  );
}
