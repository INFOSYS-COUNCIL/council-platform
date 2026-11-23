import { Skeleton } from "@/components/ui/detail";

export default function PhotosLoading() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">활동 사진을 불러오는 중…</span>
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="aspect-square" />)}
      </div>
    </div>
  );
}
