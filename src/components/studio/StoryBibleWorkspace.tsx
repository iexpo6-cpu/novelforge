'use client';

import { useState, useRef } from 'react';
import {
  Users,
  Globe,
  GitBranch,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Loader2,
  Image as ImageIcon,
  Check,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buildAIHeaders } from '@/lib/ai/client-key';
import type {
  Chapter,
  Character,
  CharacterCustomField,
  ImageTargetType,
  PlotNode,
  Project,
  WorldSetting,
} from '@/types/novel';

export type BibleWorkspaceMode = 'characters' | 'world' | 'plot';

interface StoryBibleWorkspaceProps {
  mode: BibleWorkspaceMode;
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  worldSettings: WorldSetting[];
  plotNodes: PlotNode[];
  extraGroups: { characters: string[]; world: string[]; plot: string[] };
  onAddGroup: (kind: 'characters' | 'world' | 'plot', name: string) => void;
  onSaveProjectMeta: (
    patch: Pick<Project, 'logline' | 'synopsis'>
  ) => Promise<void>;
  onSaveCharacter: (char: Partial<Character> & { id?: string }) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onSaveWorld: (world: Partial<WorldSetting> & { id?: string }) => Promise<void>;
  onDeleteWorld: (id: string) => Promise<void>;
  onSavePlot: (node: Partial<PlotNode> & { id?: string }) => Promise<void>;
  onDeletePlot: (id: string) => Promise<void>;
  onRequestImageGeneration: (
    targetType: ImageTargetType,
    targetId?: string
  ) => void;
}

const WORLD_CATEGORIES = [
  '장소',
  '마법/기술',
  '세력/조직',
  '역사/사건',
  '규칙/기타',
];

const ACT_LABELS = ['기', '승', '전', '결', '에필로그'];

const SUGGESTED_CHAR_TRAITS = [
  '말투',
  '가치관',
  '특기/능력',
  '목표/동기',
  '비밀/약점',
];

function extractGroups<T extends { folder?: string }>(
  items: T[],
  extra: string[]
): string[] {
  const set = new Set<string>(['미분류', ...extra]);
  items.forEach((item) => {
    const f = item.folder?.trim() || '미분류';
    set.add(f);
  });
  return Array.from(set).sort((a, b) => {
    if (a === '미분류') return 1;
    if (b === '미분류') return -1;
    return a.localeCompare(b, 'ko');
  });
}

function groupItemsByCategory<T extends { folder?: string }>(
  items: T[]
): Array<{ group: string; items: T[] }> {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const f = item.folder?.trim() || '미분류';
    const list = map.get(f) ?? [];
    list.push(item);
    map.set(f, list);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b, 'ko');
    })
    .map(([group, grouped]) => ({ group, items: grouped }));
}

