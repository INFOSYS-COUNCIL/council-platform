"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FINANCE_EVENTS } from "@/lib/finance/labels";
import { XlsxPreview } from "@/components/finance/xlsx-preview";
import { downloadFinanceFile, uploadFinanceFile } from "@/lib/finance/files";
import { addFinanceDocVersion, createFinanceDoc, importFinanceDoc, saveFinanceForm } from "@/app/(member)/finance/actions";

const INPUT = "h-11 w-full rounded-lg border border-border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LABEL = "block space-y-1 text-sm font-medium";
const PRIMARY = "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";
const SECONDARY = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border-input bg-surface px-4 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800";

// 화면 가운데 창(Esc·바깥 누르기로 닫힘)
function Modal({ title, subtitle, wide, onClose, children }: { title: string; subtitle?: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto ${wide ? "w-[min(64rem,calc(100vw-2rem))]" : "w-[min(30rem,calc(100vw-2rem))]"} rounded-2xl border border-zinc-200 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/45 dark:border-zinc-700`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기 (Esc)" className="grid size-10 place-items-center rounded-lg text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
          ✕
        </button>
      </div>
      <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}

const ErrorText = ({ error }: { error: string | null }) => (error ? <p role="alert" className="text-sm text-danger">{error}</p> : null);

// 양식 카드 → 읽기 전용 미리보기 + "이 양식으로 작업하기"(국장·회장단은 담당자 지정)
export function FormPreviewButton({
  form,
  canAssign,
  members,
  defaultSemester,
  today,
}: {
  form: { id: string; name: string; sensitive: boolean; version: number; path: string; fileName: string };
  canAssign: boolean;
  members: { value: string; label: string }[];
  defaultSemester: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 같은 창에서 다시 눌러도 업무가 하나만 생기게 요청 번호를 둔다
  const [requestId, setRequestId] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setRequestId(crypto.randomUUID());
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-surface p-3.5 text-left shadow-sm hover:border-coral-300 dark:border-zinc-800 dark:hover:border-coral-800"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-green-100 text-xs font-extrabold text-green-800 dark:bg-green-950 dark:text-green-300">
          XLS
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{form.name}</span>
          <span className="text-xs text-muted">
            v{form.version}
            {form.sensitive && " · 민감(국장·담당자만)"}
          </span>
        </span>
      </button>
      {open && (
        <Modal wide title={form.name} subtitle={`원본 양식 v${form.version} · 읽기 전용 미리보기(아직 업무가 만들어지지 않습니다)`} onClose={() => setOpen(false)}>
          <XlsxPreview path={form.path} />
          <form
            className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError(null);
              const result = await createFinanceDoc({
                formId: form.id,
                title: String(f.get("title") ?? ""),
                semester: String(f.get("semester") ?? ""),
                baseDate: String(f.get("base_date") ?? ""),
                assigneeId: String(f.get("assignee_id") ?? ""),
                requestId,
                eventCategory: String(f.get("event_category") ?? ""),
              });
              if (result.error) {
                setError(result.error);
                setBusy(false);
              } else router.push(`/finance/docs/${result.id}`);
            }}
          >
            <p className="font-semibold">이 양식으로 작업하기</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={`${LABEL} sm:col-span-3`}>
                <span>문서 제목</span>
                <input name="title" required maxLength={120} className={INPUT} placeholder={`예: 11월 ${form.name}`} />
              </label>
              <label className={LABEL}>
                <span>학기</span>
                <input name="semester" required defaultValue={defaultSemester} pattern="\d{4}-[12]" className={INPUT} />
              </label>
              <label className={LABEL}>
                <span>기준일</span>
                <input name="base_date" type="date" defaultValue={today} className={INPUT} />
              </label>
              <label className={LABEL}>
                <span>행사</span>
                <select name="event_category" className={INPUT}>
                  <option value="">행사 없음</option>
                  {FINANCE_EVENTS.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              {canAssign ? (
                <label className={LABEL}>
                  <span>담당자</span>
                  <select name="assignee_id" className={INPUT} defaultValue="">
                    <option value="">미배정</option>
                    {members.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="self-end pb-2 text-xs text-muted">국원이 만든 업무는 미배정으로 시작하고, 국장이 담당자를 지정합니다.</p>
              )}
            </div>
            <ErrorText error={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY} onClick={() => setOpen(false)}>
                닫기
              </button>
              <button type="submit" className={PRIMARY} disabled={busy}>
                {busy ? "만드는 중…" : "업무 만들기"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// 파일 고르기 칸
function FileField({ label = ".xlsx 파일" }: { label?: string }) {
  return (
    <label className={LABEL}>
      <span>{label}</span>
      <input
        name="file"
        type="file"
        required
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border-input file:bg-surface file:px-3 file:py-2"
      />
    </label>
  );
}

// 양식 등록(재무국장·회장단). formId를 주면 새 버전 올리기
export function RegisterFormButton({ termId, formId, label }: { termId: string; formId?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={SECONDARY} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <Modal title={formId ? "양식 새 버전 올리기" : "양식 등록"} onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError(null);
              try {
                const file = await uploadFinanceFile(termId, f.get("file") as File);
                const result = await saveFinanceForm({
                  id: formId,
                  name: String(f.get("name") ?? ""),
                  sensitive: f.get("sensitive") === "on",
                  filePath: file.path,
                  fileName: file.name,
                });
                if (result.error) throw new Error(result.error);
                setOpen(false);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className={LABEL}>
              <span>양식 이름</span>
              <input name="name" required maxLength={80} className={INPUT} placeholder="예: 회계장부" />
            </label>
            <FileField />
            <label className="flex items-start gap-2 text-sm">
              <input name="sensitive" type="checkbox" className="mt-0.5 size-4 accent-coral-700" />
              <span>
                민감 양식(개인정보 포함)
                <span className="block text-xs text-muted">이 양식으로 만든 문서는 회장단·재무국장·만든 사람·담당자만 봅니다. 예: 학생회비 납부자 명단</span>
              </span>
            </label>
            <ErrorText error={error} />
            <div className="flex justify-end">
              <button type="submit" className={PRIMARY} disabled={busy}>
                {busy ? "올리는 중…" : "등록"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// 참고 자료 등록(지난 자료, 업무 없이). 재무국장·회장단
export function ImportDocButton({ termId, defaultSemester, today }: { termId: string; defaultSemester: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={SECONDARY} onClick={() => setOpen(true)}>
        + 참고 자료 등록
      </button>
      {open && (
        <Modal title="참고 자료 등록" subtitle="업무 작성에 참고할 실제 사례를 등록합니다." onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError(null);
              try {
                const file = await uploadFinanceFile(termId, f.get("file") as File);
                const result = await importFinanceDoc({
                  title: String(f.get("title") ?? ""),
                  semester: String(f.get("semester") ?? ""),
                  baseDate: String(f.get("base_date") ?? ""),
                  sensitive: f.get("sensitive") === "on",
                  filePath: file.path,
                  fileName: file.name,
                });
                if (result.error) throw new Error(result.error);
                router.push(`/finance/docs/${result.id}`);
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            <label className={LABEL}>
              <span>제목</span>
              <input name="title" required maxLength={120} className={INPUT} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL}>
                <span>학기</span>
                <input name="semester" required defaultValue={defaultSemester} pattern="\d{4}-[12]" className={INPUT} />
              </label>
              <label className={LABEL}>
                <span>기준일</span>
                <input name="base_date" type="date" defaultValue={today} className={INPUT} />
              </label>
            </div>
            <FileField />
            <label className="flex items-center gap-2 text-sm">
              <input name="sensitive" type="checkbox" className="size-4 accent-coral-700" /> 민감 자료(국장·담당자만)
            </label>
            <ErrorText error={error} />
            <div className="flex justify-end">
              <button type="submit" className={PRIMARY} disabled={busy}>
                {busy ? "올리는 중…" : "등록"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// 작성한 파일을 새 버전으로 올리기(담당자·재무국장·회장단)
export function UploadVersionForm({ termId, docId }: { termId: string; docId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3 rounded-xl border border-zinc-200 bg-surface p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const f = new FormData(formEl);
        setBusy(true);
        setMessage(null);
        try {
          const file = await uploadFinanceFile(termId, f.get("file") as File);
          const result = await addFinanceDocVersion({ docId, filePath: file.path, fileName: file.name, note: String(f.get("note") ?? "") });
          if (result.error) throw new Error(result.error);
          formEl.reset();
          setMessage({ ok: true, text: "새 버전을 올렸습니다." });
        } catch (err) {
          setMessage({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold">작성한 파일 올리기</p>
      <p className="text-sm text-muted">아래 최신 파일을 내려받아 엑셀에서 작성한 뒤, 새 버전으로 올립니다. 이전 버전은 그대로 남습니다.</p>
      <FileField label="작성한 .xlsx 파일" />
      <label className={LABEL}>
        <span>메모(선택)</span>
        <input name="note" maxLength={300} className={INPUT} placeholder="예: 11월 영수증 반영" />
      </label>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700 dark:text-green-400" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className={PRIMARY} disabled={busy}>
          {busy ? "올리는 중…" : "새 버전 올리기"}
        </button>
      </div>
    </form>
  );
}

export function DownloadButton({ path, fileName, label = "내려받기" }: { path: string; fileName: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className={SECONDARY}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadFinanceFile(path, fileName);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "받는 중…" : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
