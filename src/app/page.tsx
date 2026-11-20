import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  Users,
  Globe,
  Image as ImageIcon,
  PenTool,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/30">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">NovelForge</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-300 transition hover:text-white"
          >
            로그인
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
          >
            스튜디오 시작하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Google Gemini 기반 AI 소설 창작 스튜디오
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            아이디어에서 한 권의 소설까지,
            <br />
            <span className="text-amber-400">당신만의 AI 공동 집필 파트너</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-stone-300 sm:text-lg">
            등장인물과 세계관 설정집을 기반으로 설정 충돌 없는 피드백을 받고,
            막히는 전개는 AI와 함께 돌파하며, 캐릭터 초상화와 표지 일러스트까지
            한 곳에서 완성하세요.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
            >
              내 소설 프로젝트 만들기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900/60 px-6 py-3.5 text-base font-medium text-stone-200 transition hover:border-stone-500 hover:bg-stone-800"
            >
              계정으로 로그인
            </Link>
          </div>
        </div>

        <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: PenTool,
              title: '3단 소설 스튜디오',
              desc: '회차·설정집 탐색, 집중 집필 에디터, AI 조수 패널을 한 화면에 배치해 흐름이 끊기지 않습니다.',
            },
            {
              icon: Users,
              title: '인물·세계관·플롯 관리',
              desc: '등장인물, 세계관, 기승전결 줄거리를 체계적으로 정리하고 AI가 이를 자동으로 기억합니다.',
            },
            {
              icon: Globe,
              title: '설정 연동 피드백 & 윤문',
              desc: '개연성 검토, 문장 다듬기, 다음 문단 이어쓰기, 회차 요약을 원클릭으로 실행합니다.',
            },
            {
              icon: ImageIcon,
              title: 'AI 표지·캐릭터 삽화',
              desc: '작성한 인물/세계관 설정으로 이미지 프롬프트를 자동 생성하고 고품질 삽화를 저장합니다.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6 transition hover:border-amber-500/40"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-white">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-400">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
