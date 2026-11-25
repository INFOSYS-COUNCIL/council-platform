import { PhotoTags } from "./photo-tags";
import Image from "next/image";
import Link from "next/link";
import { isoToSeoulLocal } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";

export type PhotoListItem = {
  id: string;
  title: string;
  createdAt: string;
  tags: string[];
  coverUrl: string | null;
};

export function PhotoGrid({ posts, searchQuery = "", filtered = false }: { posts: readonly PhotoListItem[]; searchQuery?: string; filtered?: boolean }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        title={filtered ? "검색 조건에 맞는 과 활동이 없습니다" : "아직 올라온 과 활동이 없습니다"}
        description={filtered ? "다른 검색어를 입력하거나 필터를 해제해 주세요." : "학생회가 올리는 학과 활동을 이곳에서 볼 수 있습니다."}
      />
    );
  }

  return (
    <ul
      aria-label="과 활동 목록"
      className="grid grid-cols-1 gap-x-5 gap-y-0 sm:gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {posts.map((post) => (
        <li key={post.id} className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-center gap-3 border-b border-border-input/30 py-3 sm:block sm:border-0 sm:py-0">
          <Link
            href={`/photos/${post.id}`}
            tabIndex={-1}
            aria-hidden="true"
            className="group block rounded-xl"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg sm:mb-3 sm:rounded-xl bg-zinc-100 dark:bg-zinc-800">
              {post.coverUrl ? (
                <Image
                  src={post.coverUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 80px"
                  className="object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
                  대표사진 없음
                </div>
              )}
            </div>
          </Link>
          <div className="min-w-0 space-y-1 sm:space-y-3">
            <div className="flex items-start justify-between gap-2 sm:block sm:space-y-1">
            <h2 className="min-w-0 text-sm leading-6 font-semibold text-foreground sm:text-base sm:font-medium">
              <Link href={`/photos/${post.id}`}
                className="line-clamp-2 break-words rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-coral-700 dark:hover:text-coral-300">
                {post.title}
              </Link>
            </h2>
            <time dateTime={post.createdAt} aria-label={`게시일 ${isoToSeoulLocal(post.createdAt).slice(0, 10)}`}
              className="shrink-0 pt-1 text-[11px] leading-5 text-muted sm:block sm:pt-0 sm:text-xs">
              {isoToSeoulLocal(post.createdAt).slice(0, 10).replaceAll("-", ".")}
            </time>
            </div>
            <PhotoTags tags={post.tags} searchQuery={searchQuery} mobileCompact />
          </div>
        </li>
      ))}
    </ul>
  );
}
