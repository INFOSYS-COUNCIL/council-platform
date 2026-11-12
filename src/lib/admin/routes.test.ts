import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, adminRoutesFor } from "./routes";

describe("adminRoutesFor", () => {
  it("회장단은 관리 화면 7개를 모두 본다", () => {
    expect(adminRoutesFor("EXECUTIVE").map((r) => r.href)).toEqual([
      "/admin/members",
      "/admin/approved-accounts",
      "/admin/settings",
      "/admin/departments",
      "/admin/positions",
      "/admin/links",
      "/admin/templates",
    ]);
  });

  it("국장은 구성원, 승인 명단만 본다", () => {
    expect(adminRoutesFor("DIRECTOR").map((r) => r.href)).toEqual([
      "/admin/members",
      "/admin/approved-accounts",
    ]);
  });

  it("국원은 관리 화면이 없다", () => {
    expect(adminRoutesFor("MEMBER")).toEqual([]);
  });

  it("ADMIN_ROLES는 관리 화면이 있는 Role과 같다", () => {
    for (const role of ["EXECUTIVE", "DIRECTOR", "MEMBER"] as const) {
      expect(ADMIN_ROLES.includes(role)).toBe(adminRoutesFor(role).length > 0);
    }
  });
});
