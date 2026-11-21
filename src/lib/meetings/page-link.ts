import { createInlineContentSpec } from "@blocknote/core";

// 페이지 바로가기(인라인): 본문 안에서 다른 페이지·회의록으로 바로 가는 칩. 마우스를 올리면 미리보기 카드가 뜬다.
// React 없이 DOM으로 그린다(회의록 구조는 서버의 Template 변환에서도 쓰므로). 미리보기는 /api/page-preview/<id>가 RLS로 돌려준다.

type Preview = { title: string; crumb: string; snippet: string };
const cache = new Map<string, Promise<Preview | null>>();
const DOC_ICON =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4 2.5h5l3 3v8a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5v-10.5a.5.5 0 0 1 .5-.5Z"/><path d="M9 2.5v3h3M5.5 8.5h5M5.5 11h3.5"/></svg>';

function loadPreview(pageId: string): Promise<Preview | null> {
  if (!cache.has(pageId)) {
    cache.set(
      pageId,
      fetch(`/api/page-preview/${pageId}`)
        .then((r) => (r.ok ? (r.json() as Promise<Preview>) : null))
        .catch(() => null),
    );
  }
  return cache.get(pageId)!;
}

// 칩 아래에 미리보기 카드를 띄운다(화면 기준 위치라 스크롤 영역에 잘리지 않는다)
function attachHoverPreview(anchor: HTMLElement, pageId: string, fallbackTitle: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let card: HTMLDivElement | null = null;
  const hide = () => {
    clearTimeout(timer);
    card?.remove();
    card = null;
  };
  const show = async () => {
    const preview = await loadPreview(pageId);
    if (!anchor.isConnected || card) return;
    const r = anchor.getBoundingClientRect();
    card = document.createElement("div");
    card.setAttribute("role", "tooltip");
    card.className =
      "page-link-card fixed z-50 w-72 rounded-xl border border-zinc-200 bg-surface p-4 text-left shadow-xl dark:border-zinc-700";
    card.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 296))}px`;
    card.style.top = `${r.bottom + 6}px`;
    const icon = document.createElement("div");
    icon.className = "text-zinc-500 dark:text-zinc-400";
    icon.innerHTML = DOC_ICON.replace('width="16" height="16"', 'width="28" height="28"');
    const crumb = document.createElement("p");
    crumb.className = "mt-3 truncate text-xs text-zinc-500 dark:text-zinc-400";
    crumb.textContent = preview?.crumb ?? "볼 수 없는 페이지";
    const title = document.createElement("p");
    title.className = "truncate text-sm font-bold";
    title.textContent = preview?.title ?? fallbackTitle;
    card.append(icon, crumb, title);
    if (preview?.snippet) {
      const snippet = document.createElement("p");
      snippet.className = "mt-3 line-clamp-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
      snippet.textContent = preview.snippet;
      card.append(snippet);
    }
    document.body.append(card);
  };
  anchor.addEventListener("mouseenter", () => {
    clearTimeout(timer);
    timer = setTimeout(show, 250);
  });
  anchor.addEventListener("mouseleave", hide);
  anchor.addEventListener("click", hide);
  return hide;
}

export const pageLinkSpec = createInlineContentSpec(
  {
    type: "pageLink",
    propSchema: { pageId: { default: "" }, title: { default: "페이지" } },
    content: "none",
  },
  {
    render: (inline) => {
      const { pageId, title } = inline.props;
      const a = document.createElement("a");
      a.href = `/pages/${pageId}`;
      a.dataset.pageLink = pageId;
      a.dataset.pageTitle = title;
      a.contentEditable = "false";
      a.className =
        "page-link inline-flex items-baseline gap-1 rounded px-0.5 font-semibold text-foreground underline decoration-zinc-400 underline-offset-4 hover:bg-zinc-100 dark:hover:bg-zinc-800";
      a.innerHTML = `<span class="self-center">${DOC_ICON}</span>`;
      const label = document.createElement("span");
      label.textContent = title;
      a.append(label);
      // 편집기 안에서도 누르면 바로 그 페이지로 간다
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.assign(a.href);
      });
      const hide = attachHoverPreview(a, pageId, title);
      return { dom: a, destroy: hide };
    },
    parse: (el) => (el.dataset.pageLink ? { pageId: el.dataset.pageLink, title: el.dataset.pageTitle ?? el.textContent ?? "페이지" } : undefined),
    toExternalHTML: (inline) => {
      const a = document.createElement("a");
      a.href = `/pages/${inline.props.pageId}`;
      a.textContent = `📄 ${inline.props.title}`;
      return { dom: a };
    },
  },
);
