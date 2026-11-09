import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialActionState } from "@/lib/actions/result";
import type { ActiveMembership } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  rpc: vi.fn(),
  refresh: vi.fn(),
  readOrganisation: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("./queries", () => ({ readOrganisation: mocks.readOrganisation }));

import { registerAccounts, updateAccount } from "./actions";

const membership: ActiveMembership = {
  id: "membership-1",
  termId: "term-1",
  role: "EXECUTIVE",
  departmentId: null,
  positionId: null,
};

function registrationForm(input: string) {
  const form = new FormData();
  form.set("accounts", input);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireMember.mockResolvedValue(membership);
  mocks.readOrganisation.mockResolvedValue({
    departments: [{ id: "dept-1", name: "기획국", is_active: true }],
    positions: [{ id: "pos-1", name: "기획 담당", is_active: true }],
  });
});

describe("승인 명단 Server Action", () => {
  it("회장단의 부서 없음은 null 캐스팅 대신 인자를 생략해 전송한다", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("accountId", "account-1");
    form.set("role", "EXECUTIVE");
    form.set("departmentId", "");
    form.set("positionId", "");

    expect(await updateAccount(initialActionState, form)).toMatchObject({ status: "success" });
    const [name, args] = mocks.rpc.mock.calls[0];
    expect(name).toBe("update_approved_account");
    expect(args).not.toHaveProperty("p_department_id");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("국장은 조작된 역할·부서 대신 서버의 자기 국 국원 값으로 수정한다", async () => {
    mocks.requireMember.mockResolvedValue({ ...membership, role: "DIRECTOR", departmentId: "dept-1" });
    mocks.rpc.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("accountId", "account-1");
    form.set("role", "EXECUTIVE");
    form.set("departmentId", "other-dept");
    form.set("positionId", "pos-1");

    await updateAccount(initialActionState, form);
    expect(mocks.rpc).toHaveBeenCalledWith("update_approved_account", {
      p_account_id: "account-1",
      p_role: "MEMBER",
      p_department_id: "dept-1",
      p_position_id: "pos-1",
    });
  });

  it("서버에서 이름을 변환하고 성공 행은 재시도에서 제외하며 원래 행 번호를 유지한다", async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: [
        { row_no: 1, account_id: "new-1", error: null },
        { row_no: 2, account_id: null, error: "이미 승인 명단에 있는 이메일입니다." },
      ],
    });
    const success = "first@example.test\t0000000001\t기획국\t국원\t기획 담당";
    const invalid = "second@example.test\t0000000002\t없는국\t국원";
    const duplicate = "third@example.test\t0000000003\t기획국\t국원";
    const result = await registerAccounts("term-1", registrationForm([success, "", invalid, duplicate].join("\n")));

    expect(mocks.rpc).toHaveBeenCalledWith("register_approved_accounts", {
      p_term_id: "term-1",
      p_rows: [
        { email: "first@example.test", student_no: "0000000001", role: "MEMBER", department_id: "dept-1", position_id: "pos-1" },
        { email: "third@example.test", student_no: "0000000003", role: "MEMBER", department_id: "dept-1", position_id: null },
      ],
    });
    expect(result.retryInput).toBe([invalid, duplicate].join("\n"));
    expect(result.rows).toMatchObject([
      { rowNo: 1, error: null },
      { rowNo: 3, error: expect.stringContaining("부서 이름") },
      { rowNo: 4, error: "이미 승인 명단에 있는 이메일입니다." },
    ]);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("200행 초과는 RPC 호출 전에 거부한다", async () => {
    const input = Array(201).fill("person@example.test\t0000000001\t기획국\t국원").join("\n");
    const result = await registerAccounts("term-1", registrationForm(input));
    expect(result.result).toMatchObject({ status: "error", message: expect.stringContaining("200행") });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("기수가 바뀐 오래된 폼으로는 등록하지 않는다", async () => {
    const result = await registerAccounts("old-term", registrationForm("person@example.test\t0000000001\t기획국\t국원"));
    expect(result.result).toMatchObject({ status: "error", message: expect.stringContaining("기수가 바뀌었습니다") });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
