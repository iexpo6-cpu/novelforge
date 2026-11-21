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
  Plus,
  Search,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  MessageSquarePlus,
  Wand2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ensureEditorHtml, stripHtml } from '@/lib/text-utils';
import type { Chapter, ChapterStatus } from '@/types/novel';

export type EditorTheme = 'light' | 'sepia' | 'dark';

interface ChapterEditorProps {
  projectId: string;
  chapter: Chapter | null;
  theme: EditorTheme;
  savingState: 'idle' | 'saving' | 'saved' | 'error';
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeStatus: (status: ChapterStatus) => void;
  onGenerateSummary: () => Promise<void>;
  onExportMarkdown: () => void;
  onAskAIWithSelection: (
    selectedText: string,
    quickMode?: 'chat' | 'polish' | 'feedback'
  ) => void;
}

const FONT_OPTIONS = [
  { label: '노토 명조 (소설 기본)', value: 'var(--font-serif), serif' },
  { label: '노토 고딕', value: 'var(--font-sans), sans-serif' },
  { label: '나눔 명조', value: 'var(--font-nanum-myeongjo), serif' },
  { label: '나눔 고딕', value: 'var(--font-nanum-gothic), sans-serif' },
  { label: '고운 바탕', value: 'var(--font-gowun-batang), serif' },
  { label: '고운 돋움', value: 'var(--font-gowun-dodum), sans-serif' },
  { label: '함렛 (세리프)', value: 'var(--font-hahmlet), serif' },
  { label: 'IBM Plex 산스', value: 'var(--font-ibm-plex), sans-serif' },
  { label: '나눔 손글씨 펜', value: 'var(--font-nanum-pen), cursive' },
  { label: '시스템 바탕체', value: 'Batang, Georgia, serif' },
  { label: '고정폭 (타자기)', value: 'ui-monospace, monospace' },
];

function buildSceneImageName(ext: string): string {
  return `scene-${Date.now()}.${ext}`;
}

