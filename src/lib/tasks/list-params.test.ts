import { describe, expect, it } from "vitest";
import { parseTaskListParams, taskListHref } from "./list-params";

describe("parseTaskListParams", () => {
  it("모르는 값은 기본값으로 둔다", () => {
    expect(parseTaskListParams({ tab: "x", status: "NOPE", page: "-3" }, false)).toEqual({
      tab: "mine",
      status: null,
      page: 1,
    });
  });

  it("국장·국원은 전체 탭을 쓸 수 없고, 회장단은 소속 국 탭이 없다", () => {
    expect(parseTaskListParams({ tab: "all" }, false).tab).toBe("mine");
    expect(parseTaskListParams({ tab: "all" }, true).tab).toBe("all");
    expect(parseTaskListParams({ tab: "dept" }, true).tab).toBe("mine");
  });

  it("상태와 쪽 번호를 읽는다", () => {
    expect(parseTaskListParams({ status: "DONE", page: ["3", "4"] }, false)).toMatchObject({
      status: "DONE",
      page: 3,
    });
  });
});

describe("taskListHref", () => {
  const base = { tab: "dept", status: "TODO", page: 3 } as const;

  it("쪽만 바꾸면 다른 조건은 그대로 둔다", () => {
    expect(taskListHref(base, { page: 4 })).toBe("/tasks?tab=dept&status=TODO&page=4");
  });

  it("탭이나 상태를 바꾸면 1쪽으로 간다", () => {
    expect(taskListHref(base, { status: null })).toBe("/tasks?tab=dept");
    expect(taskListHref(base, { tab: "mine" })).toBe("/tasks?status=TODO");
  });
});
