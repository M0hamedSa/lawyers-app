import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
