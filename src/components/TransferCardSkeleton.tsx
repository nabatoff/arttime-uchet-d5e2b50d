import { Skeleton } from "@/components/ui/skeleton";

export function TransferCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function TransferListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TransferCardSkeleton key={i} />
      ))}
    </div>
  );
}
