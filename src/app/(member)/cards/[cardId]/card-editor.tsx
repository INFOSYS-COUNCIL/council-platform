"use client";

import { useEffect, useState } from "react";
import { CardStage } from "@/components/cards/card-stage";
import { ElementPanel } from "@/components/cards/element-panel";
import { Alert } from "@/components/ui/alert";
import { newSlide, slideElements, type CardElement, type CardSlide, type CardTemplate } from "@/lib/cards/model";
import { downloadSlide, loadAssets, type CardAssets } from "@/lib/cards/render";
import { saveCard } from "../actions";

const EMPTY_ASSETS: CardAssets = { fontFamily: "", background: null, backgroundUrl: null };
const BTN = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border-input bg-surface px-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800";
const PRIMARY = "inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";

// 카드뉴스 편집기: 틀의 장 모양으로 장을 더하고, 고칠 수 있는 칸의 글·크기·색·위치를 바꾼 뒤 PNG·JPEG로 내려받는다.
// 틀에 고정된 요소(상단 문구 등)는 고를 수 없고 항상 지금 틀 모양을 따른다.
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
  const [slides, setSlides] = useState(initialSlides);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assets, setAssets] = useState<CardAssets>(EMPTY_ASSETS);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"png" | "jpeg">("png");

  useEffect(() => {
    let live = true;
    loadAssets(template.background_path, template.font_path).then((a) => live && setAssets(a));
    return () => {
      live = false;
    };
  }, [template.background_path, template.font_path]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const slide = slides[Math.min(index, slides.length - 1)];
  const elements = slide ? slideElements(slide, template.layouts) : [];
  const selected = elements.find((e) => e.id === selectedId);

  const setSlidesDirty = (next: CardSlide[]) => {
    setSlides(next);
    setDirty(true);
  };
  const changeElement = (id: string, patch: Partial<CardElement>) => {
    if (!slide) return;
    const current = elements.find((e) => e.id === id);
    if (!current?.editable) return;
    const updated = { ...current, ...patch };
    const has = slide.elements.some((e) => e.id === id);
    setSlidesDirty(
      slides.map((s) =>
        s.id === slide.id ? { ...s, elements: has ? s.elements.map((e) => (e.id === id ? updated : e)) : [...s.elements, updated] } : s,
      ),
    );
  };
  const addSlide = (layoutId: string) => {
    const layout = template.layouts.find((l) => l.id === layoutId);
    if (!layout) return;
    const next = [...slides];
    next.splice(index + 1, 0, newSlide(layout));
    setSlidesDirty(next);
    setIndex(index + 1);
    setSelectedId(null);
  };
  const moveSlide = (step: -1 | 1) => {
    const to = index + step;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[index], next[to]] = [next[to], next[index]];
    setSlidesDirty(next);
    setIndex(to);
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

  const download = async (which: "one" | "all") => {
    setBusy(true);
    try {
      const list = which === "one" ? [index] : slides.map((_, i) => i);
      for (const i of list) {
        await downloadSlide(template, slideElements(slides[i], template.layouts), assets, format, `${title}-${String(i + 1).padStart(2, "0")}`);
        // 브라우저가 연속 내려받기를 막지 않도록 조금 쉰다
        if (list.length > 1) await new Promise((r) => setTimeout(r, 350));
      }
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

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
        <label className="space-y-1 text-sm font-medium">
          <span className="block">내려받기 형식</span>
          <select className="rounded-lg border border-border-input bg-surface px-3 py-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <button type="button" className={BTN} disabled={busy || !slide} onClick={() => download("one")}>
          이 장 내려받기
        </button>
        <button type="button" className={BTN} disabled={busy || slides.length === 0} onClick={() => download("all")}>
          전체 {slides.length}장 내려받기
        </button>
        {canEdit && (
          <button type="button" className={PRIMARY} disabled={busy || !dirty} onClick={save}>
            {busy ? "처리 중…" : dirty ? "저장" : "저장됨"}
          </button>
        )}
      </div>

      {status && <Alert tone={status.tone === "error" ? undefined : "info"}>{status.text}</Alert>}

      {/* 장 목록 */}
      <div className="flex flex-wrap items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={i === index}
            onClick={() => {
              setIndex(i);
              setSelectedId(null);
            }}
            className={`min-w-11 rounded-full border px-3 py-1.5 text-sm tabular-nums ${i === index ? "border-accent bg-accent text-on-accent" : "border-border-input"}`}
          >
            {i + 1}. {template.layouts.find((l) => l.id === s.layoutId)?.name ?? "장"}
          </button>
        ))}
        {canEdit && (
          <select
            aria-label="장 더하기"
            className="rounded-lg border border-border-input bg-surface px-3 py-2 text-sm"
            value=""
            onChange={(e) => e.target.value && addSlide(e.target.value)}
          >
            <option value="">+ 장 더하기</option>
            {template.layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        {canEdit && slide && (
          <span className="flex gap-1">
            <button type="button" className={BTN} disabled={index === 0} onClick={() => moveSlide(-1)} aria-label="이 장을 앞으로">
              ←
            </button>
            <button type="button" className={BTN} disabled={index === slides.length - 1} onClick={() => moveSlide(1)} aria-label="이 장을 뒤로">
              →
            </button>
            <button
              type="button"
              className={`${BTN} text-danger`}
              onClick={() => {
                setSlidesDirty(slides.filter((s) => s.id !== slide.id));
                setIndex(Math.max(0, index - 1));
                setSelectedId(null);
              }}
            >
              이 장 지우기
            </button>
          </span>
        )}
      </div>

      {slide ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <CardStage
            frame={template}
            assets={assets}
            elements={elements}
            selectedId={selectedId}
            onSelect={canEdit ? setSelectedId : () => {}}
            onChange={changeElement}
            lockFixed
          />
          <div className="rounded-xl border border-zinc-200 bg-surface p-4 lg:sticky lg:top-4 lg:self-start dark:border-zinc-800">
            {canEdit ? (
              <ElementPanel template={false} element={selected} onChange={(patch) => selected && changeElement(selected.id, patch)} />
            ) : (
              <p className="text-sm text-muted">만든 사람이나 국장 이상만 고칠 수 있습니다. 내려받기는 누구나 할 수 있습니다.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">장이 없습니다. 위에서 장을 더해 주세요.</p>
      )}
    </div>
  );
}
