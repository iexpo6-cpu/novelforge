'use client';

import { useState, useSyncExternalStore } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  Wand2,
  MessageSquareText,
  ArrowRightCircle,
  Lightbulb,
  Image as ImageIcon,
  Loader2,
  PlusCircle,
  X,
  Bookmark,
  CheckCircle2,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { buildAIHeaders } from '@/lib/ai/client-key';
import type {
  AIActionType,
  AIChatMessage,
  Chapter,
  Character,
  ImageTargetType,
  ProjectImage,
  WorldSetting,
} from '@/types/novel';

interface RightAIPanelProps {
  projectId: string;
  activeChapter: Chapter | null;
  chapters: Chapter[];
  characters: Character[];
  worldSettings: WorldSetting[];
  messages: AIChatMessage[];
  onMessagesChange: (updater: (prev: AIChatMessage[]) => AIChatMessage[]) => void;
  onInsertToEditor: (text: string) => void;
  onImageGenerated: (
    image: ProjectImage,
    targetType: ImageTargetType,
    targetId?: string | null
  ) => void;
  rightTab: 'assistant' | 'image' | 'tracker';
  onChangeRightTab: (tab: 'assistant' | 'image' | 'tracker') => void;
  targetType: ImageTargetType;
  onChangeTargetType: (type: ImageTargetType) => void;
  targetId: string;
  onChangeTargetId: (id: string) => void;
  selectedExcerpt: string;
  onClearExcerpt: () => void;
}

interface ForeshadowingItem {
  id: string;
  title: string;
  plantedChapter: string;
  resolvedChapter: string;
  status: 'open' | 'resolved';
}

const EMPTY_FORESHADOWING: ForeshadowingItem[] = [];
const fsListeners = new Set<() => void>();
let cachedFsKey = '';
let cachedFsRaw: string | null = null;
let cachedFsParsed: ForeshadowingItem[] = EMPTY_FORESHADOWING;

function getForeshadowingSnapshot(key: string): ForeshadowingItem[] {
  if (typeof window === 'undefined') return EMPTY_FORESHADOWING;
  const raw = window.localStorage.getItem(key);
  if (key === cachedFsKey && raw === cachedFsRaw) return cachedFsParsed;
  cachedFsKey = key;
  cachedFsRaw = raw;
  if (!raw) {
    cachedFsParsed = EMPTY_FORESHADOWING;
    return cachedFsParsed;
  }
  try {
    const parsed = JSON.parse(raw);
    cachedFsParsed = Array.isArray(parsed) ? parsed : EMPTY_FORESHADOWING;
  } catch {
    cachedFsParsed = EMPTY_FORESHADOWING;
  }
  return cachedFsParsed;
}

function subscribeForeshadowing(cb: () => void) {
  fsListeners.add(cb);
  return () => {
    fsListeners.delete(cb);
  };
}

function writeForeshadowing(key: string, items: ForeshadowingItem[]) {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify(items);
  window.localStorage.setItem(key, raw);
  cachedFsKey = key;
  cachedFsRaw = raw;
  cachedFsParsed = items;
  fsListeners.forEach((cb) => cb());
}

const STYLE_PRESETS = [
  {
    label: '시네마틱 판타지 일러스트',
    value: 'cinematic fantasy book cover illustration, dramatic lighting, rich detail',
  },
  {
    label: '웹소설/애니메이션풍',
    value: 'high quality anime webnovel illustration, vibrant colors, expressive eyes',
  },
  {
    label: '수채화/동화풍',
    value: 'delicate watercolor painting, dreamy atmosphere, soft pastel tones',
  },
  {
    label: '다크/느와르 컨셉아트',
    value: 'dark moody concept art, chiaroscuro lighting, gritty realism',
  },
];

