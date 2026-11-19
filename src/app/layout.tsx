import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_KR } from "next/font/google";
import { getPlatformName } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gaonFont = Noto_Serif_KR({
  variable: "--font-gaon-serif",
  weight: ["600", "900"],
  subsets: ["latin"],
  preload: false,
  fallback: ["Cafe24 Classictype", "serif"],
});

export const viewport: Viewport = { interactiveWidget: "resizes-content" };

// 탭 제목은 "<화면> | <학생회 이름>". 각 page는 화면 이름만 적는다.
export async function generateMetadata(): Promise<Metadata> {
  const name = await getPlatformName();
  return { title: { default: name, template: `%s | ${name}` } };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${gaonFont.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
