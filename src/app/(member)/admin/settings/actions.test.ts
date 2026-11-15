import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/result";

const mocks = vi.hoisted(() => ({ requireMember: vi.fn(), rpc: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));
vi.mock("@/lib/auth/session", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/site", () => ({ SITE_SETTINGS_TAG: "site-settings" }));
import { saveTaskDueSoon } from "./actions";

function form(value: string) {
  const data = new FormData();
  data.set("task_due_soon_days", value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("마감 임박 기준 저장", () => {
  it.each(["0", "7", "365"])("회장단 확인 후 %s일을 저장하고 캐시를 갱신한다", async (value) => {
    expect(await saveTaskDueSoon(initialActionState, form(value))).toMatchObject({ status: "success" });
    expect(mocks.requireMember).toHaveBeenCalledWith("/admin/settings", ["EXECUTIVE"]);
    expect(mocks.rpc).toHaveBeenCalledWith("set_task_due_soon_days", { p_days: Number(value) });
    expect(mocks.updateTag).toHaveBeenCalledWith("site-settings");
  });
  it.each(["", "-1", "366", "1.5", "NaN"])("잘못된 값 %s은 DB에 보내지 않는다", async (value) => {
    expect(await saveTaskDueSoon(initialActionState, form(value))).toMatchObject({ status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("권한 검사 실패 시 쓰지 않는다", async () => {
    mocks.requireMember.mockRejectedValue(new Error("forbidden"));
    await expect(saveTaskDueSoon(initialActionState, form("7"))).rejects.toThrow("forbidden");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("DB 저장 실패 시 성공을 표시하거나 캐시를 갱신하지 않는다", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "42501", message: "회장단만 설정할 수 있습니다." } });
    expect(await saveTaskDueSoon(initialActionState, form("7"))).toMatchObject({ status: "error" });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
