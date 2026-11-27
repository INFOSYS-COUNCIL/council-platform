"use client";

import { useEffect, useState } from "react";
import type { CardLayout, CardTemplate } from "./model";
import { layoutFrame, loadAssets, type CardAssets } from "./render";

const EMPTY: CardAssets = { fontFamily: "", background: null, backgroundUrl: null };

// 틀의 글꼴과, 틀·장 모양마다 다른 배경 그림을 받아 둔다. assetsFor(장 모양)로 그 장에 쓸 것을 꺼낸다
export function useTemplateAssets(template: CardTemplate) {
  const paths = [...new Set([template.background_path, ...template.layouts.map((l) => l.backgroundPath ?? null)])];
  const key = `${template.font_path}|${paths.join("|")}`;
  const [loaded, setLoaded] = useState<Record<string, CardAssets>>({});

  useEffect(() => {
    let live = true;
    Promise.all(paths.map(async (p) => [p ?? "", await loadAssets(p, template.font_path)] as const)).then((entries) => live && setLoaded(Object.fromEntries(entries)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (layout: CardLayout | undefined): CardAssets => loaded[layoutFrame(template, layout).background_path ?? ""] ?? EMPTY;
}