export default function ChapterEditor({
  projectId,
  chapter,
  theme,
  savingState,
  onChangeTitle,
  onChangeContent,
  onChangeStatus,
  onGenerateSummary,
  onExportMarkdown,
  onAskAIWithSelection,
}: ChapterEditorProps) {
  const [summarizing, setSummarizing] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#292524');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // PPT-style image overlay & drag state
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  const [imageWidthPct, setImageWidthPct] = useState(80);
  const [overlayBox, setOverlayBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const draggedBlockRef = useRef<HTMLElement | null>(null);

  // Selected text for AI excerpt
  const [selectedText, setSelectedText] = useState('');

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastChapterIdRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string>('');

  function refreshOverlayBox() {
    const img = selectedImgRef.current;
    const surface = surfaceRef.current;
    if (!img || !surface || !surface.contains(img)) {
      setOverlayBox(null);
      return;
    }
    const imgRect = img.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    setOverlayBox({
      top: imgRect.top - surfaceRect.top + surface.scrollTop,
      left: imgRect.left - surfaceRect.left + surface.scrollLeft,
      width: imgRect.width,
      height: imgRect.height,
    });
  }

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

  function clampFontSize(val: number): number {
    if (Number.isNaN(val)) return 16;
    return Math.min(48, Math.max(10, val));
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target;
    if (target instanceof HTMLImageElement) {
      selectedImgRef.current = target;
      target.draggable = true;
      setHasSelectedImage(true);
      const rawWidth = target.style.width || '';
      if (rawWidth.endsWith('%')) {
        setImageWidthPct(parseInt(rawWidth, 10) || 80);
      } else if (editorRef.current) {
        const pct = Math.round(
          (target.getBoundingClientRect().width /
            editorRef.current.getBoundingClientRect().width) *
            100
        );
        setImageWidthPct(Math.min(100, Math.max(10, pct)));
      }
      refreshOverlayBox();
    } else {
      selectedImgRef.current = null;
      setHasSelectedImage(false);
      setOverlayBox(null);
    }
  }

  function startCornerResize(
    e: React.PointerEvent<HTMLDivElement>,
    direction: 'se' | 'sw' | 'ne' | 'nw'
  ) {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImgRef.current;
    const editor = editorRef.current;
    if (!img || !editor) return;

    const startX = e.clientX;
    const startWidthPx = img.getBoundingClientRect().width;
    const editorWidthPx = editor.getBoundingClientRect().width || 600;
    const sign = direction === 'se' || direction === 'ne' ? 1 : -1;

    function onMove(ev: PointerEvent) {
      const deltaX = (ev.clientX - startX) * sign;
      const nextPx = Math.max(60, Math.min(editorWidthPx, startWidthPx + deltaX));
      const pct = Math.round((nextPx / editorWidthPx) * 100);
      const clamped = Math.min(100, Math.max(10, pct));
      if (selectedImgRef.current) {
        selectedImgRef.current.style.width = `${clamped}%`;
        selectedImgRef.current.style.maxWidth = '100%';
        selectedImgRef.current.style.height = 'auto';
        setImageWidthPct(clamped);
        refreshOverlayBox();
      }
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      syncFromDom();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleEditorDragStart(e: React.DragEvent<HTMLDivElement>) {
    const target = e.target;
    const editor = editorRef.current;
    if (!(target instanceof HTMLImageElement) || !editor) return;

    const block: HTMLElement =
      target.parentElement && target.parentElement !== editor
        ? target.parentElement
        : target;
    draggedBlockRef.current = block;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'novelforge-image-move');
  }

  function handleEditorDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!draggedBlockRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleEditorDrop(e: React.DragEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const dragged = draggedBlockRef.current;
    if (!dragged || !editor) return;
    e.preventDefault();
    draggedBlockRef.current = null;

    let dropTarget = e.target as HTMLElement | null;
    while (dropTarget && dropTarget.parentElement !== editor) {
      dropTarget = dropTarget.parentElement;
    }

    if (dropTarget && dropTarget !== dragged && editor.contains(dropTarget)) {
      const rect = dropTarget.getBoundingClientRect();
      const insertAfter = e.clientY > rect.top + rect.height / 2;
      if (insertAfter) {
        editor.insertBefore(dragged, dropTarget.nextSibling);
      } else {
        editor.insertBefore(dragged, dropTarget);
      }
    } else {
      editor.appendChild(dragged);
    }

    syncFromDom();
    setTimeout(refreshOverlayBox, 0);
  }

  function updateSelectedImageWidth(pct: number) {
    const img = selectedImgRef.current;
    if (!img) return;
    const clamped = Math.min(100, Math.max(10, pct));
    setImageWidthPct(clamped);
    img.style.width = `${clamped}%`;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    syncFromDom();
    refreshOverlayBox();
  }

  function updateSelectedImageAlign(align: 'left' | 'center' | 'right') {
    const img = selectedImgRef.current;
    if (!img) return;
    img.style.display = 'block';
    if (align === 'left') {
      img.style.margin = '12px auto 12px 0';
    } else if (align === 'center') {
      img.style.margin = '12px auto';
    } else {
      img.style.margin = '12px 0 12px auto';
    }
    syncFromDom();
    refreshOverlayBox();
  }

  function deleteSelectedImage() {
    const img = selectedImgRef.current;
    if (!img) return;
    img.remove();
    selectedImgRef.current = null;
    setHasSelectedImage(false);
    setOverlayBox(null);
    syncFromDom();
  }

  function moveSelectedImage(direction: 'up' | 'down') {
    const img = selectedImgRef.current;
    const editor = editorRef.current;
    if (!img || !editor) return;

    const nodeToMove: HTMLElement =
      img.parentElement && img.parentElement !== editor
        ? img.parentElement
        : img;

    if (direction === 'up') {
      const prev = nodeToMove.previousElementSibling;
      if (prev) {
        editor.insertBefore(nodeToMove, prev);
        syncFromDom();
        setTimeout(refreshOverlayBox, 0);
      }
    } else {
      const next = nodeToMove.nextElementSibling;
      if (next) {
        editor.insertBefore(next, nodeToMove);
        syncFromDom();
        setTimeout(refreshOverlayBox, 0);
      }
    }
  }

  function handleSelectionCheck() {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedText('');
      return;
    }
    const anchor = sel.anchorNode;
    if (anchor && el.contains(anchor)) {
      const text = sel.toString().trim();
      setSelectedText(text.length >= 2 ? text : '');
    } else {
      setSelectedText('');
    }
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
      const storagePath = `${user.id}/${projectId}/${buildSceneImageName(ext)}`;

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
        `<p><img src="${urlData.publicUrl}" alt="삽화" draggable="true" style="width:75%;max-width:100%;height:auto;display:block;border-radius:12px;margin:12px auto;" /></p><p><br></p>`
      );
      syncFromDom();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : '이미지 업로드 중 오류가 발생했습니다.'
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

  const surfaceThemeClasses =
    theme === 'dark'
      ? 'bg-stone-900 text-stone-100'
      : theme === 'sepia'
        ? 'bg-[#f6eedc] text-[#3d3020]'
        : 'bg-stone-50 text-stone-800';

  const titleThemeClasses =
    theme === 'dark'
      ? 'text-white placeholder-stone-600'
      : theme === 'sepia'
        ? 'text-[#2b2115] placeholder-[#b9a78e]'
        : 'text-stone-900 placeholder-stone-300';

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

        {/* Font Family (11 fonts) */}
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="max-w-[160px] rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700 focus:border-amber-500 focus:outline-none"
          title="에디터 글꼴"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Free Font Size Input (10px ~ 48px) */}
        <div
          className="flex items-center rounded-md border border-stone-200 bg-stone-50"
          title="글자 크기 (10~48px 자유 입력)"
        >
          <button
            type="button"
            onClick={() => setFontSize((s) => clampFontSize(s - 1))}
            className="px-1.5 py-1 text-stone-600 hover:bg-stone-200"
            title="글자 작게"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            min={10}
            max={48}
            value={fontSize}
            onChange={(e) => setFontSize(clampFontSize(Number(e.target.value)))}
            className="w-10 bg-transparent text-center text-xs font-semibold text-stone-800 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setFontSize((s) => clampFontSize(s + 1))}
            className="px-1.5 py-1 text-stone-600 hover:bg-stone-200"
            title="글자 크게"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

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
          title="본문에 이미지 첨부 (클릭 후 모서리 드래그로 크기 조절, 이미지 드래그로 위치 이동)"
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

      {/* Selected Image Resize & Alignment Bar */}
      {hasSelectedImage && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs">
          <span className="font-semibold text-amber-900">
            이미지 {imageWidthPct}% (모서리 드래그로 크기 조절 · 본문 내 드래그로 위치 이동)
          </span>
          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => updateSelectedImageWidth(pct)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  imageWidthPct === pct
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-white text-stone-700 ring-1 ring-amber-200 hover:bg-amber-100'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateSelectedImageAlign('left')}
              className="rounded bg-white px-2 py-0.5 text-[11px] ring-1 ring-amber-200 hover:bg-amber-100"
            >
              좌
            </button>
            <button
              type="button"
              onClick={() => updateSelectedImageAlign('center')}
              className="rounded bg-white px-2 py-0.5 text-[11px] ring-1 ring-amber-200 hover:bg-amber-100"
            >
              중
            </button>
            <button
              type="button"
              onClick={() => updateSelectedImageAlign('right')}
              className="rounded bg-white px-2 py-0.5 text-[11px] ring-1 ring-amber-200 hover:bg-amber-100"
            >
              우
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => moveSelectedImage('up')}
              className="inline-flex items-center gap-0.5 rounded bg-white px-2 py-0.5 text-[11px] font-medium ring-1 ring-amber-200 hover:bg-amber-100"
            >
              <ArrowUp className="h-3 w-3" />
              위로
            </button>
            <button
              type="button"
              onClick={() => moveSelectedImage('down')}
              className="inline-flex items-center gap-0.5 rounded bg-white px-2 py-0.5 text-[11px] font-medium ring-1 ring-amber-200 hover:bg-amber-100"
            >
              <ArrowDown className="h-3 w-3" />
              아래로
            </button>
          </div>
          <button
            type="button"
            onClick={deleteSelectedImage}
            className="ml-auto inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
          >
            <Trash2 className="h-3 w-3" />
            삭제
          </button>
        </div>
      )}

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

      {/* Writing Surface with PPT-style Image Resize Overlay */}
      <div
        ref={surfaceRef}
        onScroll={hasSelectedImage ? refreshOverlayBox : undefined}
        className={`relative flex-1 overflow-y-auto px-6 py-8 transition-colors sm:px-12 ${surfaceThemeClasses}`}
      >
        <div className="mx-auto max-w-3xl">
          <input
            type="text"
            value={chapter.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="회차 제목을 입력하세요..."
            className={`w-full border-none bg-transparent font-serif text-2xl font-bold focus:outline-none ${titleThemeClasses}`}
          />

          {chapter.summary && (
            <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-900">
              <span className="mr-1.5 font-semibold">[회차 요약]</span>
              {chapter.summary}
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromDom}
            onClick={handleEditorClick}
            onDragStart={handleEditorDragStart}
            onDragOver={handleEditorDragOver}
            onDrop={handleEditorDrop}
            onMouseUp={handleSelectionCheck}
            onKeyUp={handleSelectionCheck}
            data-placeholder="이곳에서 소설의 이야기를 펼쳐보세요..."
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: 1.9,
            }}
            className="mt-6 min-h-[65vh] w-full focus:outline-none empty:before:text-stone-400 empty:before:content-[attr(data-placeholder)]"
          />
        </div>

        {/* PPT-style 4-corner Resize Handles Overlay */}
        {hasSelectedImage && overlayBox && (
          <div
            style={{
              top: overlayBox.top,
              left: overlayBox.left,
              width: overlayBox.width,
              height: overlayBox.height,
            }}
            className="pointer-events-none absolute rounded-xl ring-2 ring-amber-500"
          >
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-stone-900 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {imageWidthPct}%
            </span>
            {(
              [
                {
                  dir: 'nw',
                  cls: '-top-1.5 -left-1.5 cursor-nwse-resize',
                },
                {
                  dir: 'ne',
                  cls: '-top-1.5 -right-1.5 cursor-nesw-resize',
                },
                {
                  dir: 'sw',
                  cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                },
                {
                  dir: 'se',
                  cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                },
              ] as const
            ).map((handle) => (
              <div
                key={handle.dir}
                onPointerDown={(e) => startCornerResize(e, handle.dir)}
                className={`pointer-events-auto absolute h-3.5 w-3.5 rounded-full border-2 border-amber-600 bg-white shadow ${handle.cls}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection AI Action Bar */}
      {selectedText && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-stone-950">
              선택됨
            </span>
            <span className="truncate text-stone-700">
              &ldquo;{selectedText}&rdquo;
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onAskAIWithSelection(selectedText, 'chat');
                setSelectedText('');
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-stone-800"
            >
              <MessageSquarePlus className="h-3 w-3" />
              AI 질문
            </button>
            <button
              type="button"
              onClick={() => {
                onAskAIWithSelection(selectedText, 'polish');
                setSelectedText('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              <Wand2 className="h-3 w-3" />
              이 부분 윤문
            </button>
            <button
              type="button"
              onClick={() => {
                onAskAIWithSelection(selectedText, 'feedback');
                setSelectedText('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
            >
              <Sparkles className="h-3 w-3" />
              피드백
            </button>
            <button
              type="button"
              onClick={() => setSelectedText('')}
              className="rounded p-1 text-stone-400 hover:text-stone-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Stats Bar */}
      <div className="flex items-center justify-between border-t border-stone-200 bg-white px-6 py-2 text-[11px] text-stone-500">
        <div className="flex items-center gap-4">
          <span>공백 포함 {totalChars.toLocaleString()}자</span>
          <span>공백 제외 {charsNoSpace.toLocaleString()}자</span>
          <span>200자 원고지 약 {manuscriptPages.toLocaleString()}매</span>
        </div>
        <span>이미지 모서리 드래그 크기조절 · 드래그 위치이동</span>
      </div>
    </main>
  );
}
