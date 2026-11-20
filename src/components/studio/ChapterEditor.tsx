'use client';

import { useState } from 'react';
import {
  Sparkles,
  Download,
  Check,
  Loader2,
  FileText,
} from 'lucide-react';
import type { Chapter, ChapterStatus } from '@/types/novel';

interface ChapterEditorProps {
  chapter: Chapter | null;
  savingState: 'idle' | 'saving' | 'saved' | 'error';
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeStatus: (status: ChapterStatus) => void;
  onGenerateSummary: () => Promise<void>;
  onExportMarkdown: () => void;
}

export default function ChapterEditor({
  chapter,
  savingState,
  onChangeTitle,
  onChangeContent,
  onChangeStatus,
  onGenerateSummary,
  onExportMarkdown,
}: ChapterEditorProps) {
  const [summarizing, setSummarizing] = useState(false);

  if (!chapter) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-stone-50 text-stone-400">
        <FileText className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">좌측 목록에서 회차를 선택하거나 새로 만들어 주세요.</p>
      </main>
    );
  }

  const totalChars = chapter.content.length;
  const charsNoSpace = chapter.content.replace(/\s+/g, '').length;
  const manuscriptPages = Math.max(1, Math.round(totalChars / 200));

  async function handleSummarizeClick() {
    if (!chapter?.content.trim()) return;
    setSummarizing(true);
    try {
      await onGenerateSummary();
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <main className="flex h-full flex-col bg-stone-50">
      {/* Editor Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <select
            value={chapter.status}
            onChange={(e) => onChangeStatus(e.target.value as ChapterStatus)}
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 focus:border-amber-500 focus:outline-none"
          >
            <option value="draft">초안</option>
            <option value="writing">집필 중</option>
            <option value="completed">탈고</option>
          </select>

          <span className="flex items-center gap-1 text-xs text-stone-400">
            {savingState === 'saving' && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                저장 중...
              </>
            )}
            {savingState === 'saved' && (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                자동 저장됨
              </>
            )}
            {savingState === 'error' && (
              <span className="text-red-500">저장 오류</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={summarizing || !chapter.content.trim()}
            onClick={handleSummarizeClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            title="AI가 현재 회차를 요약하여 다음 회차 집필 시 참고합니다"
          >
            {summarizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI 회차 요약
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
          >
            <Download className="h-3.5 w-3.5" />
            내보내기 (.md)
          </button>
        </div>
      </div>

      {/* Writing Surface */}
      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <input
            type="text"
            value={chapter.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="회차 제목을 입력하세요..."
            className="w-full border-none bg-transparent font-serif text-2xl font-bold text-stone-900 placeholder-stone-300 focus:outline-none"
          />

          {chapter.summary && (
            <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              <span className="mr-1.5 font-semibold">[회차 요약]</span>
              {chapter.summary}
            </div>
          )}

          <textarea
            value={chapter.content}
            onChange={(e) => onChangeContent(e.target.value)}
            placeholder="이곳에서 소설의 이야기를 펼쳐보세요...&#10;&#10;우측 AI 조수 패널에서 전개 피드백, 문장 윤문, 다음 문단 이어쓰기, 캐릭터·표지 이미지 생성을 바로 요청할 수 있습니다."
            className="mt-6 min-h-[65vh] w-full resize-none border-none bg-transparent font-serif text-base leading-8 text-stone-800 placeholder-stone-300 focus:outline-none"
          />
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <div className="flex items-center justify-between border-t border-stone-200 bg-white px-6 py-2 text-[11px] text-stone-500">
        <div className="flex items-center gap-4">
          <span>공백 포함 {totalChars.toLocaleString()}자</span>
          <span>공백 제외 {charsNoSpace.toLocaleString()}자</span>
          <span>200자 원고지 약 {manuscriptPages.toLocaleString()}매</span>
        </div>
        <span>UTF-8 · Markdown 호환</span>
      </div>
    </main>
  );
}