function GroupDropdownField({
  value,
  groups,
  onChange,
  onCreateGroup,
}: {
  value: string;
  groups: string[];
  onChange: (val: string) => void;
  onCreateGroup: (newName: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-stone-700">
        <Tag className="h-3.5 w-3.5 text-amber-600" />큰 분류
      </label>
      <div className="flex gap-2">
        <select
          value={groups.includes(value) ? value : '미분류'}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          + 새 분류
        </button>
      </div>
      {creating && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="새 분류 이름 입력 (예: 흑요석 길드)"
            className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = newName.trim();
              if (!trimmed) return;
              onCreateGroup(trimmed);
              onChange(trimmed);
              setNewName('');
              setCreating(false);
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-amber-400"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}

export default function StoryBibleWorkspace({
  mode,
  project,
  chapters,
  characters,
  worldSettings,
  plotNodes,
  extraGroups,
  onAddGroup,
  onSaveProjectMeta,
  onSaveCharacter,
  onDeleteCharacter,
  onSaveWorld,
  onDeleteWorld,
  onSavePlot,
  onDeletePlot,
  onRequestImageGeneration,
}: StoryBibleWorkspaceProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Filter dropdown states
  const [charGroupFilter, setCharGroupFilter] = useState<string>('전체');
  const [worldGroupFilter, setWorldGroupFilter] = useState<string>('전체');
  const [plotGroupFilter, setPlotGroupFilter] = useState<string>('전체');

  // Inline new group input in filter bar
  const [showFilterAdd, setShowFilterAdd] = useState(false);
  const [filterNewGroupName, setFilterNewGroupName] = useState('');

  // Character editor state
  const [charDraft, setCharDraft] = useState<Partial<Character>>({
    folder: '미분류',
    name: '',
    role: '주연',
    age: '',
    appearance: '',
    personality: '',
    background: '',
    relationships: '',
    custom_fields: [],
    avatar_image_url: null,
  });
  const [savingChar, setSavingChar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // World editor state
  const [worldCategoryFilter, setWorldCategoryFilter] = useState<string>('전체');
  const [worldDraft, setWorldDraft] = useState<Partial<WorldSetting>>({
    folder: '미분류',
    category: '장소',
    title: '',
    description: '',
  });
  const [savingWorld, setSavingWorld] = useState(false);

  // Plot editor state
  const [loglineDraft, setLoglineDraft] = useState(project.logline);
  const [synopsisDraft, setSynopsisDraft] = useState(project.synopsis);
  const [savingMeta, setSavingMeta] = useState(false);
  const [plotDraft, setPlotDraft] = useState<Partial<PlotNode>>({
    folder: '미분류',
    act_label: '기',
    title: '',
    description: '',
    chapter_id: null,
  });
  const [savingPlot, setSavingPlot] = useState(false);

  function flashSaved() {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setUploadError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `${user.id}/${project.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('novel-images')
        .upload(storagePath, file, {
          contentType: file.type || 'image/png',
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`이미지 업로드 실패: ${uploadErr.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('novel-images')
        .getPublicUrl(storagePath);

      setCharDraft((prev) => ({
        ...prev,
        avatar_image_url: urlData.publicUrl,
      }));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : '이미지 업로드 중 오류 발생'
      );
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addCustomField(label = '') {
    const current = charDraft.custom_fields ?? [];
    setCharDraft({
      ...charDraft,
      custom_fields: [...current, { label, value: '' }],
    });
  }

  function updateCustomField(
    index: number,
    patch: Partial<CharacterCustomField>
  ) {
    const current = [...(charDraft.custom_fields ?? [])];
    current[index] = { ...current[index], ...patch };
    setCharDraft({ ...charDraft, custom_fields: current });
  }

  function removeCustomField(index: number) {
    const current = (charDraft.custom_fields ?? []).filter((_, i) => i !== index);
    setCharDraft({ ...charDraft, custom_fields: current });
  }

  async function handleAIGenerate() {
    if (!aiPrompt.trim() || generatingAI) return;
    setGeneratingAI(true);
    setAiError(null);
    try {
      const targetType =
        mode === 'characters' ? 'character' : mode === 'world' ? 'world' : 'plot';
      const customFieldLabels = Array.from(
        new Set([
          ...(charDraft.custom_fields ?? []).map((f) => f.label.trim()),
          ...characters.flatMap((c) =>
            (c.custom_fields ?? []).map((f) => f.label.trim())
          ),
        ])
      ).filter(Boolean);

      const res = await fetch('/api/ai/bible', {
        method: 'POST',
        headers: buildAIHeaders(),
        body: JSON.stringify({
          projectId: project.id,
          targetType,
          instruction: aiPrompt.trim(),
          customFieldLabels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 설정 생성 실패');

      if (mode === 'characters') {
        setCharDraft((prev) => ({
          ...prev,
          id: undefined,
          folder:
            charGroupFilter !== '전체' ? charGroupFilter : prev.folder || '미분류',
          ...data.item,
          custom_fields: Array.isArray(data.item?.custom_fields)
            ? data.item.custom_fields
            : prev.custom_fields ?? [],
        }));
      } else if (mode === 'world') {
        setWorldDraft((prev) => ({
          ...prev,
          id: undefined,
          folder:
            worldGroupFilter !== '전체'
              ? worldGroupFilter
              : prev.folder || '미분류',
          ...data.item,
        }));
      } else {
        setPlotDraft((prev) => ({
          ...prev,
          id: undefined,
          folder:
            plotGroupFilter !== '전체' ? plotGroupFilter : prev.folder || '미분류',
          ...data.item,
        }));
      }
      setAiPrompt('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 생성 오류');
    } finally {
      setGeneratingAI(false);
    }
  }

  const charGroups = extractGroups(characters, extraGroups.characters);
  const filteredCharacters =
    charGroupFilter === '전체'
      ? characters
      : characters.filter((c) => (c.folder || '미분류') === charGroupFilter);
  const groupedCharacters = groupItemsByCategory(filteredCharacters);

  const worldGroups = extractGroups(worldSettings, extraGroups.world);
  const filteredWorld = worldSettings.filter((w) => {
    const matchGroup =
      worldGroupFilter === '전체' ||
      (w.folder || '미분류') === worldGroupFilter;
    const matchCat =
      worldCategoryFilter === '전체' || w.category === worldCategoryFilter;
    return matchGroup && matchCat;
  });
  const groupedWorld = groupItemsByCategory(filteredWorld);

  const plotGroups = extractGroups(plotNodes, extraGroups.plot);
  const filteredPlot =
    plotGroupFilter === '전체'
      ? plotNodes
      : plotNodes.filter((p) => (p.folder || '미분류') === plotGroupFilter);
  const groupedPlot = groupItemsByCategory(filteredPlot);

  const activeGroupFilter =
    mode === 'characters'
      ? charGroupFilter
      : mode === 'world'
        ? worldGroupFilter
        : plotGroupFilter;
  const activeGroups =
    mode === 'characters'
      ? charGroups
      : mode === 'world'
        ? worldGroups
        : plotGroups;
  const setActiveGroupFilter =
    mode === 'characters'
      ? setCharGroupFilter
      : mode === 'world'
        ? setWorldGroupFilter
        : setPlotGroupFilter;

  return (
    <main className="flex h-full flex-col overflow-y-auto bg-stone-50 px-6 py-6 sm:px-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header + AI Generator Bar */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                {mode === 'characters' && <Users className="h-5 w-5" />}
                {mode === 'world' && <Globe className="h-5 w-5" />}
                {mode === 'plot' && <GitBranch className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  {mode === 'characters' && '등장인물 상세 스튜디오'}
                  {mode === 'world' && '세계관 설정 백과'}
                  {mode === 'plot' && '줄거리 · 플롯 기획 보드'}
                </h2>
                <p className="text-xs text-stone-500">
                  {mode === 'characters' &&
                    '분류별로 인물을 정리하고, 성격·가치관·말투 등 커스텀 항목과 인물 이미지를 자유롭게 추가하세요.'}
                  {mode === 'world' &&
                    '분류별로 세계관을 묶고, 상세 설정과 컨셉아트를 관리하세요.'}
                  {mode === 'plot' &&
                    '분류별로 플롯 타임라인을 정렬하고 회차와 연결하세요.'}
                </p>
              </div>
            </div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                저장되었습니다
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAIGenerate();
                }
              }}
              placeholder={
                mode === 'characters'
                  ? 'AI에게 캐릭터 구상 요청 (예: 주인공을 배신할 냉철한 정보상 조력자)'
                  : mode === 'world'
                    ? 'AI에게 세계관 구상 요청 (예: 기억을 화폐로 거래하는 지하 암시장)'
                    : 'AI에게 플롯 사건 요청 (예: 2막 중반 주인공의 비밀이 폭로되는 위기 사건)'
              }
              className="flex-1 rounded-xl border border-amber-200 bg-amber-50/40 px-3.5 py-2 text-xs text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              disabled={generatingAI || !aiPrompt.trim()}
              onClick={handleAIGenerate}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {generatingAI ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI로 초안 채우기
            </button>
          </div>
          {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}
        </div>

        {/* Common Classification Dropdown Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-stone-600">
              <Tag className="h-3.5 w-3.5 text-amber-600" />
              분류 필터:
            </span>
            <select
              value={activeGroupFilter}
              onChange={(e) => setActiveGroupFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 focus:border-amber-500 focus:outline-none"
            >
              <option value="전체">전체 분류 보기</option>
              {activeGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowFilterAdd((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
              분류 추가
            </button>
          </div>

          {showFilterAdd && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = filterNewGroupName.trim();
                if (!trimmed) return;
                onAddGroup(mode, trimmed);
                setActiveGroupFilter(trimmed);
                setFilterNewGroupName('');
                setShowFilterAdd(false);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                autoFocus
                value={filterNewGroupName}
                onChange={(e) => setFilterNewGroupName(e.target.value)}
                placeholder="새 분류명 입력..."
                className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400"
              >
                추가
              </button>
            </form>
          )}
        </div>

        {/* CHARACTERS WORKSPACE */}
        {mode === 'characters' && (
          <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
            {/* Grouped Character List */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() =>
                  setCharDraft({
                    folder:
                      charGroupFilter !== '전체' ? charGroupFilter : '미분류',
                    name: '',
                    role: '주연',
                    age: '',
                    appearance: '',
                    personality: '',
                    background: '',
                    relationships: '',
                    custom_fields: [],
                    avatar_image_url: null,
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-white py-2.5 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:text-amber-700"
              >
                <Plus className="h-3.5 w-3.5" />새 등장인물 작성
              </button>

              {groupedCharacters.map((group) => (
                <div key={group.group} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-stone-500">
                    <Tag className="h-3 w-3 text-amber-600" />
                    <span>{group.group}</span>
                    <span className="text-stone-400">
                      ({group.items.length})
                    </span>
                  </div>
                  {group.items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() =>
                        setCharDraft({
                          ...c,
                          custom_fields: c.custom_fields ?? [],
                        })
                      }
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition ${
                        charDraft.id === c.id
                          ? 'border-amber-400 bg-amber-50/60'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      {c.avatar_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatar_image_url}
                          alt={c.name}
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-500">
                          {c.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-stone-900">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-stone-500">{c.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Character Detail Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!charDraft.name?.trim()) return;
                setSavingChar(true);
                try {
                  await onSaveCharacter(charDraft);
                  flashSaved();
                } finally {
                  setSavingChar(false);
                }
              }}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900">
                  {charDraft.id ? `인물 편집: ${charDraft.name}` : '새 인물 등록'}
                </h3>
                <div className="flex items-center gap-2">
                  {charDraft.id && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestImageGeneration('character', charDraft.id)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 초상화 생성
                    </button>
                  )}
                  {charDraft.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!charDraft.id) return;
                        await onDeleteCharacter(charDraft.id);
                        setCharDraft({
                          folder: '미분류',
                          name: '',
                          role: '주연',
                          age: '',
                          appearance: '',
                          personality: '',
                          background: '',
                          relationships: '',
                          custom_fields: [],
                          avatar_image_url: null,
                        });
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Character Image Attachment & Preview */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                {charDraft.avatar_image_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={charDraft.avatar_image_url}
                      alt="인물 이미지"
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-stone-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCharDraft({ ...charDraft, avatar_image_url: null })
                      }
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-stone-900 p-0.5 text-white hover:bg-red-600"
                      title="이미지 제거"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400">
                    <ImageIcon className="h-6 w-6 opacity-50" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-stone-800">
                    인물 이미지 첨부
                  </p>
                  <p className="text-[11px] text-stone-500">
                    직접 준비한 캐릭터 일러스트를 첨부하거나 AI 초상화를
                    생성하세요.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploadingAvatar ? '업로드 중...' : '파일에서 이미지 첨부'}
                  </button>
                  {uploadError && (
                    <p className="text-[11px] text-red-600">{uploadError}</p>
                  )}
                </div>
              </div>

              <GroupDropdownField
                value={charDraft.folder ?? '미분류'}
                groups={charGroups}
                onChange={(folder) => setCharDraft({ ...charDraft, folder })}
                onCreateGroup={(name) => onAddGroup('characters', name)}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    이름 *
                  </label>
                  <input
                    type="text"
                    required
                    value={charDraft.name ?? ''}
                    onChange={(e) =>
                      setCharDraft({ ...charDraft, name: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    역할
                  </label>
                  <input
                    type="text"
                    value={charDraft.role ?? ''}
                    onChange={(e) =>
                      setCharDraft({ ...charDraft, role: e.target.value })
                    }
                    placeholder="주인공 / 히로인 / 악역 / 조력자"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    나이 / 종족
                  </label>
                  <input
                    type="text"
                    value={charDraft.age ?? ''}
                    onChange={(e) =>
                      setCharDraft({ ...charDraft, age: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  외모 및 복장 묘사
                </label>
                <textarea
                  rows={2}
                  value={charDraft.appearance ?? ''}
                  onChange={(e) =>
                    setCharDraft({ ...charDraft, appearance: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  성격, 가치관 및 말투
                </label>
                <textarea
                  rows={2}
                  value={charDraft.personality ?? ''}
                  onChange={(e) =>
                    setCharDraft({
                      ...charDraft,
                      personality: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  과거 배경 스토리 및 관계
                </label>
                <textarea
                  rows={2}
                  value={charDraft.background ?? ''}
                  onChange={(e) =>
                    setCharDraft({ ...charDraft, background: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              {/* Custom Character Attributes */}
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-stone-800">
                      커스텀 세부 설정 (사용자 자유 추가)
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      성격, 가치관, 말투, 트라우마 등 원하는 항목을 직접 만들어
                      추가하세요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCustomField('')}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    항목 추가
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-stone-400">빠른 추가:</span>
                  {SUGGESTED_CHAR_TRAITS.map((trait) => (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => addCustomField(trait)}
                      className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-amber-50 hover:text-amber-800"
                    >
                      + {trait}
                    </button>
                  ))}
                </div>

                {(charDraft.custom_fields ?? []).length > 0 && (
                  <div className="space-y-2 pt-1">
                    {(charDraft.custom_fields ?? []).map((field, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2.5 sm:flex-row sm:items-start"
                      >
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            updateCustomField(idx, { label: e.target.value })
                          }
                          placeholder="항목명 (예: 말투)"
                          className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold sm:w-36"
                        />
                        <textarea
                          rows={2}
                          value={field.value}
                          onChange={(e) =>
                            updateCustomField(idx, { value: e.target.value })
                          }
                          placeholder="세부 설정 내용을 입력하세요..."
                          className="flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs leading-relaxed"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomField(idx)}
                          className="self-end rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 sm:self-start"
                          title="항목 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingChar}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingChar ? '저장 중...' : '인물 설정 저장'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* WORLD SETTINGS WORKSPACE */}
        {mode === 'world' && (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {['전체', ...WORLD_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setWorldCategoryFilter(cat)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                      worldCategoryFilter === cat
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setWorldDraft({
                    folder:
                      worldGroupFilter !== '전체' ? worldGroupFilter : '미분류',
                    category: '장소',
                    title: '',
                    description: '',
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-white py-2.5 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:text-amber-700"
              >
                <Plus className="h-3.5 w-3.5" />새 세계관 항목
              </button>

              <div className="space-y-4">
                {groupedWorld.map((group) => (
                  <div key={group.group} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-stone-500">
                      <Tag className="h-3 w-3 text-amber-600" />
                      <span>{group.group}</span>
                      <span className="text-stone-400">
                        ({group.items.length})
                      </span>
                    </div>
                    {group.items.map((w) => (
                      <div
                        key={w.id}
                        onClick={() => setWorldDraft(w)}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          worldDraft.id === w.id
                            ? 'border-amber-400 bg-amber-50/60'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          {w.category}
                        </span>
                        <p className="mt-1 truncate text-xs font-bold text-stone-900">
                          {w.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!worldDraft.title?.trim()) return;
                setSavingWorld(true);
                try {
                  await onSaveWorld(worldDraft);
                  flashSaved();
                } finally {
                  setSavingWorld(false);
                }
              }}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900">
                  {worldDraft.id
                    ? `세계관 편집: ${worldDraft.title}`
                    : '새 세계관 등록'}
                </h3>
                {worldDraft.id && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onRequestImageGeneration('world', worldDraft.id)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      컨셉아트 생성
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!worldDraft.id) return;
                        await onDeleteWorld(worldDraft.id);
                        setWorldDraft({
                          folder: '미분류',
                          category: '장소',
                          title: '',
                          description: '',
                        });
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <GroupDropdownField
                value={worldDraft.folder ?? '미분류'}
                groups={worldGroups}
                onChange={(folder) => setWorldDraft({ ...worldDraft, folder })}
                onCreateGroup={(name) => onAddGroup('world', name)}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    유형
                  </label>
                  <select
                    value={worldDraft.category ?? '장소'}
                    onChange={(e) =>
                      setWorldDraft({
                        ...worldDraft,
                        category: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
                  >
                    {WORLD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    설정 이름 *
                  </label>
                  <input
                    type="text"
                    required
                    value={worldDraft.title ?? ''}
                    onChange={(e) =>
                      setWorldDraft({ ...worldDraft, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  상세 설정 내용 (규칙, 제약 조건, 분위기, 역사적 맥락 등)
                </label>
                <textarea
                  rows={8}
                  value={worldDraft.description ?? ''}
                  onChange={(e) =>
                    setWorldDraft({
                      ...worldDraft,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingWorld}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingWorld ? '저장 중...' : '세계관 저장'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PLOT WORKSPACE */}
        {mode === 'plot' && (
          <div className="space-y-6">
            {/* Project Logline & Synopsis */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingMeta(true);
                try {
                  await onSaveProjectMeta({
                    logline: loglineDraft,
                    synopsis: synopsisDraft,
                  });
                  flashSaved();
                } finally {
                  setSavingMeta(false);
                }
              }}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900">
                  작품 전체 로그라인 & 시놉시스
                </h3>
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingMeta ? '저장 중...' : '시놉시스 저장'}
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  로그라인 (한 두 문장 핵심 요약)
                </label>
                <input
                  type="text"
                  value={loglineDraft}
                  onChange={(e) => setLoglineDraft(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  전체 시놉시스 (작품의 큰 흐름과 결말 방향)
                </label>
                <textarea
                  rows={4}
                  value={synopsisDraft}
                  onChange={(e) => setSynopsisDraft(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                />
              </div>
            </form>

            {/* Plot Timeline Cards + Form */}
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">
                    사건 타임라인 ({filteredPlot.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setPlotDraft({
                        folder:
                          plotGroupFilter !== '전체'
                            ? plotGroupFilter
                            : '미분류',
                        act_label: '기',
                        title: '',
                        description: '',
                        order_index: plotNodes.length,
                        chapter_id: null,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
                  >
                    <Plus className="h-3.5 w-3.5" />새 사건 추가
                  </button>
                </div>

                {filteredPlot.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-12 text-center text-xs text-stone-400">
                    아직 등록된 플롯 사건이 없습니다. 우측 폼이나 상단 AI 초안
                    생성으로 줄거리를 구성해보세요.
                  </div>
                ) : (
                  groupedPlot.map((group) => (
                    <div key={group.group} className="space-y-2.5">
                      <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-stone-600">
                        <Tag className="h-3.5 w-3.5 text-amber-600" />
                        <span>{group.group}</span>
                        <span className="text-stone-400">
                          ({group.items.length})
                        </span>
                      </div>
                      {group.items.map((node, idx) => (
                        <div
                          key={node.id}
                          onClick={() => setPlotDraft(node)}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            plotDraft.id === node.id
                              ? 'border-amber-400 bg-amber-50/50'
                              : 'border-stone-200 bg-white hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-stone-900 px-2 py-0.5 text-[11px] font-bold text-white">
                                {idx + 1}. {node.act_label}
                              </span>
                              <h4 className="text-sm font-bold text-stone-900">
                                {node.title}
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePlot(node.id);
                              }}
                              className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-stone-600">
                            {node.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!plotDraft.title?.trim()) return;
                  setSavingPlot(true);
                  try {
                    await onSavePlot(plotDraft);
                    flashSaved();
                    if (!plotDraft.id) {
                      setPlotDraft({
                        folder:
                          plotGroupFilter !== '전체'
                            ? plotGroupFilter
                            : '미분류',
                        act_label: '기',
                        title: '',
                        description: '',
                        order_index: plotNodes.length + 1,
                        chapter_id: null,
                      });
                    }
                  } finally {
                    setSavingPlot(false);
                  }
                }}
                className="h-fit space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
              >
                <h3 className="text-sm font-bold text-stone-900">
                  {plotDraft.id ? '사건 편집' : '새 사건 등록'}
                </h3>

                <GroupDropdownField
                  value={plotDraft.folder ?? '미분류'}
                  groups={plotGroups}
                  onChange={(folder) => setPlotDraft({ ...plotDraft, folder })}
                  onCreateGroup={(name) => onAddGroup('plot', name)}
                />

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    구간 (기승전결)
                  </label>
                  <select
                    value={plotDraft.act_label ?? '기'}
                    onChange={(e) =>
                      setPlotDraft({ ...plotDraft, act_label: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
                  >
                    {ACT_LABELS.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    사건 제목 *
                  </label>
                  <input
                    type="text"
                    required
                    value={plotDraft.title ?? ''}
                    onChange={(e) =>
                      setPlotDraft({ ...plotDraft, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    연결 회차 (선택)
                  </label>
                  <select
                    value={plotDraft.chapter_id ?? ''}
                    onChange={(e) =>
                      setPlotDraft({
                        ...plotDraft,
                        chapter_id: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">연결 안 함</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    상세 내용 및 갈등/복선
                  </label>
                  <textarea
                    rows={5}
                    value={plotDraft.description ?? ''}
                    onChange={(e) =>
                      setPlotDraft({
                        ...plotDraft,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-relaxed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPlot}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingPlot ? '저장 중...' : '플롯 사건 저장'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
