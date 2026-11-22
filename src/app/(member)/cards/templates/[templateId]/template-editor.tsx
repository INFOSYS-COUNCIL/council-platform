"use client";

import { useEffect, useState } from "react";
import { CardStage } from "@/components/cards/card-stage";
import { ElementPanel } from "@/components/cards/element-panel";
import { Alert } from "@/components/ui/alert";
import { boxElement, CARD_SIZES, newId, textElement, type CardElement, type CardLayout, type CardTemplate } from "@/lib/cards/model";
import { downloadSlide, FONT_ACCEPT, IMAGE_ACCEPT, loadAssets, uploadAsset, type CardAssets } from "@/lib/cards/render";
import { saveTemplate } from "../../actions";

const EMPTY_ASSETS: CardAssets = { fontFamily: "", background: null, backgroundUrl: null };
const BTN = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border-input bg-surface px-3 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800";
const PRIMARY = "inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";
const INPUT = "rounded-lg border border-border-input bg-surface px-3 py-2 text-sm";

// 틀 편집기(국장 이상): 크기·배경색·배경 그림·글꼴 파일과 장 모양(표지·본문 등)마다 요소 배치를 정한다.
// 요소는 마우스로 끌어 옮기고, 고정 요소(카드뉴스에서 못 고침)와 고칠 수 있는 칸을 나눈다.
export function TemplateEditor({ termId, initial }: { termId: string; initial: CardTemplate }) {
  const [t, setT] = useState(initial);
  const [layoutId, setLayoutId] = useState(initial.layouts[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assets, setAssets] = useState<CardAssets>(EMPTY_ASSETS);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadAssets(t.background_path, t.font_path).then((a) => live && setAssets(a));
    return () => {
      live = false;
    };
  }, [t.background_path, t.font_path]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch: Partial<CardTemplate>) => {
    setT((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const layout = t.layouts.find((l) => l.id === layoutId) ?? t.layouts[0];
  const setLayout = (fn: (l: CardLayout) => CardLayout) => update({ layouts: t.layouts.map((l) => (l.id === layout?.id ? fn(l) : l)) });
  const changeElement = (id: string, patch: Partial<CardElement>) =>
    setLayout((l) => ({ ...l, elements: l.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const upload = async (file: File | undefined, field: "background_path" | "font_path") => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      update({ [field]: await uploadAsset(termId, file) } as Partial<CardTemplate>);
      setStatus({ tone: "info", text: field === "font_path" ? "글꼴을 올렸습니다. 저장하면 이 틀의 모든 카드뉴스에 쓰입니다." : "배경 그림을 올렸습니다." });
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const result = await saveTemplate({ ...t });
    setBusy(false);
    if (result.error) setStatus({ tone: "error", text: result.error });
    else {
      setDirty(false);
      setStatus({ tone: "info", text: "틀을 저장했습니다." });
    }
  };

  const sizeIndex = CARD_SIZES.findIndex((s) => s.width === t.width && s.height === t.height);
  const selected = layout?.elements.find((e) => e.id === selectedId);

  return (
    <div className="space-y-5">
      {/* 틀 전체 설정 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
        <label className="space-y-1 text-sm font-medium">
          <span className="block">틀 이름</span>
          <input className={INPUT} value={t.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span className="block">크기</span>
          <select
            className={INPUT}
            value={sizeIndex < 0 ? "" : String(sizeIndex)}
            onChange={(e) => {
              const s = CARD_SIZES[Number(e.target.value)];
              if (s) update({ width: s.width, height: s.height });
            }}
          >
            {sizeIndex < 0 && <option value="">{`${t.width}×${t.height}`}</option>}
            {CARD_SIZES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span className="block">배경색</span>
          <input type="color" value={t.background_color} onChange={(e) => update({ background_color: e.target.value })} className="h-10 w-16 cursor-pointer rounded-lg border border-border-input" />
        </label>
        <label className={`${BTN} cursor-pointer`}>
          {t.background_path ? "배경 그림 바꾸기" : "배경 그림 올리기"}
          <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0], "background_path")} />
        </label>
        {t.background_path && (
          <button type="button" className={BTN} onClick={() => update({ background_path: null })}>
            배경 그림 빼기
          </button>
        )}
        <label className={`${BTN} cursor-pointer`}>
          {t.font_path ? "글꼴 파일 바꾸기" : "글꼴 파일 올리기 (OTF·TTF·WOFF)"}
          <input type="file" accept={FONT_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0], "font_path")} />
        </label>
        {t.font_path && (
          <button type="button" className={BTN} onClick={() => update({ font_path: null })}>
            기본 글꼴로
          </button>
        )}
      </div>

      {status && <Alert tone={status.tone === "error" ? undefined : "info"}>{status.text}</Alert>}

      {/* 장 모양 */}
      <div className="flex flex-wrap items-center gap-2">
        {t.layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === layout?.id}
            onClick={() => {
              setLayoutId(l.id);
              setSelectedId(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm ${l.id === layout?.id ? "border-accent bg-accent text-on-accent" : "border-border-input"}`}
          >
            {l.name}
          </button>
        ))}
        <button
          type="button"
          className={BTN}
          onClick={() => {
            const copy: CardLayout = { id: newId(), name: `${layout?.name ?? "장"} 복사`, elements: (layout?.elements ?? []).map((e) => ({ ...e, id: newId() })) };
            update({ layouts: [...t.layouts, copy] });
            setLayoutId(copy.id);
          }}
        >
          + 장 모양 복사
        </button>
        {layout && (
          <>
            <input className={`${INPUT} w-32`} aria-label="장 모양 이름" value={layout.name} maxLength={20} onChange={(e) => setLayout((l) => ({ ...l, name: e.target.value }))} />
            {t.layouts.length > 1 && (
              <button
                type="button"
                className={`${BTN} text-danger`}
                onClick={() => {
                  update({ layouts: t.layouts.filter((l) => l.id !== layout.id) });
                  setLayoutId(t.layouts.find((l) => l.id !== layout.id)!.id);
                }}
              >
                이 장 모양 지우기
              </button>
            )}
          </>
        )}
      </div>

      {layout && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN} onClick={() => setLayout((l) => ({ ...l, elements: [...l.elements, textElement({ label: "새 글" })] }))}>
                + 글
              </button>
              <button type="button" className={BTN} onClick={() => setLayout((l) => ({ ...l, elements: [...l.elements.filter((e) => e.kind === "box"), boxElement({}), ...l.elements.filter((e) => e.kind !== "box")] }))}>
                + 상자
              </button>
              <button type="button" className={BTN} onClick={() => downloadSlide(t, layout.elements, assets, "png", `${t.name}-${layout.name}`)}>
                PNG 미리 받기
              </button>
            </div>
            <CardStage
              frame={t}
              assets={assets}
              elements={layout.elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={changeElement}
              lockFixed={false}
            />
          </div>
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
              <ElementPanel
                template
                element={selected}
                onChange={(patch) => selected && changeElement(selected.id, patch)}
                onDelete={() => {
                  setLayout((l) => ({ ...l, elements: l.elements.filter((e) => e.id !== selectedId) }));
                  setSelectedId(null);
                }}
              />
            </div>
            <button type="button" className={`${PRIMARY} w-full`} disabled={busy || !dirty} onClick={save}>
              {busy ? "저장 중…" : dirty ? "틀 저장" : "저장됨"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
