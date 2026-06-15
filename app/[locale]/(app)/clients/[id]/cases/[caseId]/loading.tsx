import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function CaseDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="flex gap-6 border-b border-ink-100 dark:border-ink-800">
        <Skeleton className="h-9 w-24 rounded-none" />
        <Skeleton className="h-9 w-20 rounded-none" />
      </div>
      <SkeletonTable rows={5} />
    </div>
  );
}
