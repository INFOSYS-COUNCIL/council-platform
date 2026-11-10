import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  InactiveAssigneeBadge,
  OverdueBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/ui/badge";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { SelectField, TextareaField, TextField } from "@/components/ui/form-field";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, isOverdue, todayInSeoul } from "@/lib/dates";
import {
  aclRuleLabel,
  aclSubjectOptions,
  getTermOrgOptions,
  memberSelectOptions,
} from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  ACL_ROLE_GROUP_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  VISIBILITY_LABELS,
} from "@/lib/tasks/labels";
import {
  addTaskAccessRule,
  archiveTask,
  deleteTask,
  changeTaskStatus,
  removeTaskAccessRule,
  restoreTask,
  setTaskManager,
  setTaskVisibility,
  updateTask,
  updateTaskDescription,
} from "../actions";

export const metadata: Metadata = {
  title: "업무 상세",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 변경 이력의 action 값 → 화면 문구 (DB 함수의 log_activity 호출과 맞춘다)
const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: "업무를 만들었습니다",
  UPDATE: "제목·우선순위·일정을 바꿨습니다",
  ASSIGNEE_CHANGE: "담당자를 바꿨습니다",
  DESCRIPTION_UPDATE: "설명을 바꿨습니다",
  STATUS_CHANGE: "상태를 바꿨습니다",
  REOPEN: "완료된 업무를 다시 열었습니다",
  VISIBILITY_CHANGE: "공개 모드를 바꿨습니다",
  ACL_ADD: "열람 대상을 추가했습니다",
  ACL_REMOVE: "열람 대상을 뺐습니다",
  MANAGER_CHANGE: "관리 책임자를 바꿨습니다",
  ARCHIVE: "업무를 보관했습니다",
  RESTORE: "업무를 복원했습니다",
};

// 볼 수 없는 업무는 RLS가 행을 돌려주지 않으므로 "찾을 수 없음"으로 보인다(부록 C.2).
export default function TaskDetailPage(props: PageProps<"/tasks/[taskId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <TaskDetail params={props.params} />
    </Suspense>
  );
}

