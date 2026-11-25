import { describe, expect, it } from "vitest";
import { parsePhotoTags, photoTagHref, matchesPhotoSearch, paginatePhotos, photoPageHref, PHOTO_PAGE_SIZE, PHOTO_MAX_BYTES, photoImageUrl, photoImageUrls, validatePhotoFile } from "./content";

describe("과 활동 입력", () => {
  it("중첩된 사진도 편집기 순서대로 읽는다", () => {
    expect(photoImageUrls([
      { type: "paragraph", children: [{ type: "image", props: { url: "first" } }] },
      { type: "image", props: { url: "second" } },
      { type: "paragraph", content: [] },
    ])).toEqual(["first", "second"]);
  });
  it("오래되거나 잘못된 JSON의 사진 필드를 건너뛴다", () => {
    expect(photoImageUrls([null, 1, { type: "image", props: null }])).toEqual([]);
  });
  it("PNG·JPG·WEBP만 허용하고 20MB 경계를 검사한다", () => {
    expect(PHOTO_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(validatePhotoFile({ type: "image/jpeg", size: PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toContain("20MB");
    expect(validatePhotoFile({ type: "image/gif", size: 100 })).toContain("PNG");
  });
  it("DB 경로를 인증된 사진 경로로 바꾼다", () => {
    expect(photoImageUrl("post/owner/file.png")).toBe("/photos/post/images/owner/file.png");
  });
});

describe("과 활동 해시태그", () => {
  it("#·쉼표·공백을 구분하고 중복과 영문 대소문자를 정리한다", () => {
    expect(parsePhotoTags("#MT, mt 체육대회 #가을")).toEqual({ tags: ["mt", "체육대회", "가을"] });
    expect(parsePhotoTags(" , # ")).toEqual({ tags: [] });
  });
  it("20자와 10개 경계를 허용하고 초과·특수문자를 거부한다", () => {
    expect(parsePhotoTags("가".repeat(20)).error).toBeUndefined();
    expect(parsePhotoTags("가".repeat(21)).error).toBeTruthy();
    expect(parsePhotoTags(Array.from({ length: 10 }, (_, i) => `tag${i}`).join(",")).tags).toHaveLength(10);
    expect(parsePhotoTags(Array.from({ length: 11 }, (_, i) => `tag${i}`).join(",")).error).toBeTruthy();
    expect(parsePhotoTags("<script>").error).toBeTruthy();
  });
  it("한글 태그를 필터 주소에 안전하게 넣는다", () => {
    expect(photoTagHref("체육대회")).toBe(`/photos?tag=${encodeURIComponent("체육대회")}`);
  });
});

describe("과 활동 검색", () => {
  const post = { title: "가을 체육대회", description: "함께 즐긴 캠퍼스 행사", tags: ["mt", "체육"] };
  it("제목·설명·태그에서 대소문자와 #을 정리해 찾는다", () => {
    expect(matchesPhotoSearch(post, "가을")).toBe(true);
    expect(matchesPhotoSearch(post, "캠퍼스")).toBe(true);
    expect(matchesPhotoSearch(post, "#MT")).toBe(true);
    expect(matchesPhotoSearch(post, "가을 캠퍼스 mt")).toBe(true);
    expect(matchesPhotoSearch(post, "가을 간식")).toBe(false);
  });
  it("빈 검색은 모두 보여 주고 검색 문법 문자는 일반 글자로 비교한다", () => {
    expect(matchesPhotoSearch(post, "  ")).toBe(true);
    expect(matchesPhotoSearch(post, "%")).toBe(false);
    expect(matchesPhotoSearch(post, "_(제목)")).toBe(false);
  });
  it("태그를 바꿀 때 검색어를 주소에 안전하게 유지한다", () => {
    expect(photoTagHref("mt", "가을 & 축제")).toBe(`/photos?tag=mt&q=${encodeURIComponent("가을 & 축제")}`);
  });
});

describe("과 활동 페이지 나누기", () => {
  const posts = Array.from({ length: 32 }, (_, index) => index + 1);
  it("PC·모바일은 15개씩, 16번째부터 다음 페이지에 표시한다", () => {
    expect(PHOTO_PAGE_SIZE).toBe(15);
    expect(paginatePhotos(posts, 1, PHOTO_PAGE_SIZE).posts).toEqual(posts.slice(0, 15));
    expect(paginatePhotos(posts, 2, PHOTO_PAGE_SIZE).posts).toEqual(posts.slice(15, 30));
    expect(paginatePhotos(posts, 3, PHOTO_PAGE_SIZE).posts).toEqual([31, 32]);
  });
  it("빈 결과와 삭제로 범위를 벗어난 페이지를 안전하게 처리한다", () => {
    expect(paginatePhotos([], 3, 15)).toEqual({ page: 1, totalPages: 1, total: 0, posts: [] });
    expect(paginatePhotos(posts, 99, 15).page).toBe(3);
    expect(paginatePhotos(posts, -1, 15).page).toBe(1);
  });
  it("페이지 주소에 검색어와 태그를 유지한다", () => {
    const url = new URL(photoPageHref(2, "가을", "체육 대회"), "https://example.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ tag: "가을", q: "체육 대회", page: "2" });
    expect(photoPageHref(1)).toBe("/photos");
  });
});
