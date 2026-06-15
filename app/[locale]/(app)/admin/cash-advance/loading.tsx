import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function CashAdvanceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
