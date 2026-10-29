import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// 페이지와 Server Action에서 로그인·소속을 확인하는 공용 함수.
// 화면 접근을 정리하는 용도이며, 실제 데이터 권한은 DB의 RLS가 검사한다.
// 쿠키를 읽으므로 이 함수를 부르는 컴포넌트는 <Suspense> 안에 둔다.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export type ActiveMembership = {
  id: string;
  termId: string;
  role: MemberRole;
  departmentId: string | null;
  positionId: string | null;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 한 요청 안에서 여러 번 불러도 JWT 검증은 한 번만 한다.
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

// ACTIVE 기수의 활성 소속. 없으면 null(일반 학생).
// 로그인 콜백처럼 방금 세션을 만든 클라이언트를 써야 할 때는 이 함수를 직접 부른다.
export async function findActiveMembership(
  supabase: ServerClient,
  userId: string,
): Promise<ActiveMembership | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, term_id, role, department_id, position_id, term:terms(status)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error("소속 정보를 불러오지 못했습니다.", { cause: error });
  }

  const row = data.find((m) => m.term?.status === "ACTIVE");
  if (!row) return null;

  return {
    id: row.id,
    termId: row.term_id,
    role: row.role,
    departmentId: row.department_id,
    positionId: row.position_id,
  };
}

export const getActiveMembership = cache(
  async (): Promise<ActiveMembership | null> => {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    return findActiveMembership(await createClient(), userId);
  },
);

// 로그인하지 않았으면 로그인 화면으로 보낸다. nextPath는 로그인 뒤 돌아올 경로다.
export async function requireUser(nextPath: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return userId;
}

// 학생회 구성원 전용 화면. roles를 주면 그 Role만 들어올 수 있다.
// 권한이 없으면 화면이 있다는 사실도 숨기기 위해 "찾을 수 없음"으로 보여 준다(기획서 부록 C.2).
export async function requireMember(
  nextPath: string,
  roles?: readonly MemberRole[],
): Promise<ActiveMembership> {
  await requireUser(nextPath);

  const membership = await getActiveMembership();
  if (!membership || (roles && !roles.includes(membership.role))) {
    notFound();
  }
  return membership;
}
