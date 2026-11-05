import { describe, expect, it } from "vitest";
import {
  UNKNOWN_ERROR_MESSAGE,
  actionFailure,
  actionSuccess,
  rpcErrorMessage,
} from "./result";

describe("rpcErrorMessage", () => {
  it("DB 함수가 적은 한국어 이유는 그대로 보여 준다", () => {
    expect(
      rpcErrorMessage({
        code: "42501",
        message: "국장은 자기 국의 국원(MEMBER)만 등록할 수 있습니다.",
      }),
    ).toBe("국장은 자기 국의 국원(MEMBER)만 등록할 수 있습니다.");
  });

  it("Postgres 영어 원문은 코드별 문장으로 바꾼다", () => {
    expect(
      rpcErrorMessage({
        code: "42501",
        message: "permission denied for table departments",
      }),
    ).toBe("이 작업을 할 권한이 없습니다.");
    expect(
      rpcErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "x"',
      }),
    ).toBe("이미 같은 값이 있습니다.");
  });

  it("모르는 오류는 일반 문장을 보여 준다", () => {
    expect(rpcErrorMessage({ code: "XX000", message: "boom" })).toBe(
      UNKNOWN_ERROR_MESSAGE,
    );
    expect(rpcErrorMessage({})).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});

describe("action results", () => {
  it("성공과 실패 결과를 만든다", () => {
    expect(actionSuccess("저장했습니다.")).toEqual({
      status: "success",
      message: "저장했습니다.",
    });
    expect(actionFailure("확인해 주세요.", { name: "필수" })).toEqual({
      status: "error",
      message: "확인해 주세요.",
      fieldErrors: { name: "필수" },
    });
    expect(actionFailure("실패")).toEqual({ status: "error", message: "실패" });
  });
});
