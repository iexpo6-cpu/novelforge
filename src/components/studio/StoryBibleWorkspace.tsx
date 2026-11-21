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
  Hash,
  Network,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buildAIHeaders } from '@/lib/ai/client-key';
import type {
  Chapter,
  Character,
  CharacterCustomField,
  CharacterRelationLink,
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
  onDeleteGroup: (kind: 'characters' | 'world' | 'plot', name: string) => Promise<void>;
  focusedItem?: {
    kind: BibleWorkspaceMode;
    id: string;
    nonce: number;
  } | null;
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

const RELATION_PRESETS = [
  '동료',
  '라이벌',
  '적대',
  '스승/제자',
  '가족',
  '연인',
  '주종',
  '계약',
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

function CharacterRelationshipGraph({
  characters,
  onSelectCharacter,
}: {
  characters: Character[];
  onSelectCharacter: (char: Character) => void;
}) {
  if (characters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-xs text-stone-400">
        등록된 등장인물이 없습니다. 인물을 추가하고 관계를 연결해보세요.
      </div>
    );
  }

  const width = 720;
  const height = 440;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 75;

  const positions = new Map<string, { x: number; y: number }>();
  characters.forEach((c, idx) => {
    if (characters.length === 1) {
      positions.set(c.id, { x: cx, y: cy });
    } else {
      const angle = (2 * Math.PI * idx) / characters.length - Math.PI / 2;
      positions.set(c.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }
  });

  const edges: Array<{
    from: Character;
    to: Character;
    relationType: string;
    description: string;
    key: string;
  }> = [];

  characters.forEach((c) => {
    (c.linked_relationships ?? []).forEach((rel, idx) => {
      const target = characters.find((t) => t.id === rel.targetCharacterId);
      if (target) {
        edges.push({
          from: c,
          to: target,
          relationType: rel.relationType,
          description: rel.description,
          key: `${c.id}-${target.id}-${idx}`,
        });
      }
    });
  });

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-stone-900">
            인물 관계도 ({characters.length}명 · {edges.length}개 연결)
          </h3>
          <p className="text-[11px] text-stone-500">
            인물 노드를 클릭하면 해당 캐릭터 상세 편집 화면으로 이동합니다.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-100 bg-stone-50/70">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto h-[420px] w-full max-w-[720px]"
        >
          <defs>
            <marker
              id="rel-arrow"
              viewBox="0 0 10 10"
              refX="24"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const p1 = positions.get(edge.from.id);
            const p2 = positions.get(edge.to.id);
            if (!p1 || !p2) return null;
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            return (
              <g key={edge.key}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeOpacity="0.65"
                  markerEnd="url(#rel-arrow)"
                />
                <rect
                  x={mx - 28}
                  y={my - 10}
                  width="56"
                  height="20"
                  rx="6"
                  fill="#ffffff"
                  stroke="#fcd34d"
                />
                <text
                  x={mx}
                  y={my + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#92400e"
                >
                  {edge.relationType.slice(0, 8)}
                </text>
              </g>
            );
          })}

          {characters.map((c) => {
            const pos = positions.get(c.id);
            if (!pos) return null;
            return (
              <g
                key={c.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onSelectCharacter(c)}
                className="cursor-pointer"
              >
                <circle
                  r="28"
                  fill="#ffffff"
                  stroke="#1c1917"
                  strokeWidth="2"
                />
                <text
                  y="4"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#1c1917"
                >
                  {c.name.slice(0, 4)}
                </text>
                <text
                  y="42"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#78716c"
                >
                  {c.role}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {edges.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {edges.map((edge) => (
            <div
              key={edge.key}
              className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                <span>{edge.from.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                <span>{edge.to.name}</span>
              </div>
              <div className="text-right">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {edge.relationType}
                </span>
                {edge.description && (
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    {edge.description}
                  </p>
                )}
              </div>
            </div>
          ))}
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
  onDeleteGroup,
  focusedItem,
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
  const [charTagFilter, setCharTagFilter] = useState<string>('전체');
  const [charSortBy, setCharSortBy] = useState<
    'group' | 'name' | 'role' | 'recent'
  >('group');
  const [charViewMode, setCharViewMode] = useState<'edit' | 'graph'>('edit');
  const [charWriteMode, setCharWriteMode] = useState<
    'structured' | 'free' | 'both'
  >('both');
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
    free_notes: '',
    tags: [],
    linked_relationships: [],
    custom_fields: [],
    avatar_image_url: null,
  });
  const [tagInput, setTagInput] = useState('');
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState('동료');
  const [relDesc, setRelDesc] = useState('');
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

  // Synchronize focused item from sidebar search without useEffect
  const [lastFocusedNonce, setLastFocusedNonce] = useState<number | null>(null);
  if (focusedItem && focusedItem.nonce !== lastFocusedNonce) {
    setLastFocusedNonce(focusedItem.nonce);
    if (focusedItem.kind === 'characters') {
      const target = characters.find((c) => c.id === focusedItem.id);
      if (target) {
        setCharDraft({
          ...target,
          tags: target.tags ?? [],
          linked_relationships: target.linked_relationships ?? [],
          custom_fields: target.custom_fields ?? [],
        });
        setCharViewMode('edit');
      }
    } else if (focusedItem.kind === 'world') {
      const target = worldSettings.find((w) => w.id === focusedItem.id);
      if (target) setWorldDraft(target);
    } else if (focusedItem.kind === 'plot') {
      const target = plotNodes.find((p) => p.id === focusedItem.id);
      if (target) setPlotDraft(target);
    }
  }

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

  function handleAddTag() {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (!cleaned) return;
    const current = charDraft.tags ?? [];
    if (!current.includes(cleaned)) {
      setCharDraft({ ...charDraft, tags: [...current, cleaned] });
    }
    setTagInput('');
  }

  function handleRemoveTag(tag: string) {
    setCharDraft({
      ...charDraft,
      tags: (charDraft.tags ?? []).filter((t) => t !== tag),
    });
  }

  function handleAddRelationLink() {
    if (!relTargetId || !relType.trim()) return;
    const nextLink: CharacterRelationLink = {
      targetCharacterId: relTargetId,
      relationType: relType.trim(),
      description: relDesc.trim(),
    };
    setCharDraft({
      ...charDraft,
      linked_relationships: [
        ...(charDraft.linked_relationships ?? []),
        nextLink,
      ],
    });
    setRelTargetId('');
    setRelDesc('');
  }

  function handleRemoveRelationLink(index: number) {
    setCharDraft({
      ...charDraft,
      linked_relationships: (charDraft.linked_relationships ?? []).filter(
        (_, i) => i !== index
      ),
    });
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
          tags: Array.isArray(data.item?.tags)
            ? data.item.tags
            : prev.tags ?? [],
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

  // Collect character tags with counts
  const tagCounts = new Map<string, number>();
  characters.forEach((c) => {
    (c.tags ?? []).forEach((t) => {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    });
  });
  const allCharTags = Array.from(tagCounts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], 'ko')
  );

  const charGroups = extractGroups(characters, extraGroups.characters);
  const filteredCharacters = characters
    .filter((c) => {
      const matchGroup =
        charGroupFilter === '전체' ||
        (c.folder || '미분류') === charGroupFilter;
      const matchTag =
        charTagFilter === '전체' || (c.tags ?? []).includes(charTagFilter);
      return matchGroup && matchTag;
    })
    .sort((a, b) => {
      if (charSortBy === 'name') return a.name.localeCompare(b.name, 'ko');
      if (charSortBy === 'role') return a.role.localeCompare(b.role, 'ko');
      if (charSortBy === 'recent')
        return b.created_at.localeCompare(a.created_at);
      return a.name.localeCompare(b.name, 'ko');
    });
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
                    '양식 서술과 자유 서술, #태그 모아보기, 인물 간 관계도 연결까지 자유롭게 구성하세요.'}
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

        {/* Common Classification Dropdown Bar + Character Mode Switcher */}
        <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-semibold text-stone-600">
                <Tag className="h-3.5 w-3.5 text-amber-600" />
                분류:
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
              {activeGroupFilter !== '전체' &&
                activeGroupFilter !== '미분류' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteGroup(mode, activeGroupFilter);
                      setActiveGroupFilter('전체');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    title="선택한 분류 삭제 (항목은 미분류로 이동)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    분류 삭제
                  </button>
                )}
            </div>

            {mode === 'characters' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={charSortBy}
                  onChange={(e) =>
                    setCharSortBy(
                      e.target.value as 'group' | 'name' | 'role' | 'recent'
                    )
                  }
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700"
                  title="인물 정렬 기준"
                >
                  <option value="group">정렬: 분류별 묶음</option>
                  <option value="name">정렬: 이름순 (가나다)</option>
                  <option value="role">정렬: 역할순</option>
                  <option value="recent">정렬: 최신 등록순</option>
                </select>
                <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setCharViewMode('edit')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    charViewMode === 'edit'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500'
                  }`}
                >
                  인물 편집
                </button>
                <button
                  type="button"
                  onClick={() => setCharViewMode('graph')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    charViewMode === 'graph'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-stone-500'
                  }`}
                >
                  <Network className="h-3.5 w-3.5" />
                  인물 관계도 보기
                </button>
              </div>
              </div>
            )}
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

          {/* Character Tags Collection Bar */}
          {mode === 'characters' && allCharTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
                <Hash className="h-3 w-3 text-amber-600" />
                태그 모아보기:
              </span>
              <button
                type="button"
                onClick={() => setCharTagFilter('전체')}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  charTagFilter === '전체'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                전체
              </button>
              {allCharTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setCharTagFilter(charTagFilter === tag ? '전체' : tag)
                  }
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    charTagFilter === tag
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100'
                  }`}
                >
                  #{tag} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CHARACTERS WORKSPACE */}
        {mode === 'characters' && charViewMode === 'graph' && (
          <CharacterRelationshipGraph
            characters={filteredCharacters}
            onSelectCharacter={(c) => {
              setCharDraft({
                ...c,
                tags: c.tags ?? [],
                linked_relationships: c.linked_relationships ?? [],
                custom_fields: c.custom_fields ?? [],
              });
              setCharViewMode('edit');
            }}
          />
        )}

        {mode === 'characters' && charViewMode === 'edit' && (
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
                    free_notes: '',
                    tags: [],
                    linked_relationships: [],
                    custom_fields: [],
                    avatar_image_url: null,
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-white py-2.5 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:text-amber-700"
              >
                <Plus className="h-3.5 w-3.5" />새 등장인물 작성
              </button>

              {charSortBy === 'group' ? (
                groupedCharacters.map((group) => (
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
                            tags: c.tags ?? [],
                            linked_relationships: c.linked_relationships ?? [],
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
                          {(c.tags ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(c.tags ?? []).slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="rounded bg-amber-50 px-1 text-[9px] font-medium text-amber-800"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="space-y-1.5">
                  {filteredCharacters.map((c) => (
                    <div
                      key={c.id}
                      onClick={() =>
                        setCharDraft({
                          ...c,
                          tags: c.tags ?? [],
                          linked_relationships: c.linked_relationships ?? [],
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
                        <p className="text-[11px] text-stone-500">
                          {c.role} · {c.folder || '미분류'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  {charDraft.id ? `인물 편집: ${charDraft.name}` : '새 인물 등록'}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Write mode switcher */}
                  <div className="flex rounded-lg bg-stone-100 p-0.5 text-[11px]">
                    {[
                      { id: 'both', label: '양식+자유' },
                      { id: 'structured', label: '양식만' },
                      { id: 'free', label: '자유 서술' },
                    ].map((wm) => (
                      <button
                        key={wm.id}
                        type="button"
                        onClick={() =>
                          setCharWriteMode(
                            wm.id as 'structured' | 'free' | 'both'
                          )
                        }
                        className={`rounded-md px-2 py-1 font-medium ${
                          charWriteMode === wm.id
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-500'
                        }`}
                      >
                        {wm.label}
                      </button>
                    ))}
                  </div>

                  {charDraft.id && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestImageGeneration('character', charDraft.id)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 초상화
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
                          free_notes: '',
                          tags: [],
                          linked_relationships: [],
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

              {/* Character Tags Input */}
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-stone-700">
                  <Hash className="h-3.5 w-3.5 text-amber-600" />
                  캐릭터 태그 (모아보기 지원)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="태그 입력 후 Enter (예: 마법사, 흑막, 1부 주역)"
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
                  >
                    + 추가
                  </button>
                </div>
                {(charDraft.tags ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(charDraft.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-900"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-amber-700 hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Structured Fields */}
              {(charWriteMode === 'structured' || charWriteMode === 'both') && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      외모 및 복장 묘사
                    </label>
                    <textarea
                      rows={2}
                      value={charDraft.appearance ?? ''}
                      onChange={(e) =>
                        setCharDraft({
                          ...charDraft,
                          appearance: e.target.value,
                        })
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
                        setCharDraft({
                          ...charDraft,
                          background: e.target.value,
                        })
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
                          성격, 가치관, 말투, 트라우마 등 원하는 항목을 직접
                          만들어 추가하세요.
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
                      <span className="text-[11px] text-stone-400">
                        빠른 추가:
                      </span>
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
                                updateCustomField(idx, {
                                  label: e.target.value,
                                })
                              }
                              placeholder="항목명 (예: 말투)"
                              className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold sm:w-36"
                            />
                            <textarea
                              rows={2}
                              value={field.value}
                              onChange={(e) =>
                                updateCustomField(idx, {
                                  value: e.target.value,
                                })
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
                </>
              )}

              {/* Free-form Narrative Notes */}
              {(charWriteMode === 'free' || charWriteMode === 'both') && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    자유 서술 노트 (형식 제한 없이 자유롭게 캐릭터 설정 메모)
                  </label>
                  <textarea
                    rows={charWriteMode === 'free' ? 12 : 5}
                    value={charDraft.free_notes ?? ''}
                    onChange={(e) =>
                      setCharDraft({ ...charDraft, free_notes: e.target.value })
                    }
                    placeholder="양식에 구애받지 않고 캐릭터의 대사 톤, 숨겨진 서사, 작가 메모 등을 자유롭게 적어보세요..."
                    className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-xs leading-relaxed focus:border-amber-500 focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              {/* Character-to-Character Relationship Links */}
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                      <Network className="h-3.5 w-3.5 text-amber-600" />
                      인물 간 관계도 연결
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      다른 등장인물을 연결해 관계도를 구성하세요. 상단 [인물
                      관계도 보기]에서 한눈에 볼 수 있습니다.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]">
                  <select
                    value={relTargetId}
                    onChange={(e) => setRelTargetId(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="">연결할 인물 선택...</option>
                    {characters
                      .filter((c) => c.id !== charDraft.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.role})
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    list="relation-presets"
                    value={relType}
                    onChange={(e) => setRelType(e.target.value)}
                    placeholder="관계 (예: 라이벌)"
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <datalist id="relation-presets">
                    {RELATION_PRESETS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <input
                    type="text"
                    value={relDesc}
                    onChange={(e) => setRelDesc(e.target.value)}
                    placeholder="관계 설명 (선택)"
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddRelationLink}
                    disabled={!relTargetId || !relType.trim()}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
                  >
                    + 연결
                  </button>
                </div>

                {(charDraft.linked_relationships ?? []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {(charDraft.linked_relationships ?? []).map((rel, idx) => {
                      const target = characters.find(
                        (c) => c.id === rel.targetCharacterId
                      );
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              {rel.relationType}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (target) {
                                  setCharDraft({
                                    ...target,
                                    tags: target.tags ?? [],
                                    linked_relationships:
                                      target.linked_relationships ?? [],
                                    custom_fields: target.custom_fields ?? [],
                                  });
                                }
                              }}
                              className="font-bold text-stone-900 hover:text-amber-700 hover:underline"
                            >
                              {target ? target.name : '알 수 없는 인물'}
                            </button>
                            {rel.description && (
                              <span className="text-stone-500">
                                — {rel.description}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRelationLink(idx)}
                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
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
