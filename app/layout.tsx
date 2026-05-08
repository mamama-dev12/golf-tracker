import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const BASE_URL = "https://golf-tracker-app.vercel.app";

export const metadata: Metadata = {
  title: "ゴルフ上達ノート | スコア記録・練習管理",
  description: "ラウンドのスコアをホール別に記録して弱点を自動分析。練習内容も管理してスコアアップを目指そう。登録不要・無料で使えるゴルフ管理アプリ。",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "ゴルフ上達ノート | スコア記録・練習管理",
    description: "ラウンドのスコアをホール別に記録して弱点を自動分析。練習内容も管理してスコアアップを目指そう。",
    url: BASE_URL,
    siteName: "ゴルフ上達ノート",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ゴルフ上達ノート | スコア記録・練習管理",
    description: "ラウンドのスコアをホール別に記録して弱点を自動分析。練習内容も管理してスコアアップを。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ゴルフ上達ノート" />
        <meta name="theme-color" content="#15803d" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1032007530076908"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
