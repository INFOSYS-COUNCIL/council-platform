import Link from "next/link";
import { photoTagHref } from "@/lib/photos/content";

export function PhotoTags({ tags, onPaper = false, searchQuery = "", mobileCompact = false }: { tags: readonly string[]; onPaper?: boolean; searchQuery?: string; mobileCompact?: boolean }) {
  if (!tags.length) return null;
  return (
    <ul aria-label="해시태그" className={`flex flex-wrap ${mobileCompact ? "gap-x-2 gap-y-0 sm:gap-2" : "gap-2"}`}>
      {tags.map((tag) => (
        <li key={tag} className="min-w-0 max-w-full">
          <Link href={photoTagHref(tag, searchQuery)} className={`inline-block max-w-full break-all rounded-full font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${mobileCompact ? "min-h-8 py-1 text-xs sm:min-h-9 sm:border sm:px-3 sm:py-1.5 sm:text-sm" : "min-h-9 border px-3 py-1.5 text-sm"} ${onPaper ? "border-[#dfcdbd] bg-[#f3e5d7] text-[#573a2d] hover:bg-[#ead5c2]" : mobileCompact ? "text-muted hover:underline sm:border-border-input/50 sm:bg-surface sm:text-foreground" : "border-border-input/50 bg-surface text-foreground hover:underline"}`}>
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
