import { PillLink } from "@/components/ui/pagination";
import {
  PHOTO_PAGE_SIZE, paginatePhotos, photoPageHref,
} from "@/lib/photos/content";
import { PhotoGrid, type PhotoListItem } from "./photo-grid";

type Props = { posts: readonly PhotoListItem[]; requestedPage: number; tag?: string; search: string };

export function PhotoListPages({ posts, requestedPage, tag, search }: Props) {
  const result = paginatePhotos(posts, requestedPage, PHOTO_PAGE_SIZE);
  return (
    <div className="space-y-6">
      <p role="status" className="text-sm text-muted">{search || tag ? "검색 결과" : "전체"} {result.total}개</p>
      <PhotoGrid posts={result.posts} searchQuery={search} filtered={Boolean(search || tag)} />
      {result.totalPages > 1 && (
        <nav aria-label="과 활동 페이지 선택" className="flex flex-wrap justify-center gap-2 border-t border-border-input/40 pt-6">
          {Array.from({ length: result.totalPages }, (_, index) => index + 1).map((page) => (
            <PillLink key={page} href={photoPageHref(page, tag, search)} current={page === result.page} variant="chip">
              {String(page)}
            </PillLink>
          ))}
        </nav>
      )}
    </div>
  );
}
