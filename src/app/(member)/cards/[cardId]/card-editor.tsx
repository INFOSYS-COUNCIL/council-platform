"use client";

import { useEffect, useState } from "react";
import { CardStage } from "@/components/cards/card-stage";
import { ElementPanel } from "@/components/cards/element-panel";
import { SlideThumb } from "@/components/cards/slide-thumb";
import { Alert } from "@/components/ui/alert";
import { useUndoable, useUndoKeys } from "@/lib/cards/history";
import { GRID_SIZES, moveLayer, newSlide, slideElements, type CardElement, type CardSlide, type CardTemplate, type LayerMove } from "@/lib/cards/model";
import { exportPages, layoutFrame, type ExportFormat } from "@/lib/cards/render";
import { useTemplateAssets } from "@/lib/cards/use-assets";
import { saveCard } from "../actions";

const BTN = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border-input bg-surface px-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800";
const PRIMARY = "inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";
const SELECT = "rounded-lg border border-border-input bg-surface px-3 py-2 text-sm";

// 카드뉴스 편집기: 틀의 장 모양(템플릿)으로 페이지를 더하고, 고칠 수 있는 칸의 글·크기·색·위치·순서를 바꾼 뒤 PNG·JPEG·PDF로 내려받는다.
// 틀에 고정된 요소(상단 문구 등)는 고를 수 없고 항상 지금 틀 모양을 따른다. 페이지에서 고친 내용은 이 카드뉴스에만 저장된다.
export function CardEditor({
  cardId,
  initialTitle,
  initialSlides,
  template,
  canEdit,
}: {
  cardId: string;
  initialTitle: string;
  initialSlides: CardSlide[];
  template: CardTemplate;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const history = useUndoable(initialSlides);
  const slides = history.value;
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [range, setRange] = useState<"one" | "all">("all");
  const [grid, setGrid] = useState(0);
  const [picking, setPicking] = useState(false);
  const assetsFor = useTemplateAssets(template);

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

  const at = Math.min(index, slides.length - 1);
  const slide = slides[at];
  const layoutOf = (s: CardSlide) => template.layouts.find((l) => l.id === s.layoutId);
  const elements = slide ? slideElements(slide, template.layouts) : [];
  const selected = elements.find((e) => e.id === selectedId);

  const edit = (update: (prev: CardSlide[]) => CardSlide[], key?: string) => {
    history.set(update, key);
    setDirty(true);
  };
  const changeElement = (id: string, patch: Partial<CardElement>, key?: string) => {
    if (!slide) return;
    const current = elements.find((e) => e.id === id);
    if (!current?.editable) return;
    const updated = { ...current, ...patch };
    edit(
      (prev) =>
        prev.map((s) =>
          s.id === slide.id ? { ...s, elements: s.elements.some((e) => e.id === id) ? s.elements.map((e) => (e.id === id ? updated : e)) : [...s.elements, updated] } : s,
        ),
      key,
    );
  };
  const layer = (move: LayerMove) => {
    if (!slide || !selectedId) return;
    const order = moveLayer(elements, selectedId, move).map((e) => e.id);
    edit((prev) => prev.map((s) => (s.id === slide.id ? { ...s, order } : s)));
  };
  const addSlide = (layoutId: string) => {
    const layout = template.layouts.find((l) => l.id === layoutId);
    if (!layout) return;
    edit((prev) => {
      const next = [...prev];
      next.splice(at + 1, 0, newSlide(layout));
      return next;
    });
    setIndex(at + 1);
    setSelectedId(null);
    setPicking(false);
  };
  const moveSlide = (step: -1 | 1) => {
    const to = at + step;
    if (to < 0 || to >= slides.length) return;
    edit((prev) => {
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
    setIndex(to);
  };
  const removeSlide = () => {
    if (!slide) return;
    edit((prev) => prev.filter((s) => s.id !== slide.id));
    setIndex(Math.max(0, at - 1));
    setSelectedId(null);
  };

  const save = async () => {
    setBusy(true);
    const result = await saveCard({ id: cardId, title, slides });
    setBusy(false);
    if (result.error) setStatus({ tone: "error", text: result.error });
    else {
      setDirty(false);
      setStatus({ tone: "info", text: "저장했습니다." });
    }
  };

  const download = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const numbers = range === "one" ? [at] : slides.map((_, i) => i);
      const pages = numbers.map((i) => {
        const layout = layoutOf(slides[i]);
        return { frame: layoutFrame(template, layout), elements: slideElements(slides[i], template.layouts), assets: assetsFor(layout) };
      });
      await exportPages(pages, format, range === "one" ? `${title}-${String(at + 1).padStart(2, "0")}` : title, numbers.map((i) => i + 1));
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const currentLayout = slide && layoutOf(slide);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-60 flex-1 space-y-1 text-sm font-medium">
          <span className="block">제목</span>
          <input
            className="w-full rounded-lg border border-border-input bg-surface px-3 py-2 text-sm"
            value={title}
            maxLength={100}
            disabled={!canEdit}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        {canEdit && (
          <button type="button" className={PRIMARY} disabled={busy || !dirty} onClick={save}>
            {busy ? "처리 중…" : dirty ? "저장" : "저장됨"}
          </button>
        )}
      </div>

      {/* 도구 줄: 되돌리기, 격자, 내려받기 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-surface p-3 dark:border-zinc-800">
        {canEdit && (
          <span className="flex gap-1">
            <button type="button" className={BTN} disabled={!history.canUndo} onClick={undo} title="되돌리기 (Ctrl+Z)">
              ↶ 되돌리기
            </button>
            <button type="button" className={BTN} disabled={!history.canRedo} onClick={redo} title="다시 하기 (Ctrl+Shift+Z)">
              ↷ 다시 하기
            </button>
          </span>
        )}
        {canEdit && (
          <label className="space-y-1 text-sm font-medium">
            <span className="block">격자 맞추기</span>
            <select className={SELECT} value={grid} onChange={(e) => setGrid(Number(e.target.value))}>
              {GRID_SIZES.map((g) => (
                <option key={g} value={g}>
                  {g ? `${g}px 칸` : "끄기"}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="ml-auto flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm font-medium">
            <span className="block">저장 범위</span>
            <select className={SELECT} value={range} onChange={(e) => setRange(e.target.value as "one" | "all")}>
              <option value="all">전체 페이지 ({slides.length}장)</option>
              <option value="one">현재 페이지만</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span className="block">형식</span>
            <select className={SELECT} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="pdf">PDF (한 파일)</option>
            </select>
          </label>
          <button type="button" className={BTN} disabled={busy || slides.length === 0} onClick={download}>
            파일로 저장
          </button>
        </span>
      </div>

      {status && <Alert tone={status.tone === "error" ? undefined : "info"}>{status.text}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[9rem_minmax(0,1fr)_20rem]">
        {/* 페이지 목록: 작은 미리보기를 눌러 이동 */}
        <nav aria-label="페이지" className="flex gap-3 overflow-x-auto pb-2 lg:max-h-[80vh] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
          {slides.map((s, i) => {
            const layout = layoutOf(s);
            return (
              <button
                key={s.id}
                type="button"
                aria-current={i === at ? "page" : undefined}
                aria-label={`${i + 1}페이지 (${layout?.name ?? "장"})`}
                onClick={() => {
                  setIndex(i);
                  setSelectedId(null);
                }}
                className={`w-24 shrink-0 rounded-lg border-2 p-1 text-left lg:w-full ${i === at ? "border-accent" : "border-transparent hover:border-border-input"}`}
              >
                <SlideThumb frame={layoutFrame(template, layout)} elements={slideElements(s, template.layouts)} assets={assetsFor(layout)} width={128} />
                <span className="mt-1 block truncate text-xs tabular-nums">
                  {i + 1}. {layout?.name ?? "장"}
                </span>
              </button>
            );
          })}
          {canEdit && (
            <button type="button" className={`${BTN} w-24 shrink-0 lg:w-full`} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
              + 페이지
            </button>
          )}
        </nav>

        <div className="min-w-0 space-y-3">
          {picking && (
            <section aria-label="새 페이지 템플릿 고르기" className="space-y-3 rounded-xl border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">어떤 템플릿으로 새 페이지를 만들까요?</p>
                <button type="button" className={BTN} onClick={() => setPicking(false)}>
                  닫기
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                {template.layouts.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => addSlide(l.id)} className="w-full rounded-lg border-2 border-transparent p-1 text-left hover:border-accent focus-visible:border-accent">
                      <SlideThumb frame={layoutFrame(template, l)} elements={l.elements} assets={assetsFor(l)} width={140} />
                      <span className="mt-1 block truncate text-sm font-medium">{l.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {slide ? (
            <>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-2 text-sm font-semibold tabular-nums">
                    {at + 1} / {slides.length}페이지 · {currentLayout?.name ?? "장"}
                  </span>
                  <button type="button" className={BTN} disabled={at === 0} onClick={() => moveSlide(-1)} aria-label="이 페이지를 앞으로">
                    ↑ 앞으로
                  </button>
                  <button type="button" className={BTN} disabled={at === slides.length - 1} onClick={() => moveSlide(1)} aria-label="이 페이지를 뒤로">
                    ↓ 뒤로
                  </button>
                  <button type="button" className={`${BTN} text-danger`} onClick={removeSlide}>
                    이 페이지 지우기
                  </button>
                </div>
              )}
              <CardStage
                frame={layoutFrame(template, currentLayout)}
                assets={assetsFor(currentLayout)}
                elements={elements}
                selectedId={selectedId}
                onSelect={canEdit ? setSelectedId : () => {}}
                onChange={changeElement}
                lockFixed
                grid={grid}
              />
            </>
          ) : (
            <p className="text-sm text-muted">페이지가 없습니다. 왼쪽 &lsquo;+ 페이지&rsquo;로 템플릿을 골라 더해 주세요.</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-surface p-4 lg:sticky lg:top-4 lg:max-h-[90vh] lg:self-start lg:overflow-y-auto dark:border-zinc-800">
          {canEdit ? (
            <ElementPanel template={false} element={selected} onChange={(patch, key) => selected && changeElement(selected.id, patch, key)} onLayer={layer} />
          ) : (
            <p className="text-sm text-muted">만든 사람이나 국장 이상만 고칠 수 있습니다. 내려받기는 누구나 할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
