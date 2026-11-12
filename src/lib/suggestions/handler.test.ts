import { describe, expect, it } from "vitest";
import type { ActiveMembership } from "@/lib/auth/session";
import { handlerFilter, isSuggestionHandler } from "./handler";

const base: ActiveMembership = { id: "m", termId: "t", role: "MEMBER", departmentId: "d1", positionId: null };
const me = "u1";

describe("isSuggestionHandler", () => {
  it("회장단은 모든 건의를 처리한다", () => {
    expect(isSuggestionHandler({ ...base, role: "EXECUTIVE" }, me, { assigned_department_id: null, assigned_user_id: null })).toBe(true);
  });
  it("국장은 자기 국 배정 건만", () => {
    const d = { ...base, role: "DIRECTOR" as const };
    expect(isSuggestionHandler(d, me, { assigned_department_id: "d1", assigned_user_id: null })).toBe(true);
    expect(isSuggestionHandler(d, me, { assigned_department_id: "d2", assigned_user_id: null })).toBe(false);
  });
  it("국원은 나에게 배정된 건만 (같은 국 배정이어도 아니다)", () => {
    expect(isSuggestionHandler(base, me, { assigned_department_id: "d1", assigned_user_id: "u2" })).toBe(false);
    expect(isSuggestionHandler(base, me, { assigned_department_id: null, assigned_user_id: me })).toBe(true);
  });
});

describe("handlerFilter", () => {
  it("역할별 필터", () => {
    expect(handlerFilter({ ...base, role: "EXECUTIVE" }, me)).toBeNull();
    expect(handlerFilter({ ...base, role: "DIRECTOR" }, me)).toBe("assigned_user_id.eq.u1,assigned_department_id.eq.d1");
    expect(handlerFilter(base, me)).toBe("assigned_user_id.eq.u1");
  });
});
