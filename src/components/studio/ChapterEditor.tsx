'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Download,
  Check,
  Loader2,
  FileText,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Minus,
  Search,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ensureEditorHtml, stripHtml } from '@/lib/text-utils';
import type { Chapter, ChapterStatus } from '@/types/novel';

interface ChapterEditorProps {
  projectId: string;
  chapter: Chapter | null;
  savingState: 'idle' | 'saving' | 'saved' | 'error';
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeStatus: (status: ChapterStatus) => void;
  onGenerateSummary: () => Promise<void>;
  onExportMarkdown: () => void;
}

const FONT_OPTIONS = [
  { label: '노토 명조 (소설 기본)', value: 'var(--font-serif), serif' },
  { label: '노토 고딕', value: 'var(--font-sans), sans-serif' },
  { label: '바탕체', value: 'Batang, Georgia, serif' },
  { label: '돋움체', value: 'Dotum, Arial, sans-serif' },
  { label: '고정폭 (타자기)', value: 'ui-monospace, monospace' },
];

const FONT_SIZES = [14, 15, 16, 18, 20, 22, 24];

export default function ChapterEditor({
  projectId,
  chapter,
  savingState,
  onChangeTitle,
  onChangeContent,
  onChangeStatus,
  onGenerateSummary,
  onExportMarkdown,
}: ChapterEditorProps) {
  const [summarizing, setSummarizing] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#292524');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastChapterIdRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string>('');

  // Sync contentEditable DOM when switching chapters or when external AI insertion changes content
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !chapter) return;

    const targetHtml = ensureEditorHtml(chapter.content);
    if (
      chapter.id !== lastChapterIdRef.current ||
      targetHtml !== lastHtmlRef.current
    ) {
      if (el.innerHTML !== targetHtml) {
        el.innerHTML = targetHtml;
      }
      lastChapterIdRef.current = chapter.id;
      lastHtmlRef.current = targetHtml;
    }
  }, [chapter]);

  if (!chapter) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-stone-50 text-stone-400">
        <FileText className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">
          좌측 목록에서 회차를 선택하거나 새로 만들어 주세요.
        </p>
      </main>
    );
  }

  const plainText = stripHtml(chapter.content);
  const totalChars = plainText.length;
  const charsNoSpace = plainText.replace(/\s+/g, '').length;
  const manuscriptPages = Math.max(1, Math.round(totalChars / 200));

  function syncFromDom() {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastHtmlRef.current = html;
    onChangeContent(html);
  }

  function execFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromDom();
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chapter) return;
    setUploadingImage(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `${user.id}/${projectId}/scene-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('novel-images')
        .upload(storagePath, file, {
          contentType: file.type || 'image/png',
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('novel-images')
        .getPublicUrl(storagePath);

      editorRef.current?.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<p><img src="${urlData.publicUrl}" alt="삽화" style="max-width:100%;border-radius:12px;margin:12px 0;" /></p><p><br></p>`
      );
      syncFromDom();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : '이미지 업로드 중 오류가 발생했습니다.'
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleReplaceAll() {
    if (!findQuery || !editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const updated = currentHtml.split(findQuery).join(replaceQuery);
    editorRef.current.innerHTML = updated;
    syncFromDom();
  }

  async function handleSummarizeClick() {
    if (!plainText.trim()) return;
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-6 py-2.5">
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
            disabled={summarizing || !plainText.trim()}
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

      {/* Novella-style Rich Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-white px-4 py-1.5 text-stone-600">
        <button
          type="button"
          onClick={() => execFormat('undo')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="되돌리기"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('redo')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="다시 실행"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-stone-200" />

        {/* Font Family */}
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700 focus:border-amber-500 focus:outline-none"
          title="에디터 글꼴"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Font Size */}
        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700 focus:border-amber-500 focus:outline-none"
          title="글자 크기"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>

        <div className="mx-1 h-4 w-px bg-stone-200" />

        {/* Text Styles */}
        <button
          type="button"
          onClick={() => execFormat('bold')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="굵게"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('italic')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="기울임"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('underline')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="밑줄"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('strikeThrough')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="취소선"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        {/* Text Color */}
        <label
          className="flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-1 hover:bg-stone-100"
          title="글자 색상"
        >
          <span className="text-xs font-bold" style={{ color: textColor }}>
            A
          </span>
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              execFormat('foreColor', e.target.value);
            }}
            className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <div className="mx-1 h-4 w-px bg-stone-200" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => execFormat('justifyLeft')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="왼쪽 정렬"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('justifyCenter')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="가운데 정렬"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('justifyRight')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="오른쪽 정렬"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execFormat('justifyFull')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="양쪽 정렬"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-stone-200" />

        {/* Insert Image & Divider & Find */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadImage}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploadingImage}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-stone-100 disabled:opacity-50"
          title="본문에 이미지 첨부"
        >
          {uploadingImage ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">이미지</span>
        </button>

        <button
          type="button"
          onClick={() => execFormat('insertHorizontalRule')}
          className="rounded p-1.5 hover:bg-stone-100"
          title="장면 구분선 삽입"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setShowFindBar((v) => !v)}
          className={`rounded p-1.5 hover:bg-stone-100 ${
            showFindBar ? 'bg-amber-100 text-amber-800' : ''
          }`}
          title="본문 내 찾기/바꾸기"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Find & Replace Bar */}
      {showFindBar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-amber-50/50 px-6 py-2 text-xs">
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="찾을 단어..."
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1 focus:outline-none"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="바꿀 단어..."
            className="rounded-md border border-stone-300 bg-white px-2.5 py-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleReplaceAll}
            className="rounded-md bg-stone-900 px-3 py-1 font-semibold text-white hover:bg-stone-800"
          >
            모두 바꾸기
          </button>
          <button
            type="button"
            onClick={() => setShowFindBar(false)}
            className="ml-auto rounded p-1 text-stone-400 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromDom}
            data-placeholder="이곳에서 소설의 이야기를 펼쳐보세요..."
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: 1.9,
            }}
            className="mt-6 min-h-[65vh] w-full text-stone-800 focus:outline-none empty:before:text-stone-300 empty:before:content-[attr(data-placeholder)]"
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
        <span>리치 에디터 · Markdown 내보내기 지원</span>
      </div>
    </main>
  );
}
