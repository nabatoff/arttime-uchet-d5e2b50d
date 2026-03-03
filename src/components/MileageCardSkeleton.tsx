import { Skeleton } from "@/components/ui/skeleton";

export function MileageCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-6 w-14 shrink-0" />
      </div>
    </div>
  );
}

export function MileageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MileageCardSkeleton key={i} />
      ))}
    </div>
  );
}
