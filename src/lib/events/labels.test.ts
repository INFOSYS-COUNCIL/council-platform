import { describe, expect, it } from "vitest";
import { formatBytes, uploadPath, uploadProblem } from "./labels";

describe("uploadProblem", () => {
  it("허용 형식이고 10MB 이하면 통과한다", () => {
    expect(uploadProblem({ name: "예산안.HWPX", size: 1024 })).toBeNull();
    expect(uploadProblem({ name: "a.pdf", size: 10 * 1024 * 1024 })).toBeNull();
  });

  it("실행될 수 있는 형식과 압축 파일은 거른다", () => {
    for (const name of ["x.svg", "x.html", "x.zip", "x.exe", "확장자없음"]) {
      expect(uploadProblem({ name, size: 10 })).toMatch(/만 올릴 수 있습니다/);
    }
  });

  it("10MB를 넘거나 빈 파일이면 거른다", () => {
    expect(uploadProblem({ name: "a.pdf", size: 10 * 1024 * 1024 + 1 })).toMatch(/외부 링크/);
    expect(uploadProblem({ name: "a.pdf", size: 0 })).toMatch(/빈 파일/);
  });
});

describe("uploadPath", () => {
  it("원래 파일 이름 대신 임의 id와 소문자 확장자를 쓴다", () => {
    expect(uploadPath("t", "e", "회의 자료 최종.PDF", "abc")).toBe("t/e/abc.pdf");
  });
});

describe("formatBytes", () => {
  it("1MB 미만은 KB, 이상은 MB로 보여 준다", () => {
    expect(formatBytes(1500)).toBe("2KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0MB");
    expect(formatBytes(null)).toBe("");
  });
});
