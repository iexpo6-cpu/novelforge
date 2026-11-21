'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Settings, X, PenTool, Users, Globe, GitBranch } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buildAIHeaders } from '@/lib/ai/client-key';
import { ensureEditorHtml, stripHtml } from '@/lib/text-utils';
import LeftSidebar from './LeftSidebar';
import ChapterEditor from './ChapterEditor';
import RightAIPanel from './RightAIPanel';
import StoryBibleWorkspace, {
  type BibleWorkspaceMode,
} from './StoryBibleWorkspace';
import type {
  AIChatMessage,
  Chapter,
  ChapterStatus,
  Character,
  ImageTargetType,
  PlotNode,
  Project,
  ProjectImage,
  WorldSetting,
} from '@/types/novel';

interface StudioShellProps {
  initialProject: Project;
  initialChapters: Chapter[];
  initialCharacters: Character[];
  initialWorldSettings: WorldSetting[];
  initialPlotNodes: PlotNode[];
  initialImages: ProjectImage[];
  initialMessages: AIChatMessage[];
}

export default function StudioShell({
  initialProject,
  initialChapters,
  initialCharacters,
  initialWorldSettings,
  initialPlotNodes,
  initialImages,
  initialMessages,
}: StudioShellProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    initialChapters[0]?.id ?? null
  );
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [worldSettings, setWorldSettings] =
    useState<WorldSetting[]>(initialWorldSettings);
  const [plotNodes, setPlotNodes] = useState<PlotNode[]>(initialPlotNodes);
  const [images, setImages] = useState<ProjectImage[]>(initialImages);
  const [messages, setMessages] = useState<AIChatMessage[]>(initialMessages);

  const [savingState, setSavingState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [mobilePane, setMobilePane] = useState<'left' | 'editor' | 'right'>(
    'editor'
  );
  const [centerMode, setCenterMode] = useState<'editor' | BibleWorkspaceMode>(
    'editor'
  );
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [rightTab, setRightTab] = useState<'assistant' | 'image'>('assistant');
  const [imageTargetType, setImageTargetType] =
    useState<ImageTargetType>('cover');
  const [imageTargetId, setImageTargetId] = useState<string>('');
  const [extraGroups, setExtraGroups] = useState<{
    characters: string[];
    world: string[];
    plot: string[];
  }>({ characters: [], world: [], plot: [] });
  const [focusedItem, setFocusedItem] = useState<{
    kind: BibleWorkspaceMode;
    id: string;
    nonce: number;
  } | null>(null);

  function handleAddGroup(
    kind: 'characters' | 'world' | 'plot',
    groupName: string
  ) {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    setExtraGroups((prev) => ({
      ...prev,
      [kind]: prev[kind].includes(trimmed)
        ? prev[kind]
        : [...prev[kind], trimmed],
    }));
  }

  async function handleDeleteGroup(
    kind: 'characters' | 'world' | 'plot',
    groupName: string
  ) {
    if (!groupName || groupName === '미분류') return;
    setExtraGroups((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((g) => g !== groupName),
    }));

    const supabase = createClient();
    const table =
      kind === 'characters'
        ? 'characters'
        : kind === 'world'
          ? 'world_settings'
          : 'plot_nodes';

    await supabase
      .from(table)
      .update({ folder: '미분류' })
      .eq('project_id', project.id)
      .eq('folder', groupName);

    if (kind === 'characters') {
      setCharacters((prev) =>
        prev.map((c) =>
          (c.folder || '미분류') === groupName ? { ...c, folder: '미분류' } : c
        )
      );
    } else if (kind === 'world') {
      setWorldSettings((prev) =>
        prev.map((w) =>
          (w.folder || '미분류') === groupName ? { ...w, folder: '미분류' } : w
        )
      );
    } else {
      setPlotNodes((prev) =>
        prev.map((p) =>
          (p.folder || '미분류') === groupName ? { ...p, folder: '미분류' } : p
        )
      );
    }
  }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const activeChapter =
    chapters.find((c) => c.id === activeChapterId) ?? null;

  function scheduleChapterSave(
    chapterId: string,
    patch: Partial<Pick<Chapter, 'title' | 'content' | 'word_count' | 'status'>>
  ) {
    setSavingState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('chapters')
        .update(patch)
        .eq('id', chapterId);
      setSavingState(error ? 'error' : 'saved');
    }, 800);
  }

  function handleChangeChapterTitle(title: string) {
    if (!activeChapter) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapter.id ? { ...c, title } : c))
    );
    scheduleChapterSave(activeChapter.id, { title });
  }

  function handleChangeChapterContent(content: string) {
    if (!activeChapter) return;
    const wordCount = stripHtml(content).length;
    setChapters((prev) =>
      prev.map((c) =>
        c.id === activeChapter.id
          ? { ...c, content, word_count: wordCount }
          : c
      )
    );
    scheduleChapterSave(activeChapter.id, { content, word_count: wordCount });
  }

  async function handleChangeChapterStatus(status: ChapterStatus) {
    if (!activeChapter) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapter.id ? { ...c, status } : c))
    );
    const supabase = createClient();
    await supabase
      .from('chapters')
      .update({ status })
      .eq('id', activeChapter.id);
  }

  async function handleCreateChapter() {
    const supabase = createClient();
    const nextIdx = chapters.length;
    const { data, error } = await supabase
      .from('chapters')
      .insert({
        project_id: project.id,
        order_index: nextIdx,
        title: `${nextIdx + 1}화. 제목 없음`,
        content: '',
        status: 'draft',
      })
      .select()
      .single();

    if (!error && data) {
      const created = data as Chapter;
      setChapters((prev) => [...prev, created]);
      setActiveChapterId(created.id);
      setMobilePane('editor');
    }
  }

  async function handleDeleteChapter(id: string) {
    if (!confirm('이 회차를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('chapters').delete().eq('id', id);
    if (!error) {
      const remaining = chapters.filter((c) => c.id !== id);
      setChapters(remaining);
      if (activeChapterId === id) {
        setActiveChapterId(remaining[0]?.id ?? null);
      }
    }
  }

  async function handleSaveCharacter(
    char: Partial<Character> & { id?: string }
  ) {
    const supabase = createClient();
    const folder = char.folder?.trim() || '미분류';
    const custom_fields = (char.custom_fields ?? []).filter(
      (f) => f.label.trim() || f.value.trim()
    );
    const tags = (char.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const linked_relationships = (char.linked_relationships ?? []).filter(
      (r) => r.targetCharacterId && r.relationType.trim()
    );
    if (char.id) {
      const { data } = await supabase
        .from('characters')
        .update({
          folder,
          name: char.name,
          role: char.role,
          age: char.age,
          appearance: char.appearance,
          personality: char.personality,
          background: char.background,
          relationships: char.relationships,
          free_notes: char.free_notes ?? '',
          tags,
          linked_relationships,
          custom_fields,
          avatar_image_url: char.avatar_image_url ?? null,
        })
        .eq('id', char.id)
        .select()
        .single();
      if (data) {
        setCharacters((prev) =>
          prev.map((c) => (c.id === data.id ? (data as Character) : c))
        );
      }
    } else {
      const { data } = await supabase
        .from('characters')
        .insert({
          project_id: project.id,
          folder,
          name: char.name,
          role: char.role || '조연',
          age: char.age || '',
          appearance: char.appearance || '',
          personality: char.personality || '',
          background: char.background || '',
          relationships: char.relationships || '',
          free_notes: char.free_notes ?? '',
          tags,
          linked_relationships,
          custom_fields,
          avatar_image_url: char.avatar_image_url ?? null,
        })
        .select()
        .single();
      if (data) {
        setCharacters((prev) => [...prev, data as Character]);
      }
    }
  }

  async function handleDeleteCharacter(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (!error) {
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function handleSaveWorld(
    world: Partial<WorldSetting> & { id?: string }
  ) {
    const supabase = createClient();
    const folder = world.folder?.trim() || '미분류';
    if (world.id) {
      const { data } = await supabase
        .from('world_settings')
        .update({
          folder,
          category: world.category,
          title: world.title,
          description: world.description,
        })
        .eq('id', world.id)
        .select()
        .single();
      if (data) {
        setWorldSettings((prev) =>
          prev.map((w) => (w.id === data.id ? (data as WorldSetting) : w))
        );
      }
    } else {
      const { data } = await supabase
        .from('world_settings')
        .insert({
          project_id: project.id,
          folder,
          category: world.category || '장소',
          title: world.title,
          description: world.description || '',
        })
        .select()
        .single();
      if (data) {
        setWorldSettings((prev) => [...prev, data as WorldSetting]);
      }
    }
  }

  async function handleDeleteWorld(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('world_settings')
      .delete()
      .eq('id', id);
    if (!error) {
      setWorldSettings((prev) => prev.filter((w) => w.id !== id));
    }
  }

  async function handleSavePlot(node: Partial<PlotNode> & { id?: string }) {
    const supabase = createClient();
    const folder = node.folder?.trim() || '미분류';
    if (node.id) {
      const { data } = await supabase
        .from('plot_nodes')
        .update({
          folder,
          act_label: node.act_label,
          title: node.title,
          description: node.description,
          chapter_id: node.chapter_id ?? null,
        })
        .eq('id', node.id)
        .select()
        .single();
      if (data) {
        setPlotNodes((prev) =>
          prev.map((p) => (p.id === data.id ? (data as PlotNode) : p))
        );
      }
    } else {
      const { data } = await supabase
        .from('plot_nodes')
        .insert({
          project_id: project.id,
          folder,
          order_index: node.order_index ?? plotNodes.length,
          act_label: node.act_label || '기',
          title: node.title,
          description: node.description || '',
          chapter_id: node.chapter_id ?? null,
        })
        .select()
        .single();
      if (data) {
        setPlotNodes((prev) => [...prev, data as PlotNode]);
      }
    }
  }

  async function handleDeletePlot(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('plot_nodes').delete().eq('id', id);
    if (!error) {
      setPlotNodes((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleGenerateSummary() {
    if (!activeChapter) return;
    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: buildAIHeaders(),
      body: JSON.stringify({
        chapterId: activeChapter.id,
        title: activeChapter.title,
        content: stripHtml(activeChapter.content),
      }),
    });
    const data = await res.json();
    if (res.ok && data.summary) {
      setChapters((prev) =>
        prev.map((c) =>
          c.id === activeChapter.id ? { ...c, summary: data.summary } : c
        )
      );
    }
  }

  function handleExportMarkdown() {
    if (!activeChapter) return;
    const blob = new Blob(
      [`# ${activeChapter.title}\n\n${stripHtml(activeChapter.content)}`],
      { type: 'text/markdown;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeChapter.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleInsertToEditor(text: string) {
    if (!activeChapter) return;
    const baseHtml = ensureEditorHtml(activeChapter.content);
    const insertedHtml = ensureEditorHtml(text);
    const nextHtml = baseHtml ? `${baseHtml}${insertedHtml}` : insertedHtml;
    handleChangeChapterContent(nextHtml);
    setMobilePane('editor');
  }

  async function handleSetCoverImage(imageUrl: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .update({ cover_image_url: imageUrl })
      .eq('id', project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, cover_image_url: imageUrl }));
    }
  }

  function handleImageGenerated(
    image: ProjectImage,
    targetType: ImageTargetType,
    targetId?: string | null
  ) {
    setImages((prev) => [image, ...prev]);
    if (targetType === 'cover') {
      setProject((prev) => ({ ...prev, cover_image_url: image.image_url }));
    } else if (targetType === 'character' && targetId) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === targetId ? { ...c, avatar_image_url: image.image_url } : c
        )
      );
    } else if (targetType === 'world' && targetId) {
      setWorldSettings((prev) =>
        prev.map((w) =>
          w.id === targetId ? { ...w, image_url: image.image_url } : w
        )
      );
    }
  }

  async function handleSaveProjectInfo(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .update({
        title: project.title,
        genre: project.genre,
        logline: project.logline,
        synopsis: project.synopsis,
      })
      .eq('id', project.id)
      .select()
      .single();
    if (data) {
      setProject(data as Project);
    }
    setShowProjectModal(false);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-50">
      {/* Studio Header */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            대시보드
          </Link>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" />
            <h1 className="max-w-[200px] truncate font-serif text-sm font-bold text-stone-900 sm:max-w-xs">
              {project.title}
            </h1>
            <span className="hidden rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 sm:inline">
              {project.genre}
            </span>
          </div>
        </div>

        {/* Center Workspace Mode Switcher (Desktop) */}
        <div className="hidden items-center gap-1 rounded-xl bg-stone-100 p-1 lg:flex">
          {[
            { id: 'editor', label: '집필 에디터', icon: PenTool },
            { id: 'characters', label: '캐릭터 상세', icon: Users },
            { id: 'world', label: '세계관 백과', icon: Globe },
            { id: 'plot', label: '줄거리 보드', icon: GitBranch },
          ].map((item) => {
            const Icon = item.icon;
            const active = centerMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setCenterMode(item.id as 'editor' | BibleWorkspaceMode)
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Mobile Pane Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-0.5 lg:hidden">
          {[
            { id: 'left', label: '설정집' },
            { id: 'editor', label: '집필' },
            { id: 'right', label: 'AI' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setMobilePane(p.id as 'left' | 'editor' | 'right')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                mobilePane === p.id
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowProjectModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">작품 정보</span>
        </button>
      </header>

      {/* 3-Column Studio Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_360px]">
        <div
          className={`min-h-0 ${
            mobilePane === 'left' ? 'block' : 'hidden lg:block'
          }`}
        >
          <LeftSidebar
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={(id) => {
              setActiveChapterId(id);
              setCenterMode('editor');
              setMobilePane('editor');
            }}
            onCreateChapter={handleCreateChapter}
            onDeleteChapter={handleDeleteChapter}
            characters={characters}
            onSaveCharacter={handleSaveCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            worldSettings={worldSettings}
            onSaveWorld={handleSaveWorld}
            onDeleteWorld={handleDeleteWorld}
            plotNodes={plotNodes}
            onSavePlot={handleSavePlot}
            onDeletePlot={handleDeletePlot}
            extraGroups={extraGroups}
            onAddGroup={handleAddGroup}
            onDeleteGroup={handleDeleteGroup}
            onNavigateBibleItem={(kind, id) => {
              setCenterMode(kind);
              setFocusedItem({ kind, id, nonce: Date.now() });
              setMobilePane('editor');
            }}
            images={images}
            onSetCoverImage={handleSetCoverImage}
            onRequestImageGeneration={(targetType, targetId) => {
              setImageTargetType(targetType);
              setImageTargetId(targetId ?? '');
              setRightTab('image');
              setMobilePane('right');
            }}
          />
        </div>

        <div
          className={`min-h-0 ${
            mobilePane === 'editor' ? 'block' : 'hidden lg:block'
          }`}
        >
          {centerMode === 'editor' ? (
            <ChapterEditor
              projectId={project.id}
              chapter={activeChapter}
              savingState={savingState}
              onChangeTitle={handleChangeChapterTitle}
              onChangeContent={handleChangeChapterContent}
              onChangeStatus={handleChangeChapterStatus}
              onGenerateSummary={handleGenerateSummary}
              onExportMarkdown={handleExportMarkdown}
            />
          ) : (
            <StoryBibleWorkspace
              mode={centerMode}
              project={project}
              chapters={chapters}
              characters={characters}
              worldSettings={worldSettings}
              plotNodes={plotNodes}
              onSaveProjectMeta={async (patch) => {
                const supabase = createClient();
                const { data } = await supabase
                  .from('projects')
                  .update(patch)
                  .eq('id', project.id)
                  .select()
                  .single();
                if (data) setProject(data as Project);
              }}
              onSaveCharacter={handleSaveCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              onSaveWorld={handleSaveWorld}
              onDeleteWorld={handleDeleteWorld}
              onSavePlot={handleSavePlot}
              onDeletePlot={handleDeletePlot}
              extraGroups={extraGroups}
              onAddGroup={handleAddGroup}
              onDeleteGroup={handleDeleteGroup}
              focusedItem={focusedItem}
              onRequestImageGeneration={(targetType, targetId) => {
                setImageTargetType(targetType);
                setImageTargetId(targetId ?? '');
                setRightTab('image');
                setMobilePane('right');
              }}
            />
          )}
        </div>

        <div
          className={`min-h-0 ${
            mobilePane === 'right' ? 'block' : 'hidden lg:block'
          }`}
        >
          <RightAIPanel
            projectId={project.id}
            activeChapter={activeChapter}
            characters={characters}
            worldSettings={worldSettings}
            messages={messages}
            onMessagesChange={setMessages}
            onInsertToEditor={handleInsertToEditor}
            onImageGenerated={handleImageGenerated}
            rightTab={rightTab}
            onChangeRightTab={setRightTab}
            targetType={imageTargetType}
            onChangeTargetType={setImageTargetType}
            targetId={imageTargetId}
            onChangeTargetId={setImageTargetId}
          />
        </div>
      </div>

      {/* Project Metadata Edit Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">
                작품 기본 정보 수정
              </h2>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProjectInfo} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-stone-700">
                  제목
                </label>
                <input
                  type="text"
                  required
                  value={project.title}
                  onChange={(e) =>
                    setProject({ ...project, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-stone-700">
                  장르
                </label>
                <input
                  type="text"
                  value={project.genre}
                  onChange={(e) =>
                    setProject({ ...project, genre: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-stone-700">
                  로그라인
                </label>
                <textarea
                  rows={2}
                  value={project.logline}
                  onChange={(e) =>
                    setProject({ ...project, logline: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-stone-700">
                  시놉시스
                </label>
                <textarea
                  rows={4}
                  value={project.synopsis}
                  onChange={(e) =>
                    setProject({ ...project, synopsis: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="rounded-lg px-4 py-2 text-stone-600 hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white hover:bg-stone-800"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
