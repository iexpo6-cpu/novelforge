import type { Metadata } from 'next';
import {
  Noto_Sans_KR,
  Noto_Serif_KR,
  Nanum_Myeongjo,
  Nanum_Gothic,
  Gowun_Batang,
  Gowun_Dodum,
  IBM_Plex_Sans_KR,
  Hahmlet,
  Nanum_Pen_Script,
} from 'next/font/google';
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

const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-nanum-myeongjo',
});

const nanumGothic = Nanum_Gothic({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-nanum-gothic',
});

const gowunBatang = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-gowun-batang',
});

const gowunDodum = Gowun_Dodum({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-gowun-dodum',
});

const ibmPlexSansKr = IBM_Plex_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ibm-plex',
});

const hahmlet = Hahmlet({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-hahmlet',
});

const nanumPen = Nanum_Pen_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-nanum-pen',
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
    <html
      lang="ko"
      className={`${notoSans.variable} ${notoSerif.variable} ${nanumMyeongjo.variable} ${nanumGothic.variable} ${gowunBatang.variable} ${gowunDodum.variable} ${ibmPlexSansKr.variable} ${hahmlet.variable} ${nanumPen.variable}`}
    >
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
