import { ROLE_LABELS, ROLE_ORDER, type MemberRole } from "@/lib/auth/roles";

export const MAX_BATCH_ROWS = 200;
export const STUDENT_NO_PATTERN = /^[0-9]{10}$/;
export const STUDENT_NO_ERROR = "학번은 숫자 10자리여야 합니다.";

export type OrganisationOption = { id: string; name: string };
export type BulkInputOptions = {
  departments: OrganisationOption[];
  positions: OrganisationOption[];
  director: { departmentId: string | null } | null;
};

type Registration = {
  email: string;
  student_no: string;
  role: MemberRole;
  department_id: string | null;
  position_id: string | null;
};

type InputRow = { rowNo: number; source: string; email: string };
export type ValidRow = InputRow & { registration: Registration };
type InvalidRow = InputRow & { error: string };

export function parseBulkInput(input: string, options: BulkInputOptions) {
  return input.split(/\r\n|\n|\r/).flatMap<ValidRow | InvalidRow>((source, index) => {
    if (!source.trim()) return [];

    const columns = source.split("\t").map((cell) => cell.trim());
    const [email, studentNo] = columns;
    const departmentName = options.director ? "" : columns[2];
    const positionIndex = options.director ? 2 : 4;
    const positionName = columns[positionIndex];
    const row = { rowNo: index + 1, source, email };

    if (columns.length < positionIndex || columns.length > positionIndex + 1) {
      return [{ ...row, error: "안내된 열 순서에 맞게 붙여넣어 주세요." }];
    }
    if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      return [{ ...row, error: "이메일 형식을 확인해 주세요." }];
    }
    if (!STUDENT_NO_PATTERN.test(studentNo)) {
      return [{ ...row, error: STUDENT_NO_ERROR }];
    }

    const role = options.director
      ? "MEMBER"
      : ROLE_ORDER.find((value) => ROLE_LABELS[value] === columns[3]);
    if (!role) return [{ ...row, error: "역할은 회장단, 국장, 국원 중 하나여야 합니다." }];

    const departmentId = options.director
      ? options.director.departmentId
      : options.departments.find(({ name }) => name === departmentName)?.id ?? null;
    if (!departmentId && (departmentName || role !== "EXECUTIVE")) {
      return [{ ...row, error: "현재 기수에서 사용 중인 부서 이름을 확인해 주세요." }];
    }

    const positionId = options.positions.find(({ name }) => name === positionName)?.id ?? null;
    if (positionName && !positionId) {
      return [{ ...row, error: "현재 기수에서 사용 중인 직책 이름을 확인해 주세요." }];
    }

    return [{
      ...row,
      registration: {
        email,
        student_no: studentNo,
        role,
        department_id: departmentId,
        position_id: positionId,
      },
    }];
  });
}
