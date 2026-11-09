import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getPlatformName } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 탭 제목은 "<화면> | <학생회 이름> 운영 플랫폼". 각 page는 화면 이름만 적는다.
export async function generateMetadata(): Promise<Metadata> {
  const name = await getPlatformName();
  return { title: { default: name, template: `%s | ${name}` } };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
