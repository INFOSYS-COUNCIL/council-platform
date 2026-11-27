"use client";

import { useEffect, useState } from "react";
import { CardStage } from "@/components/cards/card-stage";
import { ColorField, ElementPanel } from "@/components/cards/element-panel";
import { Alert } from "@/components/ui/alert";
import { useUndoable, useUndoKeys } from "@/lib/cards/history";
import {
  boxElement,
  CARD_SIZES,
  GRID_SIZES,
  LAYOUT_PRESETS,
  moveLayer,
  newId,
  presetLayout,
  textElement,
  type CardElement,
  type CardLayout,
  type CardTemplate,
  type LayoutPreset,
} from "@/lib/cards/model";
import { exportPages, FONT_ACCEPT, IMAGE_ACCEPT, layoutFrame, uploadAsset } from "@/lib/cards/render";
import { useTemplateAssets } from "@/lib/cards/use-assets";
import { saveTemplate } from "../../actions";

const BTN = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border-input bg-surface px-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800";
const PRIMARY = "inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";
const INPUT = "rounded-lg border border-border-input bg-surface px-3 py-2 text-sm";

// 틀 편집기(국장 이상): 크기·배경색·배경 그림·글꼴 파일과 장 모양(템플릿: 표지·본문·달력 등)마다 배경과 요소 배치를 정한다.
// 요소는 마우스로 끌어 옮기고, 고정 요소(카드뉴스에서 못 고침)와 고칠 수 있는 칸을 나눈다.
export function TemplateEditor({ termId, initial, councilName }: { termId: string; initial: CardTemplate; councilName: string }) {
  const history = useUndoable(initial);
  const t = history.value;
  const [layoutId, setLayoutId] = useState(initial.layouts[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [grid, setGrid] = useState(0);
  const assetsFor = useTemplateAssets(t);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const undo = () => {
    history.undo();
    setDirty(true);
  };
  const redo = () => {
    history.redo();
    setDirty(true);
  };
  useUndoKeys(undo, redo);

  const edit = (fn: (prev: CardTemplate) => CardTemplate, key?: string) => {
    history.set(fn, key);
    setDirty(true);
  };
  const update = (patch: Partial<CardTemplate>, key?: string) => edit((prev) => ({ ...prev, ...patch }), key);
  const layout = t.layouts.find((l) => l.id === layoutId) ?? t.layouts[0];
  const setLayout = (fn: (l: CardLayout) => CardLayout, key?: string) =>
    edit((prev) => ({ ...prev, layouts: prev.layouts.map((l) => (l.id === layout?.id ? fn(l) : l)) }), key);
  const changeElement = (id: string, patch: Partial<CardElement>, key?: string) =>
    setLayout((l) => ({ ...l, elements: l.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), key);
  const addLayout = (l: CardLayout) => {
    edit((prev) => ({ ...prev, layouts: [...prev.layouts, l] }));
    setLayoutId(l.id);
    setSelectedId(null);
  };

  const upload = async (file: File | undefined, apply: (path: string) => void, done: string) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      apply(await uploadAsset(termId, file));
      setStatus({ tone: "info", text: done });
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
          <input className={INPUT} value={t.name} maxLength={60} onChange={(e) => update({ name: e.target.value }, "name")} />
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
        <div className="w-48">
          <ColorField label="기본 배경색" value={t.background_color} onChange={(c) => update({ background_color: c }, "bg")} />
        </div>
        <label className={`${BTN} cursor-pointer`}>
          {t.background_path ? "기본 배경 그림 바꾸기" : "기본 배경 그림 올리기"}
          <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0], (p) => update({ background_path: p }), "배경 그림을 올렸습니다.")} />
        </label>
        {t.background_path && (
          <button type="button" className={BTN} onClick={() => update({ background_path: null })}>
            배경 그림 빼기
          </button>
        )}
        <label className={`${BTN} cursor-pointer`}>
          {t.font_path ? "글꼴 파일 바꾸기" : "글꼴 파일 올리기 (OTF·TTF·WOFF)"}
          <input
            type="file"
            accept={FONT_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0], (p) => update({ font_path: p }), "글꼴을 올렸습니다. 저장하면 이 틀의 모든 카드뉴스에 쓰입니다.")}
          />
        </label>
        {t.font_path && (
          <button type="button" className={BTN} onClick={() => update({ font_path: null })}>
            기본 글꼴로
          </button>
        )}
      </div>

      {status && <Alert tone={status.tone === "error" ? undefined : "info"}>{status.text}</Alert>}

      {/* 장 모양(템플릿) */}
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
        <select
          aria-label="기본 템플릿 더하기"
          className={INPUT}
          value=""
          onChange={(e) => e.target.value && addLayout(presetLayout(e.target.value as LayoutPreset, t.width, t.height, councilName))}
        >
          <option value="">+ 기본 템플릿 더하기</option>
          {LAYOUT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {layout && (
          <button
            type="button"
            className={BTN}
            onClick={() => addLayout({ ...structuredClone(layout), id: newId(), name: `${layout.name} 복사`, elements: layout.elements.map((e) => ({ ...e, id: newId() })) })}
          >
            + 지금 템플릿 복사
          </button>
        )}
      </div>

      {layout && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            {/* 이 템플릿 설정: 이름·배경 */}
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-surface p-3 dark:border-zinc-800">
              <label className="space-y-1 text-sm font-medium">
                <span className="block">템플릿 이름</span>
                <input className={`${INPUT} w-36`} value={layout.name} maxLength={20} onChange={(e) => setLayout((l) => ({ ...l, name: e.target.value }), "layout-name")} />
              </label>
              <div className="w-48">
                <ColorField label="이 템플릿 배경색" value={layout.backgroundColor ?? t.background_color} onChange={(c) => setLayout((l) => ({ ...l, backgroundColor: c }), "layout-bg")} />
              </div>
              <label className={`${BTN} cursor-pointer`}>
                {layout.backgroundPath ? "배경 그림 바꾸기" : "이 템플릿만 배경 그림"}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => upload(e.target.files?.[0], (p) => setLayout((l) => ({ ...l, backgroundPath: p })), "이 템플릿의 배경 그림을 올렸습니다.")}
                />
              </label>
              {(layout.backgroundColor || layout.backgroundPath) && (
                <button type="button" className={BTN} onClick={() => setLayout((l) => ({ ...l, backgroundColor: null, backgroundPath: null }))}>
                  틀 기본 배경 따르기
                </button>
              )}
              {t.layouts.length > 1 && (
                <button
                  type="button"
                  className={`${BTN} text-danger`}
                  onClick={() => {
                    edit((prev) => ({ ...prev, layouts: prev.layouts.filter((l) => l.id !== layout.id) }));
                    setLayoutId(t.layouts.find((l) => l.id !== layout.id)!.id);
                  }}
                >
                  이 템플릿 지우기
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className={BTN} disabled={!history.canUndo} onClick={undo} title="되돌리기 (Ctrl+Z)">
                ↶ 되돌리기
              </button>
              <button type="button" className={BTN} disabled={!history.canRedo} onClick={redo} title="다시 하기 (Ctrl+Shift+Z)">
                ↷ 다시 하기
              </button>
              <button type="button" className={BTN} onClick={() => setLayout((l) => ({ ...l, elements: [...l.elements, textElement({ label: "새 글" })] }))}>
                + 글
              </button>
              <button type="button" className={BTN} onClick={() => setLayout((l) => ({ ...l, elements: [...l.elements.filter((e) => e.kind === "box"), boxElement({}), ...l.elements.filter((e) => e.kind !== "box")] }))}>
                + 상자
              </button>
              <label className="space-y-1 text-sm font-medium">
                <span className="block">격자 맞추기</span>
                <select className={INPUT} value={grid} onChange={(e) => setGrid(Number(e.target.value))}>
                  {GRID_SIZES.map((g) => (
                    <option key={g} value={g}>
                      {g ? `${g}px 칸` : "끄기"}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={BTN} onClick={() => exportPages([{ frame: layoutFrame(t, layout), elements: layout.elements, assets: assetsFor(layout) }], "png", `${t.name}-${layout.name}`, [1])}>
                PNG 미리 받기
              </button>
            </div>
            <CardStage
              frame={layoutFrame(t, layout)}
              assets={assetsFor(layout)}
              elements={layout.elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={changeElement}
              lockFixed={false}
              grid={grid}
            />
          </div>
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-zinc-200 bg-surface p-4 lg:max-h-[80vh] lg:overflow-y-auto dark:border-zinc-800">
              <ElementPanel
                template
                element={selected}
                onChange={(patch, key) => selected && changeElement(selected.id, patch, key)}
                onLayer={(move) => selectedId && setLayout((l) => ({ ...l, elements: moveLayer(l.elements, selectedId, move) }))}
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
