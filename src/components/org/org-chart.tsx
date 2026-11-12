import type { ChartGroup, ChartPerson } from "@/lib/org/public-chart";
import { ROLE_LABELS } from "@/lib/auth/roles";

// 업무 없이 사람만 보이는 조직도. 업무 공간 > 조직도와 첫 화면이 함께 쓴다.
export function OrgChart({ executives, departments }: { executives: ChartPerson[]; departments: ChartGroup[] }) {
  if (executives.length === 0 && departments.length === 0) {
    return <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">아직 등록된 구성원이 없습니다.</p>;
  }
  return (
    <div className="space-y-6">
      {executives.length > 0 && (
        <section aria-labelledby="org-executives" className="mx-auto max-w-xl">
          <Card id="org-executives" title="회장단" people={executives} />
        </section>
      )}
      {executives.length > 0 && departments.length > 0 && (
        <div aria-hidden="true" className="mx-auto h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
      )}
      {departments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((g, i) => (
            <section key={g.title} aria-labelledby={`org-dept-${i}`}>
              <Card id={`org-dept-${i}`} title={g.title} people={g.people} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ id, title, people }: { id: string; title: string; people: ChartPerson[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 id={id} className="border-b border-zinc-200 px-4 py-3 font-bold dark:border-zinc-800">
        {title}
      </h3>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {people.map((p, i) => (
          <li key={i} className={`flex items-center gap-2 py-2.5 pr-4 ${p.role === "MEMBER" ? "pl-8" : "pl-4"}`}>
            {p.role === "MEMBER" && <span aria-hidden="true" className="text-zinc-400">└</span>}
            <span className="truncate font-medium">{p.name}</span>
            <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{p.position ?? ROLE_LABELS[p.role]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