async function TaskDetail({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const membership = await requireMember(`/tasks/${taskId}`);
  if (!UUID.test(taskId)) notFound();
  const me = (await getCurrentUserId())!;

  const supabase = await createClient();
  const [taskResult, rulesResult, logsResult, org] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, department:departments(name), assignee:profiles!tasks_assignee_id_fkey(display_name, email), manager:profiles!tasks_manager_id_fkey(display_name, email), creator:profiles!tasks_creator_id_fkey(display_name, email)",
      )
      .eq("id", taskId)
      .maybeSingle(),
    supabase
      .from("task_access_rules")
      .select("id, subject_type, department_id, user_id, role_group")
      .eq("task_id", taskId)
      .order("created_at"),
    supabase
      .from("activity_logs")
      .select("id, action, created_at, actor:profiles!activity_logs_actor_id_fkey(display_name, email)")
      .eq("resource_type", "TASK")
      .eq("resource_id", taskId)
      .order("created_at", { ascending: false })
      .limit(30),
    getTermOrgOptions(membership.termId),
  ]);

  if (taskResult.error) {
    return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }
  const task = taskResult.data;
  if (!task) notFound();

  // 화면에 어떤 폼을 보여 줄지 정하는 표시용 판정. 실제 검사는 DB 함수가 한다(can_manage_task와 같은 규칙).
  const isExecutive = membership.role === "EXECUTIVE";
  const canManage =
    isExecutive ||
    (membership.role === "DIRECTOR" &&
      ((task.visibility_mode === "DEFAULT" && task.department_id === membership.departmentId) ||
        task.manager_id === me));
  const isAssignee = task.assignee_id === me;
  const archived = task.archived_at !== null;
  const today = todayInSeoul();

  const nameOf = (p: { display_name: string | null; email: string } | null) =>
    p ? p.display_name?.trim() || p.email : "없음";
  const activeIds = new Set(org.members.map((m) => m.userId));
  const memberOptions = memberSelectOptions(org.members);
  const managerOptions = memberSelectOptions(org.members.filter((m) => m.role !== "MEMBER"));
  const hidden = <input type="hidden" name="task_id" value={task.id} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title={task.title}
        actions={
          <span className="flex flex-wrap gap-1">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {isOverdue(task.due_date, task.status === "DONE", today) && <OverdueBadge />}
            {archived && <Badge tone="muted">보관됨</Badge>}
          </span>
        }
      />
      <p>
        <SecondaryLinkButton href="/tasks">
          ← 업무 목록
        </SecondaryLinkButton>
      </p>

      {archived && (
        <Alert tone="info">보관된 업무입니다. 복원하기 전에는 내용을 바꿀 수 없습니다.</Alert>
      )}

      <InfoList>
        <Info label="담당 국">{task.department?.name}</Info>
        <Info label="담당자">
          {nameOf(task.assignee)}{" "}
          {task.assignee_id && !activeIds.has(task.assignee_id) && <InactiveAssigneeBadge />}
        </Info>
        <Info label="관리 책임자">{nameOf(task.manager)}</Info>
        <Info label="만든 사람">{nameOf(task.creator)}</Info>
        <Info label="시작일">{formatDate(task.start_date, today) || "없음"}</Info>
        <Info label="마감일">{formatDate(task.due_date, today) || "없음"}</Info>
        <Info label="공개 모드">{VISIBILITY_LABELS[task.visibility_mode].label}</Info>
        <Info label="완료일">
          {task.completed_at ? new Date(task.completed_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "—"}
        </Info>
      </InfoList>

      {!archived && (canManage || isAssignee) && (
        <Section title="상태">
          <ActionForm action={changeTaskStatus} submitLabel="상태 바꾸기" className="flex flex-wrap items-end gap-3">
            {hidden}
            <SelectField
              label="상태"
              name="status"
              defaultValue={task.status}
              options={TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
            />
          </ActionForm>
        </Section>
      )}

      <Section title="설명">
        {!archived && (canManage || isAssignee) ? (
          <ActionForm action={updateTaskDescription} submitLabel="설명 저장" variant="secondary">
            {hidden}
            <TextareaField label="설명" name="description" rows={6} maxLength={10000} defaultValue={task.description} />
          </ActionForm>
        ) : (
          <p className="whitespace-pre-wrap">{task.description || "설명이 없습니다."}</p>
        )}
      </Section>

      {!archived && canManage && (
        <Section title="정보 수정">
          <ActionForm action={updateTask} submitLabel="저장" variant="secondary">
            {hidden}
            <TextField label="제목" name="title" required maxLength={100} defaultValue={task.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="담당자" name="assignee_id" options={memberOptions} placeholder="담당자 없음" defaultValue={task.assignee_id ?? ""} />
              <SelectField
                label="우선순위"
                name="priority"
                defaultValue={task.priority}
                options={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
              />
              <DateTimePicker withTime={false} label="시작일" name="start_date" defaultValue={task.start_date ?? ""} />
              <DateTimePicker withTime={false} label="마감일" name="due_date" defaultValue={task.due_date ?? ""} />
            </div>
          </ActionForm>
        </Section>
      )}

      <Section title="공개 범위">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {VISIBILITY_LABELS[task.visibility_mode].description}
        </p>
        {rulesResult.data && rulesResult.data.length > 0 ? (
          <ul className="space-y-2">
            {rulesResult.data.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span>{aclRuleLabel(rule, org, ACL_ROLE_GROUP_LABELS)}</span>
                {!archived && canManage && (
                  <ActionForm action={removeTaskAccessRule} submitLabel="빼기" variant="secondary" className="flex items-center gap-2">
                    {hidden}
                    <input type="hidden" name="rule_id" value={rule.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">추가한 열람 대상이 없습니다.</p>
        )}

        {!archived && canManage && (
          <div className="grid gap-6 sm:grid-cols-2">
            <ActionForm action={addTaskAccessRule} submitLabel="열람 대상 추가" variant="secondary">
              {hidden}
              <SelectField
                label="열람 대상"
                name="subject"
                placeholder="선택하세요"
                options={aclSubjectOptions(org, ACL_ROLE_GROUP_LABELS)}
              />
            </ActionForm>
            <ActionForm
              action={setTaskVisibility}
              submitLabel="공개 모드 바꾸기"
              variant="secondary"
              confirmMessage="공개 모드를 바꾸면 이 업무를 볼 수 있는 사람이 달라집니다. 바꿀까요?"
            >
              {hidden}
              <SelectField
                label="공개 모드"
                name="visibility_mode"
                defaultValue={task.visibility_mode}
                options={(["DEFAULT", "RESTRICTED"] as const).map((m) => ({ value: m, label: VISIBILITY_LABELS[m].label }))}
                hint="제한 공개는 회장단이나 관리 책임자만 고를 수 있습니다."
              />
            </ActionForm>
          </div>
        )}
      </Section>

      {!archived && (isExecutive || task.manager_id === me) && (
        <Section title="관리 책임자">
          <ActionForm action={setTaskManager} submitLabel="관리 책임자 바꾸기" variant="secondary" className="flex flex-wrap items-end gap-3">
            {hidden}
            <SelectField label="관리 책임자" name="manager_id" options={managerOptions} defaultValue={task.manager_id} hint="국장이나 회장단만 맡을 수 있습니다." />
          </ActionForm>
        </Section>
      )}

      {canManage && (
        <Section title={archived ? "보관함에서 꺼내기" : "보관함으로 옮기기"}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {archived
              ? "다시 목록에 보이고 수정할 수 있게 됩니다."
              : "끝났거나 더 이상 쓰지 않는 업무를 목록에서 빼 둡니다. 지워지지 않고 보관함에서 다시 꺼낼 수 있습니다."}
          </p>
          {archived ? (
            <ActionForm action={restoreTask} submitLabel="보관함에서 꺼내기" variant="secondary">
              {hidden}
            </ActionForm>
          ) : (
            <ActionForm
              action={archiveTask}
              submitLabel="보관함으로 옮기기"
              variant="secondary"
              confirmMessage="업무를 보관하면 목록에서 빠지고 수정할 수 없습니다. 보관할까요?"
            >
              {hidden}
            </ActionForm>
          )}
        </Section>
      )}

      {canManage && (
        <Section title="업무 삭제">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            잘못 만든 업무를 완전히 지웁니다. 되돌릴 수 없습니다. 기록을 남기려면 보관함으로 옮겨 주세요.
          </p>
          <ActionForm
            action={deleteTask}
            submitLabel="업무 삭제"
            variant="secondary"
            confirmMessage="이 업무를 완전히 지웁니다. 되돌릴 수 없습니다. 지울까요?"
          >
            {hidden}
          </ActionForm>
        </Section>
      )}

      <Section title="변경 이력">
        {logsResult.error ? (
          <Alert>변경 이력을 불러오지 못했습니다.</Alert>
        ) : logsResult.data.length === 0 ? (
          <p className="text-sm">변경 이력이 없습니다.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {logsResult.data.map((log) => (
              <li key={log.id} className="flex flex-wrap gap-x-2">
                <time className="text-zinc-600 dark:text-zinc-400" dateTime={log.created_at}>
                  {new Date(log.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
                </time>
                <span>
                  {nameOf(log.actor)} — {ACTIVITY_LABELS[log.action] ?? log.action}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
