import type { Metadata } from 'next';
import { Noto_Sans_KR, Noto_Serif_KR } from 'next/font/google';
import './globals.css';

const notoSans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const notoSerif = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'NovelForge — AI 소설 창작 스튜디오',
  description:
    '줄거리 기획, 등장인물·세계관 설정, 집필 피드백, AI 삽화 생성까지 한 곳에서 완성하는 소설 작성 보조 스튜디오',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSans.variable} ${notoSerif.variable}`}>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
