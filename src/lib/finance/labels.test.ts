import { describe, expect, it } from "vitest";
import { downloadName, financeStatus, semesterOf } from "./labels";

describe("semesterOf", () => {
  it("3~8월은 1학기, 9~12월은 2학기, 1·2월은 전년도 2학기", () => {
    expect(semesterOf("2026-03-02")).toBe("2026-1");
    expect(semesterOf("2026-08-31")).toBe("2026-1");
    expect(semesterOf("2026-11-23")).toBe("2026-2");
    expect(semesterOf("2027-02-10")).toBe("2026-2");
  });
});

describe("financeStatus", () => {
  it("업무 상태를 문서 상태로", () => {
    expect(financeStatus("TODO")).toBe("DRAFT");
    expect(financeStatus("IN_PROGRESS")).toBe("DRAFT");
    expect(financeStatus("REVIEW")).toBe("REVIEW");
    expect(financeStatus("DONE")).toBe("DONE");
    expect(financeStatus(null)).toBe("IMPORTED");
  });
});

describe("downloadName", () => {
  it("제목_YYYYMMDD_작성자.xlsx, 파일 이름에 못 쓰는 글자는 뺀다", () => {
    expect(downloadName("11월/회계장부", "2026-11-20", "국원 A")).toBe("11월회계장부_20261120_국원 A.xlsx");
  });
});
