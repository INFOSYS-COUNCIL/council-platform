import { describe, expect, it } from "vitest";
import { PHOTO_MAX_BYTES, photoImageUrl, photoImageUrls, validatePhotoFile } from "./content";

describe("활동 사진 입력", () => {
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
