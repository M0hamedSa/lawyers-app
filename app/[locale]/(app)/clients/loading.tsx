import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-11 flex-1 max-w-sm rounded-lg" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
