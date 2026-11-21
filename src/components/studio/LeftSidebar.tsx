'use client';

import { useState } from 'react';
import {
  FileText,
  Users,
  Globe,
  GitBranch,
  Image as ImageIcon,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import type {
  Chapter,
  Character,
  ImageTargetType,
  PlotNode,
  ProjectImage,
  WorldSetting,
} from '@/types/novel';

export type LeftTab = 'chapters' | 'characters' | 'world' | 'plot' | 'gallery';

interface LeftSidebarProps {
  chapters: Chapter[];
  activeChapterId: string | null;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onDeleteChapter: (id: string) => void;
  characters: Character[];
  onSaveCharacter: (char: Partial<Character> & { id?: string }) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  worldSettings: WorldSetting[];
  onSaveWorld: (world: Partial<WorldSetting> & { id?: string }) => Promise<void>;
  onDeleteWorld: (id: string) => Promise<void>;
  plotNodes: PlotNode[];
  onSavePlot: (node: Partial<PlotNode> & { id?: string }) => Promise<void>;
  onDeletePlot: (id: string) => Promise<void>;
  extraGroups: { characters: string[]; world: string[]; plot: string[] };
  onAddGroup: (kind: 'characters' | 'world' | 'plot', name: string) => void;
  onNavigateBibleItem: (kind: 'characters' | 'world' | 'plot', id: string) => void;
  images: ProjectImage[];
  onSetCoverImage: (imageUrl: string) => Promise<void>;
  onRequestImageGeneration: (targetType: ImageTargetType, targetId?: string) => void;
}

export default function LeftSidebar({
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  characters,
  onSaveCharacter,
  onDeleteCharacter,
  worldSettings,
  onSaveWorld,
  onDeleteWorld,
  plotNodes,
  onSavePlot,
  onDeletePlot,
  extraGroups,
  onAddGroup,
  onNavigateBibleItem,
  images,
  onSetCoverImage,
  onRequestImageGeneration,
}: LeftSidebarProps) {
  const [tab, setTab] = useState<LeftTab>('chapters');
  const [searchQuery, setSearchQuery] = useState('');

  // Character form
  const [editingChar, setEditingChar] = useState<Partial<Character> | null>(null);
  const [charFolderFilter, setCharFolderFilter] = useState<string>('전체');
  // World form
  const [editingWorld, setEditingWorld] = useState<Partial<WorldSetting> | null>(null);
  const [worldFolderFilter, setWorldFolderFilter] = useState<string>('전체');
  // Plot form
  const [editingPlot, setEditingPlot] = useState<Partial<PlotNode> | null>(null);
  const [plotFolderFilter, setPlotFolderFilter] = useState<string>('전체');
  const [addingGroupKind, setAddingGroupKind] = useState<
    'characters' | 'world' | 'plot' | null
  >(null);
  const [newGroupName, setNewGroupName] = useState('');

  const charFolders = Array.from(
    new Set([
      ...characters.map((c) => c.folder?.trim() || '미분류'),
      ...extraGroups.characters,
    ])
  );
  const worldFolders = Array.from(
    new Set([
      ...worldSettings.map((w) => w.folder?.trim() || '미분류'),
      ...extraGroups.world,
    ])
  );
  const plotFolders = Array.from(
    new Set([
      ...plotNodes.map((p) => p.folder?.trim() || '미분류'),
      ...extraGroups.plot,
    ])
  );

  const visibleCharacters =
    charFolderFilter === '전체'
      ? characters
      : characters.filter((c) => (c.folder || '미분류') === charFolderFilter);
  const visibleWorld =
    worldFolderFilter === '전체'
      ? worldSettings
      : worldSettings.filter((w) => (w.folder || '미분류') === worldFolderFilter);
  const visiblePlot =
    plotFolderFilter === '전체'
      ? plotNodes
      : plotNodes.filter((p) => (p.folder || '미분류') === plotFolderFilter);

  const tabs: Array<{ id: LeftTab; label: string; icon: typeof FileText }> = [
    { id: 'chapters', label: '회차', icon: FileText },
    { id: 'characters', label: '인물', icon: Users },
    { id: 'world', label: '세계관', icon: Globe },
    { id: 'plot', label: '줄거리', icon: GitBranch },
    { id: 'gallery', label: '갤러리', icon: ImageIcon },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? [
        ...chapters
          .filter(
            (c) =>
              c.title.toLowerCase().includes(normalizedQuery) ||
              c.content.toLowerCase().includes(normalizedQuery) ||
              c.summary.toLowerCase().includes(normalizedQuery)
          )
          .map((c) => ({
            kind: 'chapter' as const,
            id: c.id,
            badge: '회차',
            title: c.title,
            subtitle: c.summary || c.content.slice(0, 60) || '본문 없음',
          })),
        ...characters
          .filter(
            (c) =>
              c.name.toLowerCase().includes(normalizedQuery) ||
              c.role.toLowerCase().includes(normalizedQuery) ||
              c.personality.toLowerCase().includes(normalizedQuery) ||
              (c.free_notes ?? '').toLowerCase().includes(normalizedQuery) ||
              (c.tags ?? []).some((t) =>
                t.toLowerCase().includes(normalizedQuery)
              )
          )
          .map((c) => ({
            kind: 'characters' as const,
            id: c.id,
            badge: '인물',
            title: c.name,
            subtitle:
              (c.tags ?? []).length > 0
                ? `${c.role} · ${(c.tags ?? []).map((t) => `#${t}`).join(' ')}`
                : c.role,
          })),
        ...worldSettings
          .filter(
            (w) =>
              w.title.toLowerCase().includes(normalizedQuery) ||
              w.description.toLowerCase().includes(normalizedQuery) ||
              w.category.toLowerCase().includes(normalizedQuery)
          )
          .map((w) => ({
            kind: 'world' as const,
            id: w.id,
            badge: '세계관',
            title: w.title,
            subtitle: `[${w.category}] ${w.description.slice(0, 50)}`,
          })),
        ...plotNodes
          .filter(
            (p) =>
              p.title.toLowerCase().includes(normalizedQuery) ||
              p.description.toLowerCase().includes(normalizedQuery)
          )
          .map((p) => ({
            kind: 'plot' as const,
            id: p.id,
            badge: '줄거리',
            title: p.title,
            subtitle: `[${p.act_label}] ${p.description.slice(0, 50)}`,
          })),
      ]
    : [];

  return (
    <aside className="flex h-full flex-col border-r border-stone-200 bg-white">
      {/* Global Sidebar Search */}
      <div className="border-b border-stone-200 p-2.5">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="인물, 회차, 세계관, 줄거리, #태그 검색..."
            className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pr-7 pl-8 text-xs text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 rounded p-0.5 text-stone-400 hover:text-stone-700"
              title="검색 지우기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-5 border-b border-stone-200 bg-stone-50/70 p-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition ${
                active
                  ? 'bg-white text-amber-700 shadow-xs ring-1 ring-stone-200'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content or Search Results */}
      <div className="flex-1 overflow-y-auto p-3">
        {normalizedQuery ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-stone-500">
              검색 결과 ({searchResults.length}건)
            </p>
            {searchResults.length === 0 ? (
              <p className="py-10 text-center text-xs text-stone-400">
                &ldquo;{searchQuery}&rdquo;에 해당하는 항목이 없습니다.
              </p>
            ) : (
              searchResults.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => {
                    if (item.kind === 'chapter') {
                      onSelectChapter(item.id);
                    } else {
                      onNavigateBibleItem(item.kind, item.id);
                    }
                  }}
                  className="block w-full rounded-xl border border-stone-200 bg-white p-2.5 text-left transition hover:border-amber-400 hover:bg-amber-50/40"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                    <span className="truncate text-xs font-bold text-stone-900">
                      {item.title}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-stone-500">
                      {item.subtitle}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        ) : null}

        {!normalizedQuery && tab === 'chapters' && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">
                총 {chapters.length}화
              </span>
              <button
                type="button"
                onClick={onCreateChapter}
                className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                <Plus className="h-3.5 w-3.5" />새 회차
              </button>
            </div>
            {chapters.map((chap) => {
              const isSelected = chap.id === activeChapterId;
              return (
                <div
                  key={chap.id}
                  onClick={() => onSelectChapter(chap.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50/60'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {chap.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {chap.word_count.toLocaleString()}자
                      {chap.summary ? ' · 요약됨' : ''}
                    </p>
                  </div>
                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChapter(chap.id);
                      }}
                      className="ml-2 rounded p-1 text-stone-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                      title="회차 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!normalizedQuery && tab === 'characters' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <select
                  value={charFolderFilter}
                  onChange={(e) => setCharFolderFilter(e.target.value)}
                  className="max-w-[125px] rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700"
                >
                  <option value="전체">전체 분류 ({characters.length})</option>
                  {charFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddingGroupKind(
                      addingGroupKind === 'characters' ? null : 'characters'
                    );
                    setNewGroupName('');
                  }}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                  title="새 분류 추가"
                >
                  + 분류
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingChar({
                    folder:
                      charFolderFilter !== '전체' ? charFolderFilter : '미분류',
                    name: '',
                    role: '주연',
                    age: '',
                    appearance: '',
                    personality: '',
                    background: '',
                    relationships: '',
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                <Plus className="h-3.5 w-3.5" />
                인물 추가
              </button>
            </div>
            {addingGroupKind === 'characters' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroupName.trim()) return;
                  onAddGroup('characters', newGroupName.trim());
                  setCharFolderFilter(newGroupName.trim());
                  setNewGroupName('');
                  setAddingGroupKind(null);
                }}
                className="flex gap-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="새 분류명 (예: 흑요석 길드)"
                  className="flex-1 rounded-lg border border-amber-300 px-2 py-1 text-[11px] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-stone-950"
                >
                  추가
                </button>
              </form>
            )}

            {editingChar && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingChar.name?.trim()) return;
                  await onSaveCharacter(editingChar);
                  setEditingChar(null);
                }}
                className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/40 p-3"
              >
                <input
                  type="text"
                  placeholder="분류 (예: 흑요석 길드, 미분류)"
                  value={editingChar.folder ?? '미분류'}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, folder: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="이름 *"
                  value={editingChar.name ?? ''}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="역할 (주인공/조연 등)"
                    value={editingChar.role ?? ''}
                    onChange={(e) =>
                      setEditingChar({ ...editingChar, role: e.target.value })
                    }
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="나이"
                    value={editingChar.age ?? ''}
                    onChange={(e) =>
                      setEditingChar({ ...editingChar, age: e.target.value })
                    }
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="외모 묘사 (이미지 생성 시 활용)"
                  value={editingChar.appearance ?? ''}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, appearance: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  placeholder="성격 및 말투"
                  value={editingChar.personality ?? ''}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, personality: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  placeholder="배경 스토리 및 목표"
                  value={editingChar.background ?? ''}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, background: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingChar(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}

            {visibleCharacters.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex items-start gap-2.5">
                  {c.avatar_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatar_image_url}
                      alt={c.name}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-stone-200"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-500">
                      {c.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate text-sm font-bold text-stone-900">
                        {c.name}
                      </h3>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                        {c.role}
                      </span>
                    </div>
                    {c.personality && (
                      <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                        {c.personality}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2">
                  <button
                    type="button"
                    onClick={() => onRequestImageGeneration('character', c.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-800"
                  >
                    <Sparkles className="h-3 w-3" />
                    초상화 생성
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingChar(c)}
                      className="text-[11px] font-medium text-stone-500 hover:text-stone-800"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCharacter(c.id)}
                      className="text-[11px] font-medium text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!normalizedQuery && tab === 'world' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <select
                  value={worldFolderFilter}
                  onChange={(e) => setWorldFolderFilter(e.target.value)}
                  className="max-w-[125px] rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700"
                >
                  <option value="전체">전체 분류 ({worldSettings.length})</option>
                  {worldFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddingGroupKind(
                      addingGroupKind === 'world' ? null : 'world'
                    );
                    setNewGroupName('');
                  }}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                >
                  + 분류
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingWorld({
                    folder:
                      worldFolderFilter !== '전체'
                        ? worldFolderFilter
                        : '미분류',
                    category: '장소',
                    title: '',
                    description: '',
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                <Plus className="h-3.5 w-3.5" />
                설정 추가
              </button>
            </div>
            {addingGroupKind === 'world' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroupName.trim()) return;
                  onAddGroup('world', newGroupName.trim());
                  setWorldFolderFilter(newGroupName.trim());
                  setNewGroupName('');
                  setAddingGroupKind(null);
                }}
                className="flex gap-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="새 분류명 (예: 북부 제국)"
                  className="flex-1 rounded-lg border border-amber-300 px-2 py-1 text-[11px] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-stone-950"
                >
                  추가
                </button>
              </form>
            )}

            {editingWorld && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingWorld.title?.trim()) return;
                  await onSaveWorld(editingWorld);
                  setEditingWorld(null);
                }}
                className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/40 p-3"
              >
                <select
                  value={editingWorld.category ?? '장소'}
                  onChange={(e) =>
                    setEditingWorld({ ...editingWorld, category: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {['장소', '마법/기술', '세력/조직', '역사/사건', '규칙/기타'].map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                </select>
                <input
                  type="text"
                  required
                  placeholder="설정 제목 *"
                  value={editingWorld.title ?? ''}
                  onChange={(e) =>
                    setEditingWorld({ ...editingWorld, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <textarea
                  rows={3}
                  placeholder="상세 설정 내용"
                  value={editingWorld.description ?? ''}
                  onChange={(e) =>
                    setEditingWorld({
                      ...editingWorld,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingWorld(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}

            {visibleWorld.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    {w.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRequestImageGeneration('world', w.id)}
                      className="text-[11px] font-medium text-amber-700 hover:underline"
                    >
                      컨셉아트
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWorld(w)}
                      className="text-[11px] text-stone-500 hover:text-stone-800"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWorld(w.id)}
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <h3 className="mt-1.5 text-sm font-bold text-stone-900">
                  {w.title}
                </h3>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stone-600">
                  {w.description}
                </p>
                {w.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.image_url}
                    alt={w.title}
                    className="mt-2 h-28 w-full rounded-lg object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!normalizedQuery && tab === 'plot' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <select
                  value={plotFolderFilter}
                  onChange={(e) => setPlotFolderFilter(e.target.value)}
                  className="max-w-[125px] rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700"
                >
                  <option value="전체">전체 분류 ({plotNodes.length})</option>
                  {plotFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddingGroupKind(
                      addingGroupKind === 'plot' ? null : 'plot'
                    );
                    setNewGroupName('');
                  }}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                >
                  + 분류
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingPlot({
                    folder:
                      plotFolderFilter !== '전체' ? plotFolderFilter : '미분류',
                    act_label: '기',
                    title: '',
                    description: '',
                    order_index: plotNodes.length,
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                <Plus className="h-3.5 w-3.5" />
                사건 추가
              </button>
            </div>
            {addingGroupKind === 'plot' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroupName.trim()) return;
                  onAddGroup('plot', newGroupName.trim());
                  setPlotFolderFilter(newGroupName.trim());
                  setNewGroupName('');
                  setAddingGroupKind(null);
                }}
                className="flex gap-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="새 분류명 (예: 1부 아카데미)"
                  className="flex-1 rounded-lg border border-amber-300 px-2 py-1 text-[11px] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-stone-950"
                >
                  추가
                </button>
              </form>
            )}

            {editingPlot && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingPlot.title?.trim()) return;
                  await onSavePlot(editingPlot);
                  setEditingPlot(null);
                }}
                className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/40 p-3"
              >
                <select
                  value={editingPlot.act_label ?? '기'}
                  onChange={(e) =>
                    setEditingPlot({ ...editingPlot, act_label: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {['기', '승', '전', '결', '에필로그'].map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="사건/전개 제목 *"
                  value={editingPlot.title ?? ''}
                  onChange={(e) =>
                    setEditingPlot({ ...editingPlot, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <textarea
                  rows={3}
                  placeholder="주요 사건 및 갈등 설명"
                  value={editingPlot.description ?? ''}
                  onChange={(e) =>
                    setEditingPlot({
                      ...editingPlot,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingPlot(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}

            {visiblePlot.map((node, idx) => (
              <div
                key={node.id}
                className="rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {idx + 1}. {node.act_label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlot(node)}
                      className="text-[11px] text-stone-500 hover:text-stone-800"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePlot(node.id)}
                      className="text-[11px] text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <h3 className="mt-1.5 text-sm font-bold text-stone-900">
                  {node.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {node.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {!normalizedQuery && tab === 'gallery' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">
                생성된 이미지 ({images.length})
              </span>
              <button
                type="button"
                onClick={() => onRequestImageGeneration('cover')}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-400"
              >
                <Sparkles className="h-3.5 w-3.5" />
                표지 생성
              </button>
            </div>
            {images.length === 0 ? (
              <p className="py-10 text-center text-xs text-stone-400">
                아직 생성된 이미지가 없습니다. 우측 AI 이미지 탭에서 표지나
                삽화를 만들어보세요.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image_url}
                      alt={img.prompt}
                      className="h-40 w-full object-cover"
                    />
                    <div className="flex items-center justify-between p-2.5">
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                        {img.target_type}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSetCoverImage(img.image_url)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        작품 표지로 지정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
