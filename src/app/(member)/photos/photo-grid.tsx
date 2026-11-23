import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export type PhotoListItem = {
  id: string;
  title: string;
  coverUrl: string | null;
};

export function PhotoGrid({ posts }: { posts: readonly PhotoListItem[] }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        title="아직 올라온 활동 사진이 없습니다"
        description="학생회가 올리는 학과 활동 사진을 이곳에서 볼 수 있습니다."
      />
    );
  }

  return (
    <ul
      aria-label="활동 사진 목록"
      className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {posts.map((post) => (
        <li key={post.id} className="min-w-0">
          <Link
            href={`/photos/${post.id}`}
            className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
              {post.coverUrl ? (
                <Image
                  src={post.coverUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
                  대표사진 없음
                </div>
              )}
            </div>
            <h2 className="line-clamp-2 break-words text-base font-medium text-foreground group-hover:text-coral-700 dark:group-hover:text-coral-300">
              {post.title}
            </h2>
          </Link>
        </li>
      ))}
    </ul>
  );
}