export default function RightAIPanel({
  projectId,
  activeChapter,
  chapters,
  characters,
  worldSettings,
  messages,
  onMessagesChange,
  onInsertToEditor,
  onImageGenerated,
  rightTab,
  onChangeRightTab,
  targetType,
  onChangeTargetType,
  targetId,
  onChangeTargetId,
  selectedExcerpt,
  onClearExcerpt,
}: RightAIPanelProps) {
  // AI Assistant state
  const [promptInput, setPromptInput] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [includeCharacters, setIncludeCharacters] = useState(true);
  const [includeWorld, setIncludeWorld] = useState(true);
  const [includePlot, setIncludePlot] = useState(true);
  const [includePrevSummaries, setIncludePrevSummaries] = useState(true);

  // Image Generation state
  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0].value);
  const [imagePrompt, setImagePrompt] = useState('');
  const [customImageContext, setCustomImageContext] = useState('');
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);

  // Foreshadowing & Voice Checker state
  const fsStorageKey = `novelforge_foreshadowing_${projectId}`;
  const foreshadowings = useSyncExternalStore(
    subscribeForeshadowing,
    () => getForeshadowingSnapshot(fsStorageKey),
    () => EMPTY_FORESHADOWING
  );
  const [fsTitle, setFsTitle] = useState('');
  const [fsPlanted, setFsPlanted] = useState('');
  const [checkerReport, setCheckerReport] = useState<string | null>(null);
  const [runningChecker, setRunningChecker] = useState(false);

  async function runDedicatedCheck(prompt: string) {
    setRunningChecker(true);
    setCheckerReport(null);
    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: buildAIHeaders(),
        body: JSON.stringify({
          projectId,
          chapterId: activeChapter?.id ?? null,
          actionType: 'feedback',
          prompt,
          currentContentOverride: activeChapter?.content,
          includeCharacters: true,
          includeWorld: true,
          includePlot: true,
          includePreviousSummaries: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setCheckerReport(data.reply);
    } catch (err) {
      setCheckerReport(
        err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.'
      );
    } finally {
      setRunningChecker(false);
    }
  }

  async function runAssistant(actionType: AIActionType, customPrompt?: string) {
    const rawPrompt = (customPrompt ?? promptInput).trim();
    if (!rawPrompt || loadingAI) return;

    const finalPrompt = selectedExcerpt.trim()
      ? `[선택한 원고 발췌]\n"""\n${selectedExcerpt.trim()}\n"""\n\n[요청]\n${rawPrompt}`
      : rawPrompt;

    setLoadingAI(true);
    setAiError(null);

    const optimisticUserMsg: AIChatMessage = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      chapter_id: activeChapter?.id ?? null,
      role: 'user',
      content: finalPrompt,
      action_type: actionType,
      created_at: new Date().toISOString(),
    };

    onMessagesChange((prev) => [...prev, optimisticUserMsg]);
    if (!customPrompt) setPromptInput('');
    if (selectedExcerpt.trim()) onClearExcerpt();

    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: buildAIHeaders(),
        body: JSON.stringify({
          projectId,
          chapterId: activeChapter?.id ?? null,
          actionType,
          prompt: finalPrompt,
          currentContentOverride: activeChapter?.content,
          includeCharacters,
          includeWorld,
          includePlot,
          includePreviousSummaries: includePrevSummaries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI 요청 처리에 실패했습니다.');
      }

      const assistantMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        project_id: projectId,
        chapter_id: activeChapter?.id ?? null,
        role: 'assistant',
        content: data.reply,
        action_type: actionType,
        created_at: new Date().toISOString(),
      };
      onMessagesChange((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleSuggestImagePrompt() {
    setSuggestingPrompt(true);
    setImageError(null);
    try {
      const effectiveTargetId =
        targetType === 'scene' ? activeChapter?.id : targetId || undefined;
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: buildAIHeaders(),
        body: JSON.stringify({
          mode: 'suggest_prompt',
          projectId,
          targetType,
          targetId: effectiveTargetId,
          stylePreset,
          customContext: customImageContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프롬프트 제안 실패');
      setImagePrompt(data.suggestedPrompt || '');
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '프롬프트 제안 실패');
    } finally {
      setSuggestingPrompt(false);
    }
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) return;
    setGeneratingImage(true);
    setImageError(null);
    try {
      const effectiveTargetId =
        targetType === 'scene' ? activeChapter?.id : targetId || undefined;
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: buildAIHeaders(),
        body: JSON.stringify({
          mode: 'generate',
          projectId,
          targetType,
          targetId: effectiveTargetId,
          prompt: imagePrompt.trim(),
          applyToTarget: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '이미지 생성 실패');
      setLastGeneratedUrl(data.image.image_url);
      onImageGenerated(data.image, targetType, effectiveTargetId);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '이미지 생성 실패');
    } finally {
      setGeneratingImage(false);
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-stone-200 bg-white">
      {/* Top Mode Switcher */}
      <div className="grid grid-cols-3 border-b border-stone-200 bg-stone-50/70 p-1">
        <button
          type="button"
          onClick={() => onChangeRightTab('assistant')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition ${
            rightTab === 'assistant'
              ? 'bg-white text-amber-700 shadow-xs ring-1 ring-stone-200'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI 조수
        </button>
        <button
          type="button"
          onClick={() => onChangeRightTab('image')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition ${
            rightTab === 'image'
              ? 'bg-white text-amber-700 shadow-xs ring-1 ring-stone-200'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          삽화·표지
        </button>
        <button
          type="button"
          onClick={() => onChangeRightTab('tracker')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition ${
            rightTab === 'tracker'
              ? 'bg-white text-amber-700 shadow-xs ring-1 ring-stone-200'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          복선·체커
        </button>
      </div>

      {rightTab === 'assistant' && (
        <>
          {/* Context Toggles & Quick Actions */}
          <div className="space-y-2.5 border-b border-stone-100 bg-stone-50/40 p-3">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                {
                  label: `인물(${characters.length})`,
                  checked: includeCharacters,
                  toggle: () => setIncludeCharacters((v) => !v),
                },
                {
                  label: `세계관(${worldSettings.length})`,
                  checked: includeWorld,
                  toggle: () => setIncludeWorld((v) => !v),
                },
                {
                  label: '줄거리',
                  checked: includePlot,
                  toggle: () => setIncludePlot((v) => !v),
                },
                {
                  label: '이전 요약',
                  checked: includePrevSummaries,
                  toggle: () => setIncludePrevSummaries((v) => !v),
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.toggle}
                  className={`rounded-full px-2 py-0.5 font-medium transition ${
                    chip.checked
                      ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                      : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {chip.checked ? '✓ ' : ''}
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={loadingAI}
                onClick={() =>
                  runAssistant(
                    'feedback',
                    '현재 회차의 전개, 개연성, 설정 일치 여부, 감정선을 구체적으로 피드백해 주세요.'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50"
              >
                <MessageSquareText className="h-3.5 w-3.5 text-amber-600" />
                피드백·개연성
              </button>
              <button
                type="button"
                disabled={loadingAI}
                onClick={() =>
                  runAssistant(
                    'polish',
                    '현재 회차의 마지막 부분이나 어색한 문장을 더 생동감 있고 매끄럽게 윤문해 주세요.'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5 text-amber-600" />
                문장 윤문
              </button>
              <button
                type="button"
                disabled={loadingAI}
                onClick={() =>
                  runAssistant(
                    'continue',
                    '현재 원고의 흐름과 문체를 유지하면서 다음 2~3문단을 자연스럽게 이어 써 주세요.'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50"
              >
                <ArrowRightCircle className="h-3.5 w-3.5 text-amber-600" />
                다음 이어쓰기
              </button>
              <button
                type="button"
                disabled={loadingAI}
                onClick={() =>
                  runAssistant(
                    'brainstorm',
                    '현재 설정과 흐름을 바탕으로 다음에 일어날 수 있는 흥미로운 사건이나 갈등 아이디어를 3가지 제안해 주세요.'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:border-amber-400 hover:text-amber-800 disabled:opacity-50"
              >
                <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                전개 아이디어
              </button>
            </div>
          </div>

          {/* Chat Feed */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-xs leading-relaxed text-stone-400">
                위 퀵 액션을 누르거나 아래에 질문을 입력하면
                <br />
                등장인물·세계관·줄거리를 반영해 답변합니다.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-6 bg-stone-900 text-stone-100'
                      : 'mr-2 border border-stone-200 bg-stone-50 text-stone-800'
                  }`}
                >
                  <div className="prose prose-xs prose-stone max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.role === 'assistant' && activeChapter && (
                    <div className="mt-2 flex justify-end border-t border-stone-200/70 pt-1.5">
                      <button
                        type="button"
                        onClick={() => onInsertToEditor(m.content)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900"
                      >
                        <PlusCircle className="h-3 w-3" />
                        에디터 끝에 삽입
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {loadingAI && (
              <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                설정집과 원고를 읽고 답변을 작성 중입니다...
              </div>
            )}
            {aiError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">
                {aiError}
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAssistant('chat');
            }}
            className="border-t border-stone-200 bg-white p-3"
          >
            {selectedExcerpt && (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-bold text-amber-800">
                    선택한 원고 발췌 (이 부분에 대해 질문)
                  </span>
                  <button
                    type="button"
                    onClick={onClearExcerpt}
                    className="rounded p-0.5 text-amber-700 hover:bg-amber-200/60"
                    title="발췌 취소"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="line-clamp-3 whitespace-pre-line text-stone-700">
                  {selectedExcerpt}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    runAssistant('chat');
                  }
                }}
                placeholder="AI에게 질문, 피드백, 설정 아이디어를 요청하세요... (Shift+Enter 줄바꿈)"
                className="flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loadingAI || !promptInput.trim()}
                className="flex items-center justify-center rounded-xl bg-amber-500 px-3 text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </>
      )}

      {rightTab === 'image' && (
        /* AI Image Generation Tab */
        <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-stone-700">
              생성 대상
            </label>
            <select
              value={targetType}
              onChange={(e) => {
                onChangeTargetType(e.target.value as ImageTargetType);
                onChangeTargetId('');
              }}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
            >
              <option value="cover">소설 표지</option>
              <option value="character">등장인물 초상화</option>
              <option value="world">세계관·배경 컨셉아트</option>
              <option value="scene">현재 회차 장면 삽화</option>
            </select>
          </div>

          {targetType === 'character' && (
            <div>
              <label className="mb-1 block font-semibold text-stone-700">
                대상 등장인물
              </label>
              <select
                value={targetId}
                onChange={(e) => onChangeTargetId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
              >
                <option value="">선택하세요</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'world' && (
            <div>
              <label className="mb-1 block font-semibold text-stone-700">
                대상 세계관 설정
              </label>
              <select
                value={targetId}
                onChange={(e) => onChangeTargetId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
              >
                <option value="">선택하세요</option>
                {worldSettings.map((w) => (
                  <option key={w.id} value={w.id}>
                    [{w.category}] {w.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-stone-700">
              화풍 프리셋
            </label>
            <select
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
            >
              {STYLE_PRESETS.map((s) => (
                <option key={s.label} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-stone-700">
              추가 묘사 (선택)
            </label>
            <input
              type="text"
              value={customImageContext}
              onChange={(e) => setCustomImageContext(e.target.value)}
              placeholder="예: 비 오는 밤, 붉은 망토, 긴장감 있는 구도"
              className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5"
            />
          </div>

          <button
            type="button"
            disabled={suggestingPrompt}
            onClick={handleSuggestImagePrompt}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {suggestingPrompt ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            설정집 기반 프롬프트 자동 작성
          </button>

          <div>
            <label className="mb-1 block font-semibold text-stone-700">
              이미지 생성 프롬프트 (영문 권장)
            </label>
            <textarea
              rows={4}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="프롬프트를 직접 입력하거나 위 버튼으로 자동 작성하세요."
              className="w-full rounded-lg border border-stone-300 px-2.5 py-2 leading-relaxed"
            />
          </div>

          <button
            type="button"
            disabled={generatingImage || !imagePrompt.trim()}
            onClick={handleGenerateImage}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-2.5 font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {generatingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {generatingImage ? '이미지 생성 중...' : 'AI 이미지 생성 & 저장'}
          </button>

          {imageError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-red-600">
              {imageError}
            </div>
          )}

          {lastGeneratedUrl && (
            <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
              <p className="font-semibold text-emerald-800">
                이미지가 생성되어 프로젝트에 연결되었습니다!
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastGeneratedUrl}
                alt="Generated illustration"
                className="w-full rounded-lg object-cover shadow-xs"
              />
            </div>
          )}
        </div>
      )}

      {rightTab === 'tracker' && (
        <div className="flex-1 space-y-4 overflow-y-auto p-3 text-xs">
          {/* Character Voice Consistency Checker */}
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="flex items-center gap-1.5 font-bold text-stone-900">
              <UserCheck className="h-4 w-4 text-amber-600" />
              캐릭터 대사·말투 일관성 체커
            </div>
            <p className="text-[11px] leading-relaxed text-stone-500">
              현재 회차의 대사와 행동을 인물 설정집(말투·성격·가치관)과 대조해
              어긋나는 부분이 있는지 검사합니다.
            </p>
            <button
              type="button"
              disabled={runningChecker || !activeChapter}
              onClick={() =>
                runDedicatedCheck(
                  '현재 회차 원고에 등장하는 각 캐릭터의 대사, 어미, 말투, 행동이 인물 설정집(성격, 말투, 가치관, 커스텀 세부설정)과 일관되는지 캐릭터별로 점검하고, 어색한 대사가 있다면 설정에 맞는 수정 대안을 제시해 주세요.'
                )
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-stone-900 py-2 font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {runningChecker ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              현재 회차 말투 일관성 검사
            </button>
          </div>

          {/* Foreshadowing Tracker */}
          <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-stone-900">
                <Bookmark className="h-4 w-4 text-amber-600" />
                떡밥 · 복선 트래커 ({foreshadowings.filter((f) => f.status === 'open').length}개 미회수)
              </span>
              <button
                type="button"
                disabled={runningChecker || foreshadowings.length === 0}
                onClick={() => {
                  const openList = foreshadowings
                    .filter((f) => f.status === 'open')
                    .map((f) => `- [${f.plantedChapter || '미지정'}] ${f.title}`)
                    .join('\n');
                  runDedicatedCheck(
                    `다음은 아직 회수되지 않은 복선 목록입니다:\n${openList || '(없음)'}\n\n현재 회차 원고를 참고해, 지금 시점에서 이어가거나 회수하기 좋은 복선과 자연스러운 연출 아이디어를 제안해 주세요.`
                  );
                }}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
              >
                <Sparkles className="h-3 w-3" />
                AI 점검
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!fsTitle.trim()) return;
                const next: ForeshadowingItem = {
                  id: `fs-${Date.now()}`,
                  title: fsTitle.trim(),
                  plantedChapter:
                    fsPlanted || activeChapter?.title || '1화',
                  resolvedChapter: '',
                  status: 'open',
                };
                writeForeshadowing(fsStorageKey, [next, ...foreshadowings]);
                setFsTitle('');
              }}
              className="space-y-1.5"
            >
              <input
                type="text"
                value={fsTitle}
                onChange={(e) => setFsTitle(e.target.value)}
                placeholder="복선/떡밥 내용 (예: 주인공 목걸이의 붉은 문양)"
                className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <select
                  value={fsPlanted}
                  onChange={(e) => setFsPlanted(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px]"
                >
                  <option value="">
                    심은 회차: {activeChapter?.title || '현재 회차'}
                  </option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-3 py-1 text-[11px] font-semibold text-stone-950 hover:bg-amber-400"
                >
                  + 등록
                </button>
              </div>
            </form>

            <div className="space-y-1.5 pt-1">
              {foreshadowings.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-stone-400">
                  등록된 복선이 없습니다. 위에서 복선을 추가해보세요.
                </p>
              ) : (
                foreshadowings.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start justify-between gap-2 rounded-lg border p-2 ${
                      item.status === 'resolved'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-stone-200 bg-stone-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const updated = foreshadowings.map((f) =>
                          f.id === item.id
                            ? {
                                ...f,
                                status: (f.status === 'open'
                                  ? 'resolved'
                                  : 'open') as 'open' | 'resolved',
                                resolvedChapter:
                                  f.status === 'open'
                                    ? activeChapter?.title || '회수됨'
                                    : '',
                              }
                            : f
                        );
                        writeForeshadowing(fsStorageKey, updated);
                      }}
                      className="mt-0.5 shrink-0"
                      title="상태 전환 (미회수 ↔ 회수완료)"
                    >
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          item.status === 'resolved'
                            ? 'text-emerald-600'
                            : 'text-stone-300 hover:text-amber-500'
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium ${
                          item.status === 'resolved'
                            ? 'text-stone-400 line-through'
                            : 'text-stone-800'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-stone-500">
                        심음: {item.plantedChapter}
                        {item.resolvedChapter
                          ? ` · 회수: ${item.resolvedChapter}`
                          : ' · 미회수'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        writeForeshadowing(
                          fsStorageKey,
                          foreshadowings.filter((f) => f.id !== item.id)
                        )
                      }
                      className="rounded p-1 text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dedicated Report Result */}
          {(runningChecker || checkerReport) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
              <div className="mb-1.5 flex items-center justify-between font-bold text-amber-900">
                <span>AI 분석 리포트</span>
                {checkerReport && (
                  <button
                    type="button"
                    onClick={() => setCheckerReport(null)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {runningChecker ? (
                <div className="flex items-center gap-2 py-4 text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  원고와 설정집을 대조 분석 중입니다...
                </div>
              ) : (
                <div className="prose prose-xs prose-stone max-w-none leading-relaxed">
                  <ReactMarkdown>{checkerReport || ''}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
