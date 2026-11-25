import { Skeleton } from "@/components/ui/detail";

export default function PhotosLoading() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">과 활동을 불러오는 중…</span>
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 15 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 sm:block">
            <Skeleton className="h-20 w-20 shrink-0 sm:aspect-square sm:h-auto sm:w-full" />
            <div className="flex-1 space-y-2 sm:hidden">
              <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
